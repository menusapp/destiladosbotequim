import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { restaurant_id, notification_type, context } = await req.json();

    if (!restaurant_id || !notification_type) {
      return new Response(
        JSON.stringify({ error: 'restaurant_id and notification_type are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NOTIF] Type: ${notification_type}, Restaurant: ${restaurant_id}`);

    // Check WhatsApp is connected
    const { data: waConfig } = await supabase
      .from('whatsapp_config')
      .select('enabled, instance_status')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    if (!waConfig?.enabled || waConfig?.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ success: false, reason: 'whatsapp_not_connected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get notification config
    const { data: notifConfig } = await supabase
      .from('whatsapp_notification_configs')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('notification_type', notification_type)
      .maybeSingle();

    if (!notifConfig || !notifConfig.is_active) {
      return new Response(
        JSON.stringify({ success: false, reason: 'notification_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const template = notifConfig.template_message;
    if (!template) {
      return new Response(
        JSON.stringify({ success: false, reason: 'no_template' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build enriched context: if order_id is provided, fetch items + totals
    // and expose them as {{resumo_pedido}} and {{total_pedido}}.
    const enrichedContext: Record<string, unknown> = { ...(context || {}) };

    const orderId = (context && typeof context === 'object') ? (context as any).order_id : null;
    const needsSummary = orderId && (template.includes('{{resumo_pedido}}') || template.includes('{{total_pedido}}'));

    if (needsSummary) {
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('id, delivery_fee, coupon_discount, delivery_address, delivery_type, order_type, notes')
          .eq('id', orderId)
          .maybeSingle();

        const { data: items } = await supabase
          .from('order_items')
          .select('quantity, price_at_order, notes, products(name), order_item_extras(price_at_order, extra_name, product_extras(name))')
          .eq('order_id', orderId);

        const fmt = (n: number) => `R$ ${Number(n || 0).toFixed(2).replace('.', ',')}`;

        const lines: string[] = ['📋 *Resumo do Pedido*', ''];
        let subtotal = 0;

        (items || []).forEach((it: any, idx: number) => {
          const qty = Number(it.quantity || 1);
          const unit = Number(it.price_at_order || 0);
          const extrasArr = Array.isArray(it.order_item_extras) ? it.order_item_extras : [];
          const extrasUnit = extrasArr.reduce((s: number, e: any) => s + Number(e.price_at_order || 0), 0);
          const lineTotal = (unit + extrasUnit) * qty;
          subtotal += lineTotal;

          const productName = it.products?.name || 'Item';
          lines.push(`${idx + 1}. *${productName}* x${qty} — ${fmt(lineTotal)}`);

          extrasArr.forEach((e: any) => {
            const extraName = e.extra_name || e.product_extras?.name || 'Adicional';
            const extraPrice = Number(e.price_at_order || 0);
            if (extraPrice > 0) {
              lines.push(`   + ${extraName} (${fmt(extraPrice)})`);
            } else {
              lines.push(`   + ${extraName}`);
            }
          });

          if (it.notes) lines.push(`   📝 ${it.notes}`);
        });

        const deliveryFee = Number(order?.delivery_fee || 0);
        const discount = Number(order?.coupon_discount || 0);
        const total = subtotal + deliveryFee - discount;

        if (deliveryFee > 0 || discount > 0) {
          lines.push('');
          lines.push(`Subtotal: ${fmt(subtotal)}`);
          if (deliveryFee > 0) lines.push(`🚚 Taxa de entrega: ${fmt(deliveryFee)}`);
          if (discount > 0) lines.push(`🎟️ Desconto: -${fmt(discount)}`);
        }

        if (order?.delivery_address) {
          lines.push('');
          lines.push(`📍 ${order.delivery_address}`);
        }

        lines.push('');
        lines.push(`💰 *Total: ${fmt(total)}*`);

        enrichedContext.resumo_pedido = lines.join('\n');
        enrichedContext.total_pedido = fmt(total);
      } catch (summaryErr) {
        console.warn('[NOTIF] Failed to build order summary:', summaryErr);
        enrichedContext.resumo_pedido = '';
        enrichedContext.total_pedido = '';
      }
    }

    // Replace variables in template
    let message = template;
    for (const [key, value] of Object.entries(enrichedContext)) {
      message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value ?? ''));
    }

    // Determine recipient phone
    const ownerTypes = ['cashier_open', 'cashier_close', 'daily_summary'];
    let phone: string | null = null;

    if (ownerTypes.includes(notification_type)) {
      // Get owner phone
      const { data: ownerConfig } = await supabase
        .from('owner_notification_config')
        .select('owner_phone, receive_cashier_open, receive_cashier_close, receive_daily_summary')
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();

      if (!ownerConfig?.owner_phone) {
        return new Response(
          JSON.stringify({ success: false, reason: 'no_owner_phone' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check owner toggle
      if (notification_type === 'cashier_open' && !ownerConfig.receive_cashier_open) {
        return new Response(
          JSON.stringify({ success: false, reason: 'owner_toggle_off' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (notification_type === 'cashier_close' && !ownerConfig.receive_cashier_close) {
        return new Response(
          JSON.stringify({ success: false, reason: 'owner_toggle_off' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (notification_type === 'daily_summary' && !ownerConfig.receive_daily_summary) {
        return new Response(
          JSON.stringify({ success: false, reason: 'owner_toggle_off' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      phone = ownerConfig.owner_phone;
    } else {
      // Client notification — phone comes from context
      phone = context?.phone || null;
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, reason: 'no_phone' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via whatsapp-send
    const sendUrl = `${supabaseUrl}/functions/v1/whatsapp-send`;
    const sendResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        restaurantId: restaurant_id,
        phone,
        message,
        messageType: notification_type,
      }),
    });

    const sendResult = await sendResponse.json();
    console.log(`[NOTIF] Send result:`, sendResult);

    return new Response(
      JSON.stringify({ success: sendResult.success ?? false, ...sendResult }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[NOTIF ERROR]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
