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

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toReadableUrlProxy(url: string) {
  return `https://r.jina.ai/http://${url}`;
}

/** Extract image URLs from HTML, resolving relative paths */
function extractImageUrls(html: string, baseUrl: string): Map<string, string[]> {
  const imageMap = new Map<string, string[]>();
  
  // Match img tags with src and nearby text context
  const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*(?:alt=["']([^"']*)["'])?[^>]*>/gi;
  let match;
  const allImages: { src: string; alt: string }[] = [];
  
  while ((match = imgRegex.exec(html)) !== null) {
    let src = match[1];
    const alt = match[2] || "";
    
    // Skip tiny icons, svgs, tracking pixels, base64 data URIs
    if (
      src.includes("data:image/svg") ||
      src.includes(".svg") ||
      src.includes("icon") ||
      src.includes("logo") ||
      src.includes("favicon") ||
      src.includes("pixel") ||
      src.includes("tracker") ||
      src.includes("1x1") ||
      src.startsWith("data:image/gif") ||
      src.length > 2000 // skip very long base64
    ) continue;
    
    // Resolve relative URLs
    try {
      if (src.startsWith("//")) {
        src = "https:" + src;
      } else if (src.startsWith("/")) {
        const urlObj = new URL(baseUrl);
        src = urlObj.origin + src;
      } else if (!src.startsWith("http")) {
        src = new URL(src, baseUrl).href;
      }
    } catch {
      continue;
    }
    
    allImages.push({ src, alt });
  }
  
  // Also try background-image CSS
  const bgRegex = /background-image:\s*url\(["']?([^"')]+)["']?\)/gi;
  while ((match = bgRegex.exec(html)) !== null) {
    let src = match[1];
    if (src.startsWith("data:") || src.includes(".svg")) continue;
    try {
      if (src.startsWith("//")) src = "https:" + src;
      else if (src.startsWith("/")) {
        const urlObj = new URL(baseUrl);
        src = urlObj.origin + src;
      } else if (!src.startsWith("http")) {
        src = new URL(src, baseUrl).href;
      }
    } catch { continue; }
    allImages.push({ src, alt: "" });
  }
  
  // Build a simple list for AI context
  imageMap.set("_all", allImages.map(i => i.src));
  
  return imageMap;
}

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
                      image_url: { type: "string", description: "URL completa da imagem do produto, se disponível no HTML. Deixe vazio se não houver." },
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

    // Extract image URLs from raw HTML before stripping tags
    const isComplements = mode === "complements";
    const imageUrls = !isComplements ? extractImageUrls(pageContent, url) : new Map();
    const allImagesList = imageUrls.get("_all") || [];
    console.log(`Found ${allImagesList.length} product-candidate images`);

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

    // For products mode, also keep a version with img tags preserved for context
    let htmlWithImages = "";
    if (!isComplements && allImagesList.length > 0) {
      // Extract relevant HTML sections that contain both images and text (product cards)
      // Keep img tags inline but strip everything else
      htmlWithImages = pageContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        // Keep img tags
        .replace(/<(?!img\b)[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&#?\w+;/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    // Limit content size to avoid token limits
    const maxChars = 30000;
    const truncatedContent = cleanedContent.length > maxChars
      ? cleanedContent.substring(0, maxChars) + "... [conteúdo truncado]"
      : cleanedContent;

    // Build image context for AI
    let imageContext = "";
    if (!isComplements && allImagesList.length > 0) {
      const limitedImages = allImagesList.slice(0, 100); // Max 100 images
      imageContext = `\n\nIMAGENS ENCONTRADAS NO SITE (URLs de imagens que podem ser de produtos):\n${limitedImages.map((u, i) => `[IMG${i + 1}] ${u}`).join("\n")}`;
      
      // Also include the HTML with images for better context matching
      if (htmlWithImages.length > 0) {
        const truncatedHtmlImages = htmlWithImages.length > 15000
          ? htmlWithImages.substring(0, 15000) + "..."
          : htmlWithImages;
        imageContext += `\n\nHTML COM IMAGENS (para associar cada imagem ao produto correto):\n${truncatedHtmlImages}`;
      }
    }

    if (truncatedContent.length < 50) {
      return new Response(
        JSON.stringify({ error: "Não foi possível extrair conteúdo do site. O site pode usar JavaScript para renderizar (SPA) ou estar protegido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Content length:", truncatedContent.length, "Image context length:", imageContext.length);

    // Step 2: Send to AI for extraction
    const cuisineContext = isComplements
      ? (complementCuisinePrompts[cuisine_type] || `Foque em COMPLEMENTOS de ${custom_cuisine || "restaurante"}.`)
      : (cuisinePrompts[cuisine_type] || `Este é um cardápio de ${custom_cuisine || "restaurante"}. Extraia tudo.`);

    const imageInstructions = !isComplements && allImagesList.length > 0
      ? `\n- IMPORTANTE: Associe a URL da imagem correta a cada produto usando o campo image_url. Analise o HTML com imagens para identificar qual imagem pertence a qual produto (geralmente a imagem aparece próxima ao nome do produto no HTML). Use a URL completa da imagem. Se não conseguir associar com certeza, deixe o campo vazio.`
      : "";

    const systemPrompt = isComplements
      ? `Você é um especialista em digitalização de cardápios. Analise o texto do cardápio digital e extraia APENAS COMPLEMENTOS/ADICIONAIS.\n\n${cuisineContext}\n\nRegras:\n- Extraia APENAS itens complementares/adicionais, NÃO produtos principais\n- Organize por categorias lógicas\n- Extraia preços em formato numérico (ex: 3.50)\n- Se o preço não estiver visível, use 0\n- NÃO invente itens que não estão no texto`
      : `Você é um especialista em digitalização de cardápios. Analise o texto do cardápio digital e extraia TODOS os produtos organizados por categoria.\n\n${cuisineContext}\n\nRegras:\n- Extraia o nome exato dos produtos\n- Extraia preços em formato numérico (ex: 25.90)\n- Se houver descrição/ingredientes, inclua\n- Se um produto tem variações de tamanho com preços diferentes, liste como produtos separados\n- Organize por categorias lógicas\n- Se o preço não estiver visível, use 0\n- NÃO invente produtos que não estão no texto${imageInstructions}`;

    const tool = isComplements ? getComplementsTool() : getProductsTool();

    const userContent = `Analise o seguinte conteúdo de cardápio digital extraído de ${url} e extraia os ${isComplements ? "complementos/adicionais" : "produtos"} usando a função extract_menu:\n\n${truncatedContent}${imageContext}`;

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
            { role: "user", content: userContent },
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
