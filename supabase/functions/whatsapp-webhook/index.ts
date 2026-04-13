import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize event names from Evolution API (supports both formats)
function normalizeEvent(event: string): string {
  const map: Record<string, string> = {
    'connection.update': 'connection.update',
    'CONNECTION_UPDATE': 'connection.update',
    'qrcode.updated': 'qrcode.updated',
    'QRCODE_UPDATED': 'qrcode.updated',
    'messages.upsert': 'messages.upsert',
    'MESSAGES_UPSERT': 'messages.upsert',
    'logout': 'logout',
    'LOGOUT_INSTANCE': 'logout',
  };
  return map[event] || event;
}

Deno.serve(async (req) => {
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

    const { event: rawEvent, data } = body;
    // Extract instance name from various payload formats
    const instance = body.instance || body.instanceName || data?.instance || data?.instanceName;

    if (!instance) {
      console.log('[WEBHOOK] No instance in payload');
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const instanceName = instance;
    const event = normalizeEvent(rawEvent);

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
        const state = data?.state || data?.instance?.state;
        console.log(`[WEBHOOK] Connection update for ${instanceName}: ${state}`);

        // Normalize state consistently
        const stateMap: Record<string, string> = {
          'open': 'connected',
          'connecting': 'connecting',
          'close': 'disconnected',
          'closed': 'disconnected',
        };
        const normalizedStatus = stateMap[state] || 'disconnected';

        const updateData: Record<string, any> = {
          instance_status: normalizedStatus,
          updated_at: new Date().toISOString()
        };
        if (normalizedStatus === 'connected') {
          updateData.connected_at = new Date().toISOString();
        }

        await supabase
          .from('whatsapp_config')
          .update(updateData)
          .eq('restaurant_id', restaurantId);
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
        // Message received — trigger AI bot if not from self
        const msgData = data?.message || data;
        const fromMe = msgData?.key?.fromMe ?? msgData?.fromMe ?? false;
        const messageText = msgData?.message?.conversation
          || msgData?.message?.extendedTextMessage?.text
          || msgData?.body
          || '';
        const remoteJid = msgData?.key?.remoteJid || '';
        const customerPhone = remoteJid.replace('@s.whatsapp.net', '').replace('@c.us', '');

        if (!fromMe && customerPhone && messageText) {
          console.log(`[WEBHOOK] Incoming message on ${instanceName} from ${customerPhone}: ${messageText.slice(0, 50)}`);
          // Fire-and-forget call to AI bot
          fetch(`${supabaseUrl}/functions/v1/whatsapp-ai-bot`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              restaurant_id: restaurantId,
              customer_phone: customerPhone,
              message_text: messageText,
            }),
          }).catch(err => console.error('[WEBHOOK] AI bot call failed:', err));
        } else {
          console.log(`[WEBHOOK] Message on ${instanceName} (fromMe=${fromMe}, skipped)`);
        }
        break;
      }

      default:
        console.log(`[WEBHOOK] Unhandled event: ${rawEvent}`);
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
