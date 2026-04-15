import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const CATALOG_API = "https://cw-marketplace.ifood.com.br/v1/merchants/restaurant";

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
    // Formats: 
    // https://www.ifood.com.br/delivery/cidade/nome-restaurante/UUID
    // https://www.ifood.com.br/delivery/cidade/nome-restaurante/UUID?param=value
    const uuidRegex = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    const match = url.match(uuidRegex);

    if (!match) {
      return new Response(
        JSON.stringify({ error: "Não foi possível identificar o restaurante no link. Cole o link completo do iFood." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const merchantId = match[1];
    console.log("Fetching catalog for merchant:", merchantId);

    // Fetch public catalog
    const catalogRes = await fetch(`${CATALOG_API}/${merchantId}/catalog`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "platform": "Desktop",
        "app_version": "9.0",
      },
    });

    if (!catalogRes.ok) {
      const errText = await catalogRes.text();
      console.error("Catalog error:", catalogRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar cardápio do iFood. Verifique se o link está correto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const catalog = await catalogRes.json();

    // Parse catalog structure
    // The public API returns { catalog: [{ code, name, itens: [...] }] } or similar
    const categories: { name: string; items: any[] }[] = [];

    // Try different response structures
    const menuSections = catalog.catalog || catalog.menu || catalog.data?.menu || [];

    for (const section of menuSections) {
      const categoryName = section.name || section.description || "Sem Categoria";
      const items: any[] = [];

      const sectionItems = section.itens || section.items || [];
      for (const item of sectionItems) {
        const price = item.unitPrice ?? item.unitMinPrice ?? item.price ?? 0;
        // Price comes in cents from public API
        const priceValue = price > 100 ? price / 100 : price;

        items.push({
          name: item.description || item.name || "",
          description: item.details || item.additionalInfo || "",
          price: priceValue,
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
      JSON.stringify({ error: "Erro interno", detail: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
