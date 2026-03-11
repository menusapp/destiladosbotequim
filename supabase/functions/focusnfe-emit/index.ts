import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { order_id, restaurant_id, online_payment_id } = await req.json();

    if (!order_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: "order_id e restaurant_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Platform-level token (NOT per-restaurant)
    const focusToken = Deno.env.get("FOCUSNFE_API_TOKEN");
    const focusEnv = Deno.env.get("FOCUSNFE_ENVIRONMENT") || "homologation";

    if (!focusToken) {
      console.error("[FocusNFe] FOCUSNFE_API_TOKEN not configured");
      return new Response(
        JSON.stringify({ error: "Token Focus NFe não configurado na plataforma" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const focusBaseUrl =
      focusEnv === "production"
        ? "https://api.focusnfe.com.br"
        : "https://homologacao.focusnfe.com.br";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch restaurant fiscal data
    const { data: restaurant, error: restError } = await supabase
      .from("restaurants")
      .select("name, cnpj, inscricao_estadual, razao_social, endereco_fiscal, municipio_codigo, uf")
      .eq("id", restaurant_id)
      .single();

    if (restError || !restaurant) {
      console.error("[FocusNFe] Restaurant not found:", restError);
      return new Response(
        JSON.stringify({ error: "Restaurante não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!restaurant.cnpj) {
      console.warn("[FocusNFe] Restaurant has no CNPJ, skipping NFC-e");
      return new Response(
        JSON.stringify({ error: "CNPJ do restaurante não configurado", skipped: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order with items
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, customer_name, customer_cpf, created_at, delivery_fee")
      .eq("id", order_id)
      .single();

    if (orderError || !order) {
      console.error("[FocusNFe] Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order items with product names and fiscal data
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("quantity, price_at_order, notes, product_id, products(name, pdv_code, fiscal_ncm, fiscal_cest, fiscal_cfop, fiscal_icms_csosn, fiscal_icms_origin, fiscal_pis_cst, fiscal_cofins_cst)")
      .eq("order_id", order_id);

    if (itemsError) {
      console.error("[FocusNFe] Items error:", itemsError);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar itens do pedido" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch order item extras
    const orderItemIds = (orderItems || []).map((i: any) => i.id).filter(Boolean);

    // Build NFC-e items
    const ncmRestaurante = "2106.90.90"; // NCM genérico para refeições
    const cfop = "5102"; // Venda de mercadoria dentro do estado

    const nfceItems = (orderItems || []).map((item: any, index: number) => ({
      numero_item: String(index + 1),
      codigo_produto: item.product_id || `PROD-${index + 1}`,
      descricao: item.products?.name || `Item ${index + 1}`,
      quantidade: String(item.quantity),
      unidade_comercial: "UN",
      valor_unitario_comercial: item.price_at_order.toFixed(2),
      valor_unitario_tributavel: item.price_at_order.toFixed(2),
      codigo_ncm: ncmRestaurante.replace(/\./g, ""),
      cfop,
      unidade_tributavel: "UN",
      quantidade_tributavel: String(item.quantity),
      valor_bruto: (item.quantity * item.price_at_order).toFixed(2),
      icms_situacao_tributaria: "102", // Simples Nacional
      icms_origem: "0",
      pis_situacao_tributaria: "49",
      cofins_situacao_tributaria: "49",
    }));

    // Calculate totals
    const totalProdutos = (orderItems || []).reduce(
      (acc: number, item: any) => acc + item.quantity * item.price_at_order,
      0
    );

    // Build NFC-e reference
    const ref = `nfce-${order_id.substring(0, 8)}-${Date.now()}`;

    // NFC-e payload
    const nfcePayload: Record<string, any> = {
      natureza_operacao: "VENDA AO CONSUMIDOR",
      tipo_documento: "1", // Saída
      finalidade_emissao: "1", // Normal
      presenca_comprador: "1", // Presencial
      consumidor_final: "1",
      cnpj_emitente: restaurant.cnpj.replace(/\D/g, ""),
      nome_emitente: restaurant.razao_social || restaurant.name,
      inscricao_estadual_emitente: restaurant.inscricao_estadual?.replace(/\D/g, "") || "",
      uf_emitente: restaurant.uf || "SP",
      modalidade_frete: "9", // Sem frete
      informacoes_adicionais_contribuinte: `Pedido: ${order_id}`,
      items: nfceItems,
      formas_pagamento: [
        {
          forma_pagamento: "99", // Outros (pagamento online)
          valor_pagamento: totalProdutos.toFixed(2),
        },
      ],
    };

    // Add customer CPF if available
    if (order.customer_cpf) {
      const cpfClean = order.customer_cpf.replace(/\D/g, "");
      if (cpfClean.length === 11) {
        nfcePayload.cpf_destinatario = cpfClean;
        nfcePayload.nome_destinatario = order.customer_name || "CONSUMIDOR";
      }
    }

    console.log("[FocusNFe] Emitting NFC-e ref:", ref, "for restaurant CNPJ:", restaurant.cnpj);

    // Send to Focus NFe API
    const focusResponse = await fetch(`${focusBaseUrl}/v2/nfce?ref=${ref}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${focusToken}:`)}`,
      },
      body: JSON.stringify(nfcePayload),
    });

    const focusResult = await focusResponse.json();
    console.log("[FocusNFe] API response:", JSON.stringify(focusResult));

    if (!focusResponse.ok && focusResponse.status !== 202) {
      return new Response(
        JSON.stringify({
          error: "Erro na emissão da NFC-e",
          focus_response: focusResult,
        }),
        { status: focusResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        ref,
        focus_status: focusResult.status || "processing",
        focus_response: focusResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[FocusNFe] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
