import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product_name, product_description, restaurant_id } = await req.json();

    if (!product_name || !restaurant_id) {
      return new Response(JSON.stringify({ error: "product_name e restaurant_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar UF do restaurante
    const { data: fiscalConfig } = await supabase
      .from("fiscal_configs")
      .select("uf")
      .eq("restaurant_id", restaurant_id)
      .single();

    const uf = fiscalConfig?.uf || "SP";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const systemPrompt = `Você é um especialista em tributação brasileira para NFC-e (Nota Fiscal de Consumidor Eletrônica) focado em estabelecimentos de alimentação (restaurantes, lanchonetes, bares, padarias, etc.) que operam no Simples Nacional (CRT 1).

Sua tarefa é classificar produtos alimentícios com os códigos fiscais corretos baseando-se no nome e descrição do produto.

Regras importantes:
- UF do estabelecimento: ${uf}
- Regime tributário: Simples Nacional (CRT 1)
- Tipo de operação: Venda de mercadoria ao consumidor final (NFC-e)
- CFOP padrão para venda interna: 5102 (revenda) ou 5101 (produção própria). Para restaurantes/bares que produzem o alimento, use 5101.
- CSOSN mais comum para Simples Nacional: 102 (tributado sem permissão de crédito) ou 500 (ICMS cobrado anteriormente por ST)
- Origem: 0 (Nacional)
- PIS CST: 49 (outras operações de saída) para Simples Nacional
- COFINS CST: 49 (outras operações de saída) para Simples Nacional
- NCM deve ser o código de 8 dígitos mais específico possível
- CEST quando aplicável (produtos sujeitos a substituição tributária)

Exemplos de NCM comuns para alimentação:
- Refeições prontas: 21069090
- Hambúrguer/sanduíche: 21069090
- Pizza: 19059090
- Salgados/empanados: 19059090
- Sucos naturais: 20098990
- Refrigerantes: 22021000
- Água mineral: 22011000
- Cerveja: 22030000
- Sorvete: 21050000
- Açaí: 20089900
- Café preparado: 09012100
- Pão/bolo: 19059090
- Doces/sobremesas: 17049090
- Carnes preparadas: 16025000
- Porções/petiscos: 16025000`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Classifique fiscalmente este produto:\n\nNome: ${product_name}\nDescrição: ${product_description || "Sem descrição"}\n\nRetorne os códigos fiscais corretos.` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_fiscal_codes",
              description: "Retorna os códigos fiscais sugeridos para o produto",
              parameters: {
                type: "object",
                properties: {
                  ncm: { type: "string", description: "Código NCM de 8 dígitos" },
                  cest: { type: "string", description: "Código CEST (7 dígitos) ou vazio se não aplicável" },
                  cfop: { type: "string", description: "CFOP (ex: 5101 ou 5102)" },
                  csosn: { type: "string", description: "CSOSN para Simples Nacional (ex: 102, 500)" },
                  origin: { type: "string", description: "Origem da mercadoria (0 = Nacional)" },
                  pis_cst: { type: "string", description: "CST do PIS (ex: 49)" },
                  cofins_cst: { type: "string", description: "CST do COFINS (ex: 49)" },
                  explanation: { type: "string", description: "Breve explicação da classificação" },
                },
                required: ["ncm", "cfop", "csosn", "origin", "pis_cst", "cofins_cst"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_fiscal_codes" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("Erro ao consultar IA");
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      throw new Error("IA não retornou dados estruturados");
    }

    const suggestion = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fiscal-ai-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
