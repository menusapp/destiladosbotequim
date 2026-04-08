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

    // Replace variables in template
    let message = template;
    if (context && typeof context === 'object') {
      for (const [key, value] of Object.entries(context)) {
        message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value || ''));
      }
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
