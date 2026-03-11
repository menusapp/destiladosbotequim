import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getNuvemFiscalToken(): Promise<string> {
  const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
  const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Nuvem Fiscal não configuradas (NUVEM_FISCAL_CLIENT_ID / NUVEM_FISCAL_CLIENT_SECRET)");
  }

  const tokenRes = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "empresa cep cnpj nfce",
      audience: "https://api.sandbox.nuvemfiscal.com.br/",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`OAuth falhou (${tokenRes.status}): ${tokenData.error_description || tokenData.error || "desconhecido"}`);
  }

  return tokenData.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { order_id, restaurant_id, fiscal_note_id } = await req.json();

    if (!order_id || !restaurant_id) {
      return new Response(
        JSON.stringify({ error: "order_id e restaurant_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch fiscal config
    const { data: config, error: configErr } = await supabase
      .from("fiscal_configs")
      .select("*")
      .eq("restaurant_id", restaurant_id)
      .maybeSingle();

    if (configErr || !config) {
      const errMsg = "Configuração fiscal não encontrada. Configure os dados fiscais primeiro.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg }, 200);
    }

    if (!config.cnpj) {
      const errMsg = "CNPJ não configurado nos dados fiscais.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg }, 200);
    }

    // 2. Fetch order
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, customer_name, customer_cpf, created_at, delivery_fee")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      const errMsg = "Pedido não encontrado.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg }, 200);
    }

    // 3. Fetch order items with product fiscal data
    const { data: orderItems, error: itemsErr } = await supabase
      .from("order_items")
      .select(`
        id, quantity, price_at_order, notes, product_id,
        products (name, pdv_code, fiscal_ncm, fiscal_cest, fiscal_cfop, fiscal_icms_csosn, fiscal_icms_origin, fiscal_pis_cst, fiscal_cofins_cst),
        order_item_extras (price_at_order, product_extra_id, product_extras (name))
      `)
      .eq("order_id", order_id);

    if (itemsErr) {
      const errMsg = `Erro ao buscar itens: ${itemsErr.message}`;
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg }, 200);
    }

    if (!orderItems || orderItems.length === 0) {
      const errMsg = "Pedido sem itens.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg }, 200);
    }

    // 4. Get OAuth token
    let accessToken: string;
    try {
      accessToken = await getNuvemFiscalToken();
    } catch (e: any) {
      await updateNoteStatus(supabase, fiscal_note_id, "error", e.message);
      return jsonResponse({ error: e.message }, 200);
    }

    // 5. Build NFC-e items
    const ncmDefault = "21069090";
    const cfopDefault = "5102";
    let itemNumber = 1;
    const nfceItems: any[] = [];

    for (const item of orderItems) {
      const prod = (item as any).products;
      // Main product
      nfceItems.push({
        numero_item: String(itemNumber++),
        codigo_produto: prod?.pdv_code || item.product_id || `PROD-${itemNumber}`,
        descricao: prod?.name || `Item ${itemNumber}`,
        quantidade: item.quantity,
        unidade_comercial: "UN",
        valor_unitario_comercial: Number(item.price_at_order.toFixed(2)),
        valor_unitario_tributavel: Number(item.price_at_order.toFixed(2)),
        codigo_ncm: (prod?.fiscal_ncm || ncmDefault).replace(/\./g, ""),
        cfop: prod?.fiscal_cfop || cfopDefault,
        unidade_tributavel: "UN",
        quantidade_tributavel: item.quantity,
        valor_bruto: Number((item.quantity * item.price_at_order).toFixed(2)),
        icms: {
          situacao_tributaria: prod?.fiscal_icms_csosn || "102",
          origem: Number(prod?.fiscal_icms_origin || "0"),
        },
        pis: {
          situacao_tributaria: prod?.fiscal_pis_cst || "49",
        },
        cofins: {
          situacao_tributaria: prod?.fiscal_cofins_cst || "49",
        },
      });

      // Extras as separate items
      const extras = (item as any).order_item_extras || [];
      for (const extra of extras) {
        const extraName = extra.product_extras?.name || "Adicional";
        nfceItems.push({
          numero_item: String(itemNumber++),
          codigo_produto: extra.product_extra_id || `EXTRA-${itemNumber}`,
          descricao: `${extraName} (${prod?.name || "Item"})`,
          quantidade: item.quantity,
          unidade_comercial: "UN",
          valor_unitario_comercial: Number(extra.price_at_order.toFixed(2)),
          valor_unitario_tributavel: Number(extra.price_at_order.toFixed(2)),
          codigo_ncm: ncmDefault,
          cfop: cfopDefault,
          unidade_tributavel: "UN",
          quantidade_tributavel: item.quantity,
          valor_bruto: Number((item.quantity * extra.price_at_order).toFixed(2)),
          icms: { situacao_tributaria: "102", origem: 0 },
          pis: { situacao_tributaria: "49" },
          cofins: { situacao_tributaria: "49" },
        });
      }
    }

    const totalProdutos = nfceItems.reduce((acc, i) => acc + i.valor_bruto, 0);

    // 6. Build NFC-e payload
    const cpfCnpj = config.cnpj.replace(/\D/g, "");
    const ref = `nfce-${order_id.substring(0, 8)}-${Date.now()}`;

    const nfcePayload: Record<string, any> = {
      natureza_operacao: "VENDA AO CONSUMIDOR",
      tipo_documento: 1,
      finalidade_emissao: 1,
      presenca_comprador: 1,
      consumidor_final: 1,
      modalidade_frete: 9,
      informacoes_adicionais_contribuinte: `Pedido: ${order_id}`,
      emitente: {
        cpf_cnpj: cpfCnpj,
        nome_razao_social: config.razao_social || config.nome_fantasia,
        nome_fantasia: config.nome_fantasia || config.razao_social,
        inscricao_estadual: config.inscricao_estadual?.replace(/\D/g, "") || "",
        endereco: {
          logradouro: config.logradouro || "",
          numero: config.numero || "S/N",
          bairro: config.bairro || "",
          codigo_municipio: config.municipio_codigo || "",
          nome_municipio: "",
          uf: config.uf || "SP",
          cep: config.cep?.replace(/\D/g, "") || "",
        },
      },
      items: nfceItems,
      pagamentos: [
        {
          forma_pagamento: "99",
          valor_pagamento: Number(totalProdutos.toFixed(2)),
        },
      ],
    };

    // Add customer CPF if available
    if (order.customer_cpf) {
      const cpfClean = order.customer_cpf.replace(/\D/g, "");
      if (cpfClean.length === 11) {
        nfcePayload.destinatario = {
          cpf_cnpj: cpfClean,
          nome: order.customer_name || "CONSUMIDOR",
        };
      }
    }

    console.log("[NuvemFiscal] Emitting NFC-e ref:", ref, "CNPJ:", cpfCnpj);

    // 7. Send to Nuvem Fiscal API
    const baseUrl = "https://api.sandbox.nuvemfiscal.com.br";
    const apiResponse = await fetch(`${baseUrl}/nfce`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nfcePayload),
    });

    const apiResult = await apiResponse.json();
    console.log("[NuvemFiscal] API response status:", apiResponse.status, JSON.stringify(apiResult).substring(0, 500));

    if (!apiResponse.ok && apiResponse.status !== 202) {
      const errMsg = apiResult?.error?.message || apiResult?.message || JSON.stringify(apiResult).substring(0, 300);
      await updateNoteStatus(supabase, fiscal_note_id, "error", `Erro Nuvem Fiscal (${apiResponse.status}): ${errMsg}`);
      return jsonResponse({ error: errMsg, nuvem_response: apiResult }, 200);
    }

    // 8. Update fiscal note with result
    const nfceStatus = apiResult.status || "processing";
    const mappedStatus = nfceStatus === "autorizada" ? "authorized" : nfceStatus === "rejeitada" ? "error" : "processing";

    const updateData: Record<string, any> = {
      status: mappedStatus,
      nuvem_fiscal_ref: ref,
    };

    if (apiResult.numero) updateData.nfe_number = String(apiResult.numero);
    if (apiResult.chave) updateData.nfe_key = apiResult.chave;
    if (nfceStatus === "rejeitada") {
      updateData.error_message = apiResult.motivo_status || "Nota rejeitada pela SEFAZ";
    }

    if (fiscal_note_id) {
      await supabase.from("order_fiscal_notes").update(updateData).eq("id", fiscal_note_id);
    } else {
      // Find by order_id
      await supabase.from("order_fiscal_notes").update(updateData).eq("order_id", order_id).eq("restaurant_id", restaurant_id);
    }

    return jsonResponse({
      success: true,
      ref,
      status: mappedStatus,
      nuvem_response: apiResult,
    });
  } catch (error: any) {
    console.error("[NuvemFiscal] Error:", error);
    return jsonResponse({ error: error.message || "Erro interno" }, 500);
  }
});

async function updateNoteStatus(supabase: any, fiscalNoteId: string | undefined, status: string, errorMessage?: string) {
  if (!fiscalNoteId) return;
  const data: Record<string, any> = { status };
  if (errorMessage) data.error_message = errorMessage;
  await supabase.from("order_fiscal_notes").update(data).eq("id", fiscalNoteId);
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
