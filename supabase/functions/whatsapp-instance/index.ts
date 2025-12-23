import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVOLUTION_API_URL = Deno.env.get('EVOLUTION_API_URL');
const EVOLUTION_API_KEY = Deno.env.get('EVOLUTION_API_KEY');

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const restaurantId = url.searchParams.get('restaurantId');

    if (!restaurantId) {
      return new Response(
        JSON.stringify({ error: 'restaurantId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const instanceName = `rest-${restaurantId.slice(0, 8)}`;

    // GET - Fetch instance status and QR code
    if (req.method === 'GET') {
      console.log(`[GET] Fetching status for instance: ${instanceName}`);

      // First check local DB status
      const { data: config } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      // Try to get connection state from Evolution API
      try {
        const stateResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
          {
            headers: { 'apikey': EVOLUTION_API_KEY! }
          }
        );

        if (stateResponse.ok) {
          const stateData = await stateResponse.json();
          console.log(`[GET] Connection state:`, stateData);

          const isConnected = stateData.state === 'open';

          // Update DB with current status
          await supabase
            .from('whatsapp_config')
            .upsert({
              restaurant_id: restaurantId,
              instance_name: instanceName,
              instance_status: isConnected ? 'connected' : 'disconnected',
              connected_at: isConnected ? new Date().toISOString() : null,
              updated_at: new Date().toISOString()
            }, { onConflict: 'restaurant_id' });

          return new Response(
            JSON.stringify({
              instance_name: instanceName,
              status: isConnected ? 'connected' : 'disconnected',
              state: stateData.state,
              config
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.log(`[GET] Instance might not exist yet:`, error);
      }

      // Instance doesn't exist or error
      return new Response(
        JSON.stringify({
          instance_name: instanceName,
          status: 'not_created',
          config
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Create instance or get QR code
    if (req.method === 'POST') {
      const body = await req.json();
      const action = body.action || 'create';

      if (action === 'create') {
        console.log(`[POST] Creating instance: ${instanceName}`);

        // Create instance in Evolution API
        const createResponse = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': EVOLUTION_API_KEY!
          },
          body: JSON.stringify({
            instanceName: instanceName,
            qrcode: true,
            integration: 'WHATSAPP-BAILEYS'
          })
        });

        const createData = await createResponse.json();
        console.log(`[POST] Create response:`, JSON.stringify(createData));

        if (!createResponse.ok) {
          // Instance might already exist, try to get QR code
          if (createData.message?.includes('already') || createData.error?.includes('already')) {
            console.log(`[POST] Instance exists, fetching QR code...`);
          } else {
            throw new Error(createData.message || createData.error || 'Failed to create instance');
          }
        }

        // Save to database
        await supabase
          .from('whatsapp_config')
          .upsert({
            restaurant_id: restaurantId,
            instance_name: instanceName,
            instance_status: 'pending',
            updated_at: new Date().toISOString()
          }, { onConflict: 'restaurant_id' });

        // Wait for instance to initialize
        console.log(`[POST] Waiting 2s for instance to initialize...`);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get QR code with retry
        let qrcode = null;
        let pairingCode = null;
        let attempts = 0;
        const maxAttempts = 3;

        while (!qrcode && attempts < maxAttempts) {
          attempts++;
          console.log(`[POST] Fetching QR code, attempt ${attempts}/${maxAttempts}...`);

          const qrResponse = await fetch(
            `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
            {
              headers: { 'apikey': EVOLUTION_API_KEY! }
            }
          );

          const qrData = await qrResponse.json();
          console.log(`[POST] QR response (attempt ${attempts}):`, JSON.stringify(qrData));

          // Try multiple possible paths for QR code
          qrcode = qrData.base64 
            || qrData.qrcode?.base64 
            || qrData.qrcode 
            || qrData.code 
            || qrData.qr
            || null;
          
          pairingCode = qrData.pairingCode || qrData.pairing_code || null;

          if (!qrcode && attempts < maxAttempts) {
            console.log(`[POST] QR code not available yet, waiting 2s...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }

        if (!qrcode) {
          console.log(`[POST] Failed to get QR code after ${maxAttempts} attempts`);
          return new Response(
            JSON.stringify({
              success: false,
              error: 'QR code não disponível ainda. Tente novamente em alguns segundos.',
              instance_name: instanceName
            }),
            { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[POST] QR code obtained successfully`);
        return new Response(
          JSON.stringify({
            success: true,
            instance_name: instanceName,
            qrcode: qrcode,
            pairingCode: pairingCode
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (action === 'qrcode') {
        console.log(`[POST] Getting QR code for: ${instanceName}`);

        const qrResponse = await fetch(
          `${EVOLUTION_API_URL}/instance/connect/${instanceName}`,
          {
            headers: { 'apikey': EVOLUTION_API_KEY! }
          }
        );

        const qrData = await qrResponse.json();
        console.log(`[POST] QR code response:`, JSON.stringify(qrData));

        // Try multiple possible paths for QR code
        const qrcode = qrData.base64 
          || qrData.qrcode?.base64 
          || qrData.qrcode 
          || qrData.code 
          || qrData.qr
          || null;

        return new Response(
          JSON.stringify({
            success: true,
            qrcode: qrcode,
            pairingCode: qrData.pairingCode || qrData.pairing_code
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // DELETE - Disconnect/logout instance
    if (req.method === 'DELETE') {
      console.log(`[DELETE] Disconnecting instance: ${instanceName}`);

      // Logout from Evolution API
      const logoutResponse = await fetch(
        `${EVOLUTION_API_URL}/instance/logout/${instanceName}`,
        {
          method: 'DELETE',
          headers: { 'apikey': EVOLUTION_API_KEY! }
        }
      );

      console.log(`[DELETE] Logout status:`, logoutResponse.status);

      // Update database
      await supabase
        .from('whatsapp_config')
        .update({
          instance_status: 'disconnected',
          connected_phone: null,
          connected_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('restaurant_id', restaurantId);

      return new Response(
        JSON.stringify({ success: true, message: 'Instance disconnected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
