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
  if (!clientId || !clientSecret) throw new Error("Credenciais Nuvem Fiscal não configuradas");

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

function formatDateBRT(): string {
  const now = new Date();
  const offset = -3;
  const local = new Date(now.getTime() + offset * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${local.getUTCFullYear()}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}-03:00`;
}

// Valid CSTs for PISOutr/COFINSOutr
const validOutrCSTs = new Set(["49","50","51","52","53","54","55","56","60","61","62","63","64","65","66","67","70","71","72","73","74","75","98","99"]);

function safeOutrCST(cst: string | null | undefined): string {
  if (cst && validOutrCSTs.has(cst)) return cst;
  return "49";
}

const brandCodes: Record<string, string> = {
  visa: "01", mastercard: "02", amex: "03", "american express": "03",
  elo: "04", hipercard: "06", diners: "07", "diners club": "07",
};

function extractBrandCode(brandName: string): string | null {
  const lower = brandName.toLowerCase().trim();
  for (const [key, code] of Object.entries(brandCodes)) {
    if (lower.includes(key)) return code;
  }
  return null;
}

function mapNuvemFiscalStatus(apiResult: any): { dbStatus: string; errorMessage?: string } {
  // If API returned an error object, it's always an error
  if (apiResult.error) {
    const messages: string[] = [];
    if (apiResult.error.message) messages.push(apiResult.error.message);
    if (Array.isArray(apiResult.error.errors)) {
      for (const e of apiResult.error.errors) {
        if (e.message) messages.push(e.message);
      }
    }
    return { dbStatus: "error", errorMessage: messages.join(" | ") || "Erro de validação" };
  }

  // Check authorization sub-object first (more reliable)
  const authStatus = (apiResult.autorizacao?.status || "").toLowerCase().trim();
  const raw = (apiResult.status || "").toLowerCase().trim();
  const effectiveStatus = authStatus || raw;

  if (["autorizada", "autorizado"].includes(effectiveStatus)) {
    return { dbStatus: "authorized" };
  }
  if (["rejeitada", "rejeitado", "denegada", "denegado"].includes(effectiveStatus)) {
    const motivo = apiResult.autorizacao?.motivo_status || apiResult.motivo_status || "Nota rejeitada pela SEFAZ";
    return { dbStatus: "error", errorMessage: motivo };
  }
  if (["cancelada", "cancelado"].includes(effectiveStatus)) {
    return { dbStatus: "canceled", errorMessage: apiResult.motivo_status };
  }

  // If there's a protocolo in autorizacao, it's likely authorized
  if (apiResult.autorizacao?.protocolo) {
    return { dbStatus: "authorized" };
  }

  return { dbStatus: "processing" };
}

const ufCodes: Record<string, number> = {
  AC: 12, AL: 27, AP: 16, AM: 13, BA: 29, CE: 23, DF: 53, ES: 32,
  GO: 52, MA: 21, MT: 51, MS: 50, MG: 31, PA: 15, PB: 25, PR: 41,
  PE: 26, PI: 22, RJ: 33, RN: 24, RS: 43, RO: 11, RR: 14, SC: 42,
  SP: 35, SE: 28, TO: 17,
};

function mapPaymentMethod(paymentType: string | null | undefined, vPag: number): Record<string, any> {
  const pt = (paymentType || "").toLowerCase().trim();

  // Cash
  if (pt === "cash" || pt === "dinheiro") return { tPag: "01", vPag };

  // Credit card — with or without brand (e.g. "Crédito - Visa", "credit")
  if (pt.startsWith("créd") || pt.startsWith("cred") || pt === "credit" || pt === "cartão de crédito" || pt === "credit_card_online") {
    const result: Record<string, any> = { tPag: "03", vPag };
    const brand = extractBrandCode(pt);
    if (brand) result.tBand = brand;
    return result;
  }

  // Debit card — with or without brand
  if (pt.startsWith("déb") || pt.startsWith("deb") || pt === "debit" || pt === "cartão de débito") {
    const result: Record<string, any> = { tPag: "04", vPag };
    const brand = extractBrandCode(pt);
    if (brand) result.tBand = brand;
    return result;
  }

  // Meal voucher — with or without brand (Alelo, Sodexo, etc.)
  if (pt.startsWith("vale") || pt === "meal_voucher") return { tPag: "10", vPag };

  // PIX
  if (pt === "pix" || pt === "pix_online") return { tPag: "17", vPag };

  // iFood / online
  if (pt === "ifood_online" || pt === "pago pelo ifood") return { tPag: "99", xPag: "Pagamento Online", vPag };

  // Fallback
  const xPag = paymentType || "Outros";
  return { tPag: "99", xPag, vPag };
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
      const errMsg = "Configuração fiscal não encontrada.";
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
      .select("id, customer_name, customer_cpf, created_at, delivery_fee, payment_type")
      .eq("id", order_id)
      .single();

    if (orderErr || !order) {
      const errMsg = "Pedido não encontrado.";
      await updateNoteStatus(supabase, fiscal_note_id, "error", errMsg);
      return jsonResponse({ error: errMsg });
    }

    // 3. Fetch order items
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

    // 5. Build NFC-e det items
    const ncmDefault = "21069090";
    const cfopDefault = "5102";
    let itemNumber = 1;
    const detItems: any[] = [];

    for (const item of orderItems) {
      const prod = (item as any).products;
      const ncm = (prod?.fiscal_ncm || ncmDefault).replace(/\./g, "");
      const cfop = prod?.fiscal_cfop || cfopDefault;
      const orig = Number(prod?.fiscal_icms_origin || "0");
      const pisCst = safeOutrCST(prod?.fiscal_pis_cst);
      const cofinsCst = safeOutrCST(prod?.fiscal_cofins_cst);
      const vUnCom = Number(item.price_at_order.toFixed(2));
      const vProd = Number((item.quantity * item.price_at_order).toFixed(2));

      detItems.push({
        nItem: itemNumber++,
        prod: {
          cProd: prod?.pdv_code || item.product_id || `PROD-${itemNumber}`,
          xProd: prod?.name || `Item ${itemNumber}`,
          NCM: ncm, CFOP: cfop, uCom: "UN", qCom: item.quantity,
          vUnCom, vProd, cEAN: "SEM GTIN", cEANTrib: "SEM GTIN",
          uTrib: "UN", qTrib: item.quantity, vUnTrib: vUnCom, indTot: 1,
        },
        imposto: {
          ICMS: { ICMSSN102: { orig, CSOSN: "400" } },
          PIS: { PISOutr: { CST: pisCst, vBC: 0, pPIS: 0, vPIS: 0 } },
          COFINS: { COFINSOutr: { CST: cofinsCst, vBC: 0, pCOFINS: 0, vCOFINS: 0 } },
        },
      });

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
            NCM: ncmDefault, CFOP: cfopDefault, uCom: "UN", qCom: item.quantity,
            vUnCom: vUnExtra, vProd: vProdExtra, cEAN: "SEM GTIN", cEANTrib: "SEM GTIN",
            uTrib: "UN", qTrib: item.quantity, vUnTrib: vUnExtra, indTot: 1,
          },
          imposto: {
            ICMS: { ICMSSN102: { orig: 0, CSOSN: "400" } },
            PIS: { PISOutr: { CST: pisCst, vBC: 0, pPIS: 0, vPIS: 0 } },
            COFINS: { COFINSOutr: { CST: cofinsCst, vBC: 0, pCOFINS: 0, vCOFINS: 0 } },
          },
        });
      }
    }

    const totalProdutos = detItems.reduce((acc, d) => acc + d.prod.vProd, 0);
    const cpfCnpj = config.cnpj.replace(/\D/g, "");
    const uf = config.uf || "SP";
    const nfceNumero = config.nfce_numero || 1;
    const nfceSerie = config.nfce_serie || 1;

    // 6. Build NFC-e payload — PRODUCTION
    const nfcePayload: Record<string, any> = {
      ambiente: "producao",
      infNFe: {
        versao: "4.00",
        ide: {
          cUF: ufCodes[uf] || 35,
          natOp: "VENDA",
          mod: 65,
          serie: nfceSerie,
          nNF: nfceNumero,
          dhEmi: formatDateBRT(),
          tpNF: 1,
          idDest: 1,
          cMunFG: config.municipio_codigo || "",
          tpImp: 4,
          tpEmis: 1,
          tpAmb: 1,
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
          CRT: 1,
          enderEmit: {
            xLgr: config.logradouro || "",
            nro: config.numero || "S/N",
            xBairro: config.bairro || "",
            cMun: config.municipio_codigo || "",
            xMun: config.municipio_nome || "",
            UF: uf,
            CEP: config.cep?.replace(/\D/g, "") || "",
            cPais: 1058,
            xPais: "BRASIL",
          },
        },
        det: detItems,
        total: {
          ICMSTot: {
            vBC: 0, vICMS: 0, vICMSDeson: 0, vFCP: 0, vBCST: 0, vST: 0,
            vFCPST: 0, vFCPSTRet: 0, vProd: Number(totalProdutos.toFixed(2)),
            vFrete: 0, vSeg: 0, vDesc: 0, vII: 0, vIPI: 0, vIPIDevol: 0,
            vPIS: 0, vCOFINS: 0, vOutro: 0, vNF: Number(totalProdutos.toFixed(2)),
          },
        },
        pag: {
          detPag: [mapPaymentMethod(order.payment_type, Number(totalProdutos.toFixed(2)))],
        },
        transp: { modFrete: 9 },
        infAdic: { infCpl: `Pedido: ${order_id}` },
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

    console.log("[NuvemFiscal] Emitting NFC-e for order:", order_id, "nNF:", nfceNumero, "serie:", nfceSerie);

    // 7. Send to Nuvem Fiscal API
    const apiResponse = await fetch("https://api.nuvemfiscal.com.br/nfce", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nfcePayload),
    });

    const apiResult = await apiResponse.json();
    console.log("[NuvemFiscal] Full response:", JSON.stringify(apiResult));

    // 8. Use robust status mapping
    const { dbStatus, errorMessage } = mapNuvemFiscalStatus(apiResult);

    if (!apiResponse.ok && apiResponse.status !== 202) {
      const fullErr = errorMessage || apiResult?.message || JSON.stringify(apiResult).substring(0, 500);
      await updateNoteStatus(supabase, fiscal_note_id, "error", `Erro Nuvem Fiscal (${apiResponse.status}): ${fullErr}`);
      return jsonResponse({ error: fullErr, nuvem_response: apiResult });
    }

    // 9. Increment nfce_numero for next emission
    await supabase
      .from("fiscal_configs")
      .update({ nfce_numero: nfceNumero + 1 })
      .eq("restaurant_id", restaurant_id);

    // 10. Update fiscal note with result — save ALL response data
    const nuvemId = apiResult.id || null;
    const updateData: Record<string, any> = { status: dbStatus };
    if (apiResult.numero) updateData.nfe_number = String(apiResult.numero);
    if (apiResult.chave) updateData.nfe_key = apiResult.chave;
    if (nuvemId) updateData.nuvem_fiscal_ref = nuvemId;
    if (errorMessage) updateData.error_message = errorMessage;

    // Build PDF and XML URLs from Nuvem Fiscal API
    if (nuvemId) {
      updateData.pdf_url = `https://api.nuvemfiscal.com.br/nfce/${nuvemId}/pdf`;
      updateData.xml_url = `https://api.nuvemfiscal.com.br/nfce/${nuvemId}/xml`;
    }
    // Override with direct response data if available
    if (apiResult.autorizacao?.xml_url) updateData.xml_url = apiResult.autorizacao.xml_url;
    if (apiResult.autorizacao?.pdf_url) updateData.pdf_url = apiResult.autorizacao.pdf_url;

    if (fiscal_note_id) {
      await supabase.from("order_fiscal_notes").update(updateData).eq("id", fiscal_note_id);
    } else {
      await supabase.from("order_fiscal_notes").update(updateData).eq("order_id", order_id).eq("restaurant_id", restaurant_id);
    }

    return jsonResponse({ success: true, status: dbStatus, nuvem_response: apiResult });
  } catch (error: any) {
    console.error("[NuvemFiscal] Error:", error);
    return jsonResponse({ error: error.message || "Erro interno" }, 500);
  }
});
