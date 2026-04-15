import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ error: "url é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract merchant ID from iFood URL
    const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    const match = url.match(uuidRegex);

    if (!match) {
      return new Response(
        JSON.stringify({ error: "Não foi possível identificar o restaurante no link. Cole o link completo do iFood." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const merchantId = match[1];
    console.log("Fetching page for merchant:", merchantId);

    // Normalize URL to ensure we fetch the correct page
    let pageUrl = url.trim();
    if (!pageUrl.startsWith("http")) {
      pageUrl = "https://" + pageUrl;
    }

    // Fetch the iFood page HTML
    const pageRes = await fetch(pageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
      },
      redirect: "follow",
    });

    if (!pageRes.ok) {
      console.error("Page fetch error:", pageRes.status);
      return new Response(
        JSON.stringify({ error: "Não foi possível acessar a página do iFood. Tente novamente." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await pageRes.text();
    console.log("HTML length:", html.length);

    // Try to extract __NEXT_DATA__
    let menuData: any = null;

    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        console.log("Found __NEXT_DATA__, keys:", Object.keys(nextData.props?.pageProps || {}));
        
        // The menu is typically in pageProps
        const pageProps = nextData.props?.pageProps;
        if (pageProps) {
          // Try different possible structures
          menuData = pageProps.merchant?.menu 
            || pageProps.catalog 
            || pageProps.menu 
            || pageProps.merchantExtra?.catalog?.menu;
          
          // Also check for initialMenuState or similar
          if (!menuData && pageProps.initialState) {
            menuData = pageProps.initialState.merchant?.menu 
              || pageProps.initialState.catalog;
          }
        }
      } catch (e) {
        console.error("Error parsing __NEXT_DATA__:", e);
      }
    }

    // Also try extracting from window.__APOLLO_STATE__ or similar embedded state
    if (!menuData) {
      const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/);
      if (apolloMatch) {
        try {
          const apolloState = JSON.parse(apolloMatch[1]);
          console.log("Found Apollo state");
          // Extract menu items from Apollo state
          const items: any[] = [];
          for (const [key, value] of Object.entries(apolloState)) {
            if (key.startsWith("MenuItem:") && typeof value === "object" && value !== null) {
              items.push(value);
            }
          }
          if (items.length > 0) {
            menuData = items;
          }
        } catch (e) {
          console.error("Error parsing Apollo state:", e);
        }
      }
    }

    // Try extracting from any JSON-LD or embedded catalog data
    if (!menuData) {
      const catalogJsonMatch = html.match(/"catalog"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
      if (catalogJsonMatch) {
        try {
          menuData = JSON.parse(catalogJsonMatch[1]);
          console.log("Found embedded catalog JSON");
        } catch (e) {
          // Not valid JSON, skip
        }
      }
    }

    // Try the marketplace API with different headers as fallback
    if (!menuData) {
      console.log("Trying marketplace API as fallback...");
      
      const apiEndpoints = [
        `https://marketplace.ifood.com.br/v1/merchants/${merchantId}/catalog`,
        `https://cw-marketplace.ifood.com.br/v1/merchants/restaurant/${merchantId}/catalog`,
      ];

      for (const endpoint of apiEndpoints) {
        try {
          const apiRes = await fetch(endpoint, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
              "Accept": "application/json, text/plain, */*",
              "Accept-Language": "pt-BR,pt;q=0.9",
              "Origin": "https://www.ifood.com.br",
              "Referer": "https://www.ifood.com.br/",
              "platform": "Desktop",
              "app_version": "9.101.0",
              "browser": "Chrome",
            },
          });

          if (apiRes.ok) {
            const apiData = await apiRes.json();
            menuData = apiData.catalog || apiData.menu || apiData;
            console.log("API fallback worked with endpoint:", endpoint);
            break;
          } else {
            console.log("API endpoint failed:", endpoint, apiRes.status);
          }
        } catch (e) {
          console.log("API endpoint error:", endpoint, e);
        }
      }
    }

    if (!menuData) {
      // Log a snippet of the HTML for debugging
      console.log("HTML snippet (first 2000 chars):", html.substring(0, 2000));
      console.log("Could not find menu data in page");
      
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível extrair o cardápio desta página. O iFood pode estar bloqueando o acesso automático. Tente usar a importação por foto (IA) como alternativa.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse menu data into categories
    const categories: { name: string; items: any[] }[] = [];

    // Handle array format (catalog sections)
    const sections = Array.isArray(menuData) ? menuData : [menuData];

    for (const section of sections) {
      const categoryName = section.name || section.description || section.categoryName || "Sem Categoria";
      const sectionItems = section.itens || section.items || section.products || [];
      const items: any[] = [];

      for (const item of sectionItems) {
        let price = item.unitPrice ?? item.unitMinPrice ?? item.price ?? 0;
        // iFood sometimes returns price in cents
        if (price > 1000) price = price / 100;

        items.push({
          name: item.description || item.name || item.title || "",
          description: item.details || item.additionalInfo || item.itemDescription || "",
          price,
          image_url: item.logoUrl || item.imageUrl || item.image || null,
        });
      }

      if (items.length > 0) {
        categories.push({ name: categoryName, items });
      }
    }

    console.log("Parsed categories:", categories.length, "total items:", categories.reduce((a, c) => a + c.items.length, 0));

    return new Response(JSON.stringify({ categories }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ifood-catalog error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno ao processar o cardápio. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
