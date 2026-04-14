import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const cuisinePrompts: Record<string, string> = {
  pizzaria:
    "Este é um cardápio de PIZZARIA. Preste atenção especial a tamanhos (broto, pequena, média, grande, família/gigante), sabores e bordas. Cada sabor com seus tamanhos e preços deve virar um produto separado ou variações do mesmo produto.",
  hamburgueria:
    "Este é um cardápio de HAMBURGUERIA. Preste atenção a combos, acompanhamentos, tipos de hambúrguer, adicionais e tamanhos (simples, duplo, triplo).",
  acai:
    "Este é um cardápio de AÇAÍ/SORVETERIA. Preste atenção a tamanhos (em ml ou oz), coberturas, complementos e sabores.",
  sushi:
    "Este é um cardápio de SUSHI/COMIDA JAPONESA. Preste atenção a combos, quantidade de peças, tipos de sushi, temakis, pratos quentes e porções.",
  cafeteria:
    "Este é um cardápio de CAFETERIA. Preste atenção a bebidas quentes e frias, tamanhos, tipos de café, doces, salgados e combos.",
  outros:
    "Este é um cardápio de restaurante. Extraia todas as categorias, produtos, descrições e preços que conseguir identificar.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image_base64, cuisine_type, custom_cuisine } = await req.json();

    if (!image_base64) {
      return new Response(
        JSON.stringify({ error: "image_base64 é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cuisineContext =
      cuisinePrompts[cuisine_type] ||
      `Este é um cardápio de ${custom_cuisine || "restaurante"}. Extraia todas as categorias, produtos, descrições e preços.`;

    const systemPrompt = `Você é um especialista em digitalização de cardápios de restaurantes. Analise a foto do cardápio e extraia TODOS os produtos organizados por categoria.

${cuisineContext}

Regras:
- Extraia o nome exato dos produtos como estão no cardápio
- Extraia preços em formato numérico (ex: 25.90)
- Se houver descrição/ingredientes do produto, inclua
- Se um produto tem variações de tamanho com preços diferentes, liste como produtos separados (ex: "Pizza Calabresa - Grande" e "Pizza Calabresa - Média")
- Organize por categorias lógicas como aparecem no cardápio
- Se o preço não estiver visível ou legível, use 0
- NÃO invente produtos que não estão na imagem`;

    // Detect mime type from base64 header or default to jpeg
    let mimeType = "image/jpeg";
    let cleanBase64 = image_base64;
    if (image_base64.startsWith("data:")) {
      const match = image_base64.match(/^data:(image\/\w+);base64,/);
      if (match) {
        mimeType = match[1];
        cleanBase64 = image_base64.split(",")[1];
      }
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${cleanBase64}`,
                  },
                },
                {
                  type: "text",
                  text: "Analise este cardápio e extraia todos os produtos usando a função extract_menu.",
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_menu",
                description:
                  "Extrai categorias e produtos de um cardápio fotografado",
                parameters: {
                  type: "object",
                  properties: {
                    categories: {
                      type: "array",
                      description: "Lista de categorias do cardápio",
                      items: {
                        type: "object",
                        properties: {
                          name: {
                            type: "string",
                            description: "Nome da categoria (ex: Pizzas, Bebidas, Sobremesas)",
                          },
                          products: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                name: {
                                  type: "string",
                                  description: "Nome do produto",
                                },
                                description: {
                                  type: "string",
                                  description:
                                    "Descrição ou ingredientes do produto",
                                },
                                price: {
                                  type: "number",
                                  description:
                                    "Preço do produto em reais (0 se não visível)",
                                },
                              },
                              required: ["name", "price"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["name", "products"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["categories"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_menu" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar imagem com IA" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "IA não retornou dados estruturados" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const menuData = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(menuData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("digitize-menu error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
