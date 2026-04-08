import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const PERSONALITY_PROMPTS: Record<string, string> = {
  classic_waiter: "Você é um garçom clássico e formal. Use linguagem polida e educada. Trate o cliente como 'senhor(a)'.",
  friendly: "Você é simpático e amigável. Use emojis com moderação. Seja acolhedor e descontraído.",
  objective: "Você é direto e objetivo. Respostas curtas e claras. Sem enrolação.",
  patient: "Você é extremamente paciente e detalhista. Explique tudo com calma. Repita informações se necessário.",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { restaurant_id, customer_phone, message_text, simulate } = body;

    if (!restaurant_id || !customer_phone || message_text === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if AI is active
    const { data: aiConfig } = await supabase
      .from('whatsapp_ai_config')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .maybeSingle();

    if (!aiConfig?.is_active) {
      return new Response(JSON.stringify({ skipped: true, reason: 'AI not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get restaurant info
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('name, slug')
      .eq('id', restaurant_id)
      .single();

    if (!restaurant) {
      return new Response(JSON.stringify({ error: 'Restaurant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get or create conversation
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    let { data: conversation } = await supabase
      .from('whatsapp_conversations')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('customer_phone', customer_phone)
      .maybeSingle();

    if (conversation && conversation.last_message_at < fourHoursAgo) {
      // Reset expired session
      await supabase
        .from('whatsapp_conversations')
        .update({ current_step: 'welcome', order_draft: {}, last_message_at: new Date().toISOString() })
        .eq('id', conversation.id);
      conversation.current_step = 'welcome';
    }

    if (!conversation) {
      const { data: newConv } = await supabase
        .from('whatsapp_conversations')
        .upsert({
          restaurant_id,
          customer_phone,
          current_step: 'welcome',
          order_draft: {},
          last_message_at: new Date().toISOString()
        }, { onConflict: 'restaurant_id,customer_phone' })
        .select()
        .single();
      conversation = newConv;
    }

    // Get menu options
    const { data: menuOptions } = await supabase
      .from('whatsapp_menu_options')
      .select('*')
      .eq('restaurant_id', restaurant_id)
      .eq('is_active', true)
      .order('position');

    const menuLink = `https://menurio.com.br/${restaurant.slug}`;
    let responseText = '';
    let newStep = conversation.current_step;

    // Process by step
    if (conversation.current_step === 'welcome') {
      responseText = buildWelcomeMessage(aiConfig, restaurant.name, menuLink, menuOptions || []);
      newStep = 'menu';
    } else if (conversation.current_step === 'menu') {
      const result = await processMenuChoice(
        message_text, menuOptions || [], restaurant, aiConfig, supabase, restaurant_id, menuLink, customer_phone
      );
      responseText = result.response;
      newStep = result.newStep;
    } else if (conversation.current_step === 'human') {
      // Bot silenced, don't respond
      return new Response(JSON.stringify({ skipped: true, reason: 'human_mode' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If we need AI-enhanced response
    if (responseText && LOVABLE_API_KEY && aiConfig.personality) {
      responseText = await enhanceWithAI(responseText, aiConfig, restaurant.name, message_text);
    }

    // Update conversation state
    await supabase
      .from('whatsapp_conversations')
      .update({ current_step: newStep, last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);

    // Send via WhatsApp (unless simulating)
    if (!simulate && responseText) {
      const { data: whatsappConfig } = await supabase
        .from('whatsapp_config')
        .select('instance_name, instance_status')
        .eq('restaurant_id', restaurant_id)
        .maybeSingle();

      if (whatsappConfig?.instance_status === 'connected') {
        await supabase.functions.invoke('whatsapp-send', {
          body: {
            restaurant_id,
            to: customer_phone,
            message: responseText
          }
        });
      }
    }

    return new Response(JSON.stringify({ 
      response: responseText, 
      step: newStep,
      simulated: !!simulate 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    console.error('[AI-BOT ERROR]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function buildWelcomeMessage(
  aiConfig: any, restaurantName: string, menuLink: string, menuOptions: any[]
): string {
  const type = aiConfig.welcome_message_type || 'numeric_menu';

  if (type === 'custom' && aiConfig.custom_welcome_message) {
    return aiConfig.custom_welcome_message.replace('{{link_cardapio}}', menuLink).replace('{{nome_restaurante}}', restaurantName);
  }

  if (type === 'link_only') {
    return `🍽️ *${restaurantName}*\n\nAcesse nosso cardápio digital:\n${menuLink}`;
  }

  if (type === 'free_flow') {
    return `Olá! 👋 Bem-vindo ao *${restaurantName}*! Como posso te ajudar hoje?\n\n📱 Cardápio: ${menuLink}`;
  }

  // numeric_menu (default)
  let msg = `👋 Olá! Bem-vindo ao *${restaurantName}*!\n\n📱 Cardápio: ${menuLink}\n\nDigite o número da opção desejada:\n`;
  for (const opt of menuOptions) {
    msg += `\n*${opt.position}* - ${opt.label}`;
  }
  return msg;
}

async function processMenuChoice(
  messageText: string,
  menuOptions: any[],
  restaurant: any,
  aiConfig: any,
  supabase: any,
  restaurantId: string,
  menuLink: string,
  customerPhone: string
): Promise<{ response: string; newStep: string }> {
  const trimmed = messageText.trim();
  const chosenNumber = parseInt(trimmed);
  const matched = menuOptions.find(o => o.position === chosenNumber);

  if (!matched) {
    // Fallback: resend menu
    let msg = `Não entendi. Digite o número da opção desejada:\n`;
    for (const opt of menuOptions) {
      msg += `\n*${opt.position}* - ${opt.label}`;
    }
    return { response: msg, newStep: 'menu' };
  }

  switch (matched.action_type) {
    case 'send_menu':
      return {
        response: `📱 Acesse nosso cardápio digital:\n${menuLink}`,
        newStep: 'menu'
      };

    case 'order_status': {
      // Search recent orders by phone
      const { data: orders } = await supabase
        .from('orders')
        .select('id, status, created_at, total_amount')
        .eq('restaurant_id', restaurantId)
        .eq('delivery_phone', customerPhone)
        .order('created_at', { ascending: false })
        .limit(1);

      if (orders && orders.length > 0) {
        const order = orders[0];
        const statusMap: Record<string, string> = {
          pending: '⏳ Pendente',
          accepted: '✅ Aceito',
          preparing: '👨‍🍳 Em preparo',
          ready: '🔔 Pronto',
          out_for_delivery: '🛵 Saiu para entrega',
          delivered: '✅ Entregue',
          cancelled: '❌ Cancelado'
        };
        const statusText = statusMap[order.status] || order.status;
        return {
          response: `📦 Seu pedido mais recente:\n\nStatus: ${statusText}\nValor: R$ ${Number(order.total_amount).toFixed(2)}`,
          newStep: 'menu'
        };
      }
      return {
        response: `Não encontrei pedidos recentes para o seu número. Faça seu pedido pelo cardápio:\n${menuLink}`,
        newStep: 'menu'
      };
    }

    case 'business_hours': {
      const { data: hours } = await supabase
        .from('business_hours')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('day_of_week');

      const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      let msg = `🕐 *Horário de Funcionamento*\n`;
      if (hours) {
        for (const h of hours) {
          const day = dayNames[h.day_of_week] || `Dia ${h.day_of_week}`;
          if (h.is_open) {
            msg += `\n${day}: ${h.open_time?.slice(0, 5)} às ${h.close_time?.slice(0, 5)}`;
          } else {
            msg += `\n${day}: Fechado`;
          }
        }
      }
      return { response: msg, newStep: 'menu' };
    }

    case 'human_attendant':
      return {
        response: `👤 Transferindo para um atendente humano. Aguarde um momento, por favor!`,
        newStep: 'human'
      };

    case 'start_order':
      if (aiConfig.accept_orders_via_whatsapp) {
        return {
          response: `🛒 Acesse nosso cardápio e monte seu pedido:\n${menuLink}\n\nApós finalizar, confirmaremos aqui!`,
          newStep: 'menu'
        };
      }
      return {
        response: `📱 Faça seu pedido pelo cardápio digital:\n${menuLink}`,
        newStep: 'menu'
      };

    case 'custom_message':
      return {
        response: matched.custom_message || 'Mensagem não configurada.',
        newStep: 'menu'
      };

    default:
      return { response: `Opção não configurada.`, newStep: 'menu' };
  }
}

async function enhanceWithAI(
  baseResponse: string,
  aiConfig: any,
  restaurantName: string,
  userMessage: string
): string {
  if (!LOVABLE_API_KEY) return baseResponse;

  try {
    const personalityPrompt = PERSONALITY_PROMPTS[aiConfig.personality] || PERSONALITY_PROMPTS.friendly;
    const instructionsContext = aiConfig.instructions ? `\nInstruções específicas do restaurante: ${aiConfig.instructions}` : '';

    const response = await fetch(AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `Você é o atendente virtual do restaurante "${restaurantName}" no WhatsApp. ${personalityPrompt}${instructionsContext}

REGRAS IMPORTANTES:
- Mantenha a resposta curta (máximo 3-4 linhas)
- Use a informação base fornecida, apenas ajuste o tom
- NÃO invente informações que não estão na resposta base
- NÃO altere links, valores ou dados factuais
- Responda APENAS em português brasileiro
- Retorne APENAS o texto da mensagem, sem aspas ou formatação extra`
          },
          {
            role: 'user',
            content: `O cliente disse: "${userMessage}"\n\nResposta base para ajustar o tom:\n${baseResponse}`
          }
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      console.error('[AI] Gateway error:', response.status);
      return baseResponse;
    }

    const data = await response.json();
    const enhanced = data.choices?.[0]?.message?.content?.trim();
    return enhanced || baseResponse;
  } catch (e) {
    console.error('[AI] Enhancement failed:', e);
    return baseResponse;
  }
}
