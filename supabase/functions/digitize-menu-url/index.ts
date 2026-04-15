import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const cuisinePrompts: Record<string, string> = {
  pizzaria: "Este é um cardápio de PIZZARIA. Preste atenção especial a tamanhos, sabores e bordas.",
  hamburgueria: "Este é um cardápio de HAMBURGUERIA. Preste atenção a combos, acompanhamentos e tamanhos.",
  acai: "Este é um cardápio de AÇAÍ/SORVETERIA. Preste atenção a tamanhos, coberturas e complementos.",
  sushi: "Este é um cardápio de SUSHI/COMIDA JAPONESA. Preste atenção a combos, quantidade de peças e tipos.",
  cafeteria: "Este é um cardápio de CAFETERIA. Preste atenção a bebidas, tamanhos, doces e salgados.",
  outros: "Este é um cardápio de restaurante. Extraia todas as categorias, produtos, descrições e preços.",
};

const complementCuisinePrompts: Record<string, string> = {
  pizzaria: "Foque em COMPLEMENTOS de PIZZARIA: bordas recheadas, ingredientes extras, molhos.",
  hamburgueria: "Foque em COMPLEMENTOS de HAMBURGUERIA: bacon extra, queijo extra, molhos especiais.",
  acai: "Foque em COMPLEMENTOS de AÇAÍ: coberturas, frutas extras, granola, caldas.",
  sushi: "Foque em COMPLEMENTOS de SUSHI: molhos, wasabi extra, gengibre.",
  cafeteria: "Foque em COMPLEMENTOS de CAFETERIA: leite extra, chantilly, shots de café.",
  outros: "Foque em itens COMPLEMENTARES: ingredientes extras, molhos, acompanhamentos adicionais.",
};

function getProductsTool() {
  return {
    type: "function",
    function: {
      name: "extract_menu",
      description: "Extrai categorias e produtos de um cardápio digital",
      parameters: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome da categoria" },
                products: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nome do produto" },
                      description: { type: "string", description: "Descrição ou ingredientes" },
                      price: { type: "number", description: "Preço em reais (0 se não visível)" },
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
  };
}

function getComplementsTool() {
  return {
    type: "function",
    function: {
      name: "extract_menu",
      description: "Extrai categorias de complementos/adicionais de um cardápio digital",
      parameters: {
        type: "object",
        properties: {
          categories: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Nome da categoria de complemento" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Nome do item complementar" },
                      description: { type: "string", description: "Descrição do item" },
                      price: { type: "number", description: "Preço em reais (0 se não visível)" },
                    },
                    required: ["name", "price"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["name", "items"],
              additionalProperties: false,
            },
          },
        },
        required: ["categories"],
        additionalProperties: false,
      },
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, cuisine_type, custom_cuisine, mode } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: "URL inválida" }),
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

    // Step 1: Fetch the webpage content
    console.log("Fetching URL:", url);
    let pageContent: string;
    try {
      const pageResp = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        },
        redirect: "follow",
      });

      if (!pageResp.ok) {
        return new Response(
          JSON.stringify({ error: `Não foi possível acessar o site (HTTP ${pageResp.status})` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      pageContent = await pageResp.text();
    } catch (fetchErr) {
      console.error("Fetch error:", fetchErr);
      return new Response(
        JSON.stringify({ error: "Não foi possível acessar o site. Verifique se o link está correto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Strip HTML tags and scripts to get clean text, but keep structure
    const cleanedContent = pageContent
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#?\w+;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Limit content size to avoid token limits
    const maxChars = 30000;
    const truncatedContent = cleanedContent.length > maxChars
      ? cleanedContent.substring(0, maxChars) + "... [conteúdo truncado]"
      : cleanedContent;

    if (truncatedContent.length < 50) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair conteúdo do site. O site pode usar JavaScript para renderizar (SPA) ou estar protegido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Content length:", truncatedContent.length);

    // Step 2: Send to AI for extraction
    const isComplements = mode === "complements";

    const cuisineContext = isComplements
      ? (complementCuisinePrompts[cuisine_type] || `Foque em COMPLEMENTOS de ${custom_cuisine || "restaurante"}.`)
      : (cuisinePrompts[cuisine_type] || `Este é um cardápio de ${custom_cuisine || "restaurante"}. Extraia tudo.`);

    const systemPrompt = isComplements
      ? `Você é um especialista em digitalização de cardápios. Analise o texto do cardápio digital e extraia APENAS COMPLEMENTOS/ADICIONAIS.\n\n${cuisineContext}\n\nRegras:\n- Extraia APENAS itens complementares/adicionais, NÃO produtos principais\n- Organize por categorias lógicas\n- Extraia preços em formato numérico (ex: 3.50)\n- Se o preço não estiver visível, use 0\n- NÃO invente itens que não estão no texto`
      : `Você é um especialista em digitalização de cardápios. Analise o texto do cardápio digital e extraia TODOS os produtos organizados por categoria.\n\n${cuisineContext}\n\nRegras:\n- Extraia o nome exato dos produtos\n- Extraia preços em formato numérico (ex: 25.90)\n- Se houver descrição/ingredientes, inclua\n- Se um produto tem variações de tamanho com preços diferentes, liste como produtos separados\n- Organize por categorias lógicas\n- Se o preço não estiver visível, use 0\n- NÃO invente produtos que não estão no texto`;

    const tool = isComplements ? getComplementsTool() : getProductsTool();

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
              content: `Analise o seguinte conteúdo de cardápio digital extraído de ${url} e extraia os ${isComplements ? "complementos/adicionais" : "produtos"} usando a função extract_menu:\n\n${truncatedContent}`,
            },
          ],
          tools: [tool],
          tool_choice: { type: "function", function: { name: "extract_menu" } },
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
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI Gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao processar com IA" }),
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
    console.error("digitize-menu-url error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
