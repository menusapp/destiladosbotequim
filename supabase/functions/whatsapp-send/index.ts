import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

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

    const { restaurantId, phone, message, orderId, messageType } = await req.json();

    if (!restaurantId || !phone || !message) {
      return new Response(
        JSON.stringify({ error: 'restaurantId, phone and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[SEND] Restaurant: ${restaurantId}, Phone: ${phone}, Type: ${messageType}`);

    // Get restaurant WhatsApp config
    const { data: config, error: configError } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .maybeSingle();

    if (configError) {
      console.error('[SEND] Config error:', configError);
      throw new Error('Failed to fetch WhatsApp config');
    }

    if (!config) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp not configured for this restaurant' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!config.enabled) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp is disabled for this restaurant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (config.instance_status !== 'connected') {
      return new Response(
        JSON.stringify({ error: 'WhatsApp instance is not connected' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const instanceName = config.instance_name;

    // Format phone number (remove non-digits, ensure country code)
    let formattedPhone = phone.replace(/\D/g, '');
    if (!formattedPhone.startsWith('55')) {
      formattedPhone = '55' + formattedPhone;
    }

    console.log(`[SEND] Sending to ${formattedPhone} via instance ${instanceName}`);

    // Send message via Evolution API
    const sendResponse = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY!
        },
        body: JSON.stringify({
          number: formattedPhone,
          text: message
        })
      }
    );

    const sendData = await sendResponse.json();
    console.log(`[SEND] Response:`, sendData);

    if (!sendResponse.ok) {
      // Check if it's a "number doesn't exist on WhatsApp" error
      const numberNotOnWhatsApp = sendData?.response?.message?.some?.(
        (m: { exists?: boolean }) => m.exists === false
      );

      if (numberNotOnWhatsApp) {
        console.log(`[SEND] Number ${formattedPhone} is not on WhatsApp`);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'number_not_on_whatsapp',
            message: 'Este número não está cadastrado no WhatsApp',
            to: formattedPhone
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // For other errors, log and return error response
      console.error(`[SEND] Evolution API error:`, sendData);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'send_failed',
          message: sendData.message || 'Falha ao enviar mensagem',
          details: sendData
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        messageId: sendData.key?.id,
        to: formattedPhone
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[ERROR]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
