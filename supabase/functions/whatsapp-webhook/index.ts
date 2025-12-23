import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
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

    const body = await req.json();
    console.log('[WEBHOOK] Received event:', JSON.stringify(body, null, 2));

    const { event, instance, data } = body;

    if (!instance) {
      console.log('[WEBHOOK] No instance in payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const instanceName = instance;

    // Find restaurant by instance name
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('restaurant_id')
      .eq('instance_name', instanceName)
      .maybeSingle();

    if (!config) {
      console.log(`[WEBHOOK] No config found for instance: ${instanceName}`);
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const restaurantId = config.restaurant_id;

    // Handle different event types
    switch (event) {
      case 'connection.update': {
        const state = data?.state;
        console.log(`[WEBHOOK] Connection update for ${instanceName}: ${state}`);

        if (state === 'open') {
          // Connected successfully
          await supabase
            .from('whatsapp_config')
            .update({
              instance_status: 'connected',
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('restaurant_id', restaurantId);
        } else if (state === 'close' || state === 'connecting') {
          await supabase
            .from('whatsapp_config')
            .update({
              instance_status: state === 'close' ? 'disconnected' : 'connecting',
              updated_at: new Date().toISOString()
            })
            .eq('restaurant_id', restaurantId);
        }
        break;
      }

      case 'qrcode.updated': {
        console.log(`[WEBHOOK] QR code updated for ${instanceName}`);
        await supabase
          .from('whatsapp_config')
          .update({
            instance_status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('restaurant_id', restaurantId);
        break;
      }

      case 'logout': {
        console.log(`[WEBHOOK] Logout for ${instanceName}`);
        await supabase
          .from('whatsapp_config')
          .update({
            instance_status: 'disconnected',
            connected_phone: null,
            connected_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('restaurant_id', restaurantId);
        break;
      }

      case 'messages.upsert': {
        // Message received - could be used for auto-replies in the future
        console.log(`[WEBHOOK] Message received on ${instanceName}`);
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${event}`);
    }

    return new Response(JSON.stringify({ received: true, event }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[ERROR]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
