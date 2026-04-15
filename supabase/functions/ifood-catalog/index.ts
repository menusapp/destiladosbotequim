import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const IFOOD_API = "https://merchant-api.ifood.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { restaurant_id } = await req.json();
    if (!restaurant_id) {
      return new Response(JSON.stringify({ error: "restaurant_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get iFood config
    const { data: config, error: cfgErr } = await supabase
      .from("ifood_config")
      .select("access_token, merchant_id")
      .eq("restaurant_id", restaurant_id)
      .single();

    if (cfgErr || !config?.access_token || !config?.merchant_id) {
      return new Response(
        JSON.stringify({ error: "iFood não configurado ou sem token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const headers = {
      Authorization: `Bearer ${config.access_token}`,
      "Content-Type": "application/json",
    };

    // 1. List catalogs
    const catalogsRes = await fetch(
      `${IFOOD_API}/catalog/v2.0/merchants/${config.merchant_id}/catalogs`,
      { headers }
    );

    if (!catalogsRes.ok) {
      const errText = await catalogsRes.text();
      console.error("Catalogs error:", catalogsRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar catálogos do iFood", detail: errText }),
        { status: catalogsRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const catalogs = await catalogsRes.json();
    console.log("Catalogs found:", catalogs.length || 0);

    const allCategories: any[] = [];

    // 2. For each catalog, get categories with items
    for (const catalog of catalogs) {
      const catalogId = catalog.catalogId || catalog.id;
      if (!catalogId) continue;

      const catRes = await fetch(
        `${IFOOD_API}/catalog/v2.0/merchants/${config.merchant_id}/catalogs/${catalogId}/categories`,
        { headers }
      );

      if (!catRes.ok) {
        console.error("Category fetch error for catalog", catalogId, await catRes.text());
        continue;
      }

      const categories = await catRes.json();

      for (const cat of categories) {
        const categoryName = cat.name || cat.friendlyName || "Sem Categoria";
        const items: any[] = [];

        // Items can be nested in category or need separate fetch
        if (cat.items && Array.isArray(cat.items)) {
          for (const item of cat.items) {
            items.push({
              name: item.name || item.description || "",
              description: item.description || item.additionalInfo || "",
              price: item.price?.value ?? item.unitPrice?.value ?? 0,
              image_url: item.imagePath || item.image || null,
            });
          }
        }

        // Also try unsold items endpoint for this category
        if (items.length === 0 && (cat.id || cat.categoryId)) {
          const itemsRes = await fetch(
            `${IFOOD_API}/catalog/v2.0/merchants/${config.merchant_id}/catalogs/${catalogId}/categories/${cat.id || cat.categoryId}/items`,
            { headers }
          );
          if (itemsRes.ok) {
            const fetchedItems = await itemsRes.json();
            for (const item of fetchedItems) {
              items.push({
                name: item.name || item.description || "",
                description: item.description || item.additionalInfo || "",
                price: item.price?.value ?? item.unitPrice?.value ?? 0,
                image_url: item.imagePath || item.image || null,
              });
            }
          }
        }

        if (items.length > 0) {
          allCategories.push({
            name: categoryName,
            items,
          });
        }
      }
    }

    console.log("Total categories with items:", allCategories.length);

    return new Response(JSON.stringify({ categories: allCategories }), {
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
