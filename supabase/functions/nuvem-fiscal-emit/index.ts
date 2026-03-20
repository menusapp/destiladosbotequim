import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getNuvemFiscalToken(): Promise<string> {
  const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
  const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Nuvem Fiscal não configuradas");
  }

  const tokenRes = await fetch("https://auth.nuvemfiscal.com.br/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "empresa cep cnpj nfce",
      audience: "https://api.nuvemfiscal.com.br/",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`OAuth falhou (${tokenRes.status}): ${tokenData.error_description || tokenData.error || "desconhecido"}`);
  }

  return tokenData.access_token;
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateNoteStatus(supabase: any, fiscalNoteId: string | undefined, status: string, errorMessage?: string) {
  if (!fiscalNoteId) return;
  const data: Record<string, any> = { status };
  if (errorMessage) data.error_message = errorMessage;
  await supabase.from("order_fiscal_notes").update(data).eq("id", fiscalNoteId);
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
      return jsonResponse({ error: "order_id e restaurant_id são obrigatórios" }, 400);
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
      return jsonResponse({ error: errMsg });
    }

    if (!config.cnpj) {
      const errMsg = "CNPJ não configurado nos dados fiscais.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg });
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
      return jsonResponse({ error: errMsg });
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

    if (itemsErr || !orderItems || orderItems.length === 0) {
      const errMsg = itemsErr ? `Erro ao buscar itens: ${itemsErr.message}` : "Pedido sem itens.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg });
    }

    // 4. Get OAuth token
    let accessToken: string;
    try {
      accessToken = await getNuvemFiscalToken();
    } catch (e: any) {
      await updateNoteStatus(supabase, fiscal_note_id, "error", e.message);
      return jsonResponse({ error: e.message });
    }

    // 5. Build NFC-e det items (using correct Nuvem Fiscal API field names)
    const ncmDefault = "21069090";
    const cfopDefault = "5102";
    let itemNumber = 1;
    const detItems: any[] = [];

    for (const item of orderItems) {
      const prod = (item as any).products;
      const ncm = (prod?.fiscal_ncm || ncmDefault).replace(/\./g, "");
      const cfop = prod?.fiscal_cfop || cfopDefault;
      const csosn = prod?.fiscal_icms_csosn || "102";
      const orig = Number(prod?.fiscal_icms_origin || "0");
      const pisCst = prod?.fiscal_pis_cst || "49";
      const cofinsCst = prod?.fiscal_cofins_cst || "49";
      const vUnCom = Number(item.price_at_order.toFixed(2));
      const vProd = Number((item.quantity * item.price_at_order).toFixed(2));

      detItems.push({
        nItem: itemNumber++,
        prod: {
          cProd: prod?.pdv_code || item.product_id || `PROD-${itemNumber}`,
          xProd: prod?.name || `Item ${itemNumber}`,
          NCM: ncm,
          CFOP: cfop,
          uCom: "UN",
          qCom: item.quantity,
          vUnCom: vUnCom,
          vProd: vProd,
          cEAN: "SEM GTIN",
          cEANTrib: "SEM GTIN",
          uTrib: "UN",
          qTrib: item.quantity,
          vUnTrib: vUnCom,
          indTot: 1,
        },
        imposto: {
          ICMS: {
            [`ICMSSN${csosn}`]: {
              orig: orig,
              CSOSN: csosn,
            },
          },
          PIS: {
            PISOutr: { CST: pisCst, vBC: 0, pPIS: 0, vPIS: 0 },
          },
          COFINS: {
            COFINSOutr: { CST: cofinsCst, vBC: 0, pCOFINS: 0, vCOFINS: 0 },
          },
        },
      });

      // Extras as separate items
      const extras = (item as any).order_item_extras || [];
      for (const extra of extras) {
        const extraName = extra.product_extras?.name || "Adicional";
        const vUnExtra = Number(extra.price_at_order.toFixed(2));
        const vProdExtra = Number((item.quantity * extra.price_at_order).toFixed(2));

        detItems.push({
          nItem: itemNumber++,
          prod: {
            cProd: extra.product_extra_id || `EXTRA-${itemNumber}`,
            xProd: `${extraName} (${prod?.name || "Item"})`,
            NCM: ncmDefault,
            CFOP: cfopDefault,
            uCom: "UN",
            qCom: item.quantity,
            vUnCom: vUnExtra,
            vProd: vProdExtra,
            cEAN: "SEM GTIN",
            cEANTrib: "SEM GTIN",
            uTrib: "UN",
            qTrib: item.quantity,
            vUnTrib: vUnExtra,
            indTot: 1,
          },
          imposto: {
            ICMS: { ICMSSN102: { orig: 0, CSOSN: "102" } },
            PIS: { PISOutr: { CST: "49", vBC: 0, pPIS: 0, vPIS: 0 } },
            COFINS: { COFINSOutr: { CST: "49", vBC: 0, pCOFINS: 0, vCOFINS: 0 } },
          },
        });
      }
    }

    const totalProdutos = detItems.reduce((acc, d) => acc + d.prod.vProd, 0);
    const cpfCnpj = config.cnpj.replace(/\D/g, "");
    const uf = config.uf || "SP";

    // UF code mapping
    const ufCodes: Record<string, number> = {
      AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
      GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
      PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
      SP: 35, SE: 28, TO: 17,
    };

    // 6. Build NFC-e payload following Nuvem Fiscal API schema
    const nfcePayload: Record<string, any> = {
      ambiente: "homologacao",
      infNFe: {
        versao: "4.00",
        ide: {
          cUF: ufCodes[uf] || 35,
          natOp: "VENDA",
          mod: 65,
          serie: 1,
          tpNF: 1,
          idDest: 1,
          cMunFG: config.municipio_codigo || "",
          tpImp: 4,
          tpEmis: 1,
          tpAmb: 2, // 2 = homologação
          finNFe: 1,
          indFinal: 1,
          indPres: 1,
          procEmi: 0,
          verProc: "MenuMesa-1.0",
        },
        emit: {
          CNPJ: cpfCnpj,
          xNome: config.razao_social || config.nome_fantasia || "",
          xFant: config.nome_fantasia || config.razao_social || "",
          IE: config.inscricao_estadual?.replace(/\D/g, "") || "",
          CRT: 1, // Simples Nacional
          enderEmit: {
            xLgr: config.logradouro || "",
            nro: config.numero || "S/N",
            xBairro: config.bairro || "",
            cMun: config.municipio_codigo || "",
            xMun: "",
            UF: uf,
            CEP: config.cep?.replace(/\D/g, "") || "",
            cPais: 1058,
            xPais: "BRASIL",
          },
        },
        det: detItems,
        total: {
          ICMSTot: {
            vBC: 0,
            vICMS: 0,
            vICMSDeson: 0,
            vFCP: 0,
            vBCST: 0,
            vST: 0,
            vFCPST: 0,
            vFCPSTRet: 0,
            vProd: Number(totalProdutos.toFixed(2)),
            vFrete: 0,
            vSeg: 0,
            vDesc: 0,
            vII: 0,
            vIPI: 0,
            vIPIDevol: 0,
            vPIS: 0,
            vCOFINS: 0,
            vOutro: 0,
            vNF: Number(totalProdutos.toFixed(2)),
          },
        },
        pag: {
          detPag: [
            {
              tPag: "99",
              vPag: Number(totalProdutos.toFixed(2)),
            },
          ],
        },
        transp: {
          modFrete: 9,
        },
        infAdic: {
          infCpl: `Pedido: ${order_id}`,
        },
      },
    };

    // Add customer CPF if available
    if (order.customer_cpf) {
      const cpfClean = order.customer_cpf.replace(/\D/g, "");
      if (cpfClean.length === 11) {
        nfcePayload.infNFe.dest = {
          CPF: cpfClean,
          xNome: order.customer_name || "CONSUMIDOR",
          indIEDest: 9,
        };
      }
    }

    console.log("[NuvemFiscal] Emitting NFC-e for order:", order_id, "CNPJ:", cpfCnpj);

    // 7. Send to Nuvem Fiscal API
    const baseUrl = "https://api.nuvemfiscal.com.br";
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
      return jsonResponse({ error: errMsg, nuvem_response: apiResult });
    }

    // 8. Update fiscal note with result
    const nfceStatus = apiResult.status || "processing";
    const mappedStatus = nfceStatus === "autorizada" ? "authorized" : nfceStatus === "rejeitada" ? "error" : "processing";

    const updateData: Record<string, any> = { status: mappedStatus };
    if (apiResult.numero) updateData.nfe_number = String(apiResult.numero);
    if (apiResult.chave) updateData.nfe_key = apiResult.chave;
    if (nfceStatus === "rejeitada") {
      updateData.error_message = apiResult.motivo_status || "Nota rejeitada pela SEFAZ";
    }

    if (fiscal_note_id) {
      await supabase.from("order_fiscal_notes").update(updateData).eq("id", fiscal_note_id);
    } else {
      await supabase.from("order_fiscal_notes").update(updateData).eq("order_id", order_id).eq("restaurant_id", restaurant_id);
    }

    return jsonResponse({
      success: true,
      status: mappedStatus,
      nuvem_response: apiResult,
    });
  } catch (error: any) {
    console.error("[NuvemFiscal] Error:", error);
    return jsonResponse({ error: error.message || "Erro interno" }, 500);
  }
});
