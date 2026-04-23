import { supabase } from "@/integrations/supabase/client";

export interface OrderItemForPrinting {
  id: string;
  quantity: number;
  price_at_order: number;
  notes: string | null;
  products: {
    name: string;
  };
}

export interface OrderForPrinting {
  id: string;
  status: string;
  created_at: string;
  customer_name: string;
  customer_cpf: string;
  table_id: string | null;
  tables: {
    table_name: string | null;
    table_number: number;
  } | null;
  order_items: OrderItemForPrinting[];
}

/**
 * Busca um pedido completo, pronto para impressão térmica (ex: QZ Tray).
 *
 * Garante que cada order_item tenha `products.name` preenchido — caso o
 * relacionamento aninhado retorne null (produto deletado/desvinculado),
 * faz uma busca de fallback direto na tabela `products` por id.
 */
export async function fetchOrderForPrinting(
  orderId: string
): Promise<OrderForPrinting> {
  // 1) Pedido + mesa + itens + produto (relacionamento aninhado)
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      status,
      created_at,
      customer_name,
      customer_cpf,
      table_id,
      tables:table_id (
        table_name,
        table_number
      ),
      order_items (
        id,
        quantity,
        price_at_order,
        notes,
        product_id,
        products:product_id (
          name
        )
      )
    `
    )
    .eq("id", orderId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar pedido para impressão: ${error.message}`);
  }
  if (!order) {
    throw new Error(`Pedido ${orderId} não encontrado.`);
  }

  const rawItems = (order.order_items ?? []) as Array<{
    id: string;
    quantity: number;
    price_at_order: number;
    notes: string | null;
    product_id: string | null;
    products: { name: string } | null;
  }>;

  // 2) Fallback: itens sem produto resolvido via join
  const missingProductIds = Array.from(
    new Set(
      rawItems
        .filter((it) => !it.products?.name && it.product_id)
        .map((it) => it.product_id as string)
    )
  );

  const fallbackMap = new Map<string, string>();
  if (missingProductIds.length > 0) {
    const { data: fallbackProducts, error: fbError } = await supabase
      .from("products")
      .select("id, name")
      .in("id", missingProductIds);

    if (fbError) {
      console.warn(
        "[fetchOrderForPrinting] Falha no fallback de produtos:",
        fbError.message
      );
    } else {
      for (const p of fallbackProducts ?? []) {
        fallbackMap.set(p.id, p.name);
      }
    }
  }

  // 3) Normaliza itens: products.name SEMPRE preenchido (nunca null)
  const order_items: OrderItemForPrinting[] = rawItems.map((it) => {
    const name =
      it.products?.name ??
      (it.product_id ? fallbackMap.get(it.product_id) : undefined) ??
      "Produto removido";

    return {
      id: it.id,
      quantity: it.quantity,
      price_at_order: Number(it.price_at_order),
      notes: it.notes,
      products: { name },
    };
  });

  const tables = (order as any).tables
    ? {
        table_name: (order as any).tables.table_name ?? null,
        table_number: (order as any).tables.table_number,
      }
    : null;

  return {
    id: order.id,
    status: order.status as string,
    created_at: order.created_at as string,
    customer_name: order.customer_name,
    customer_cpf: order.customer_cpf,
    table_id: order.table_id ?? null,
    tables,
    order_items,
  };
}

/* -------------------------------------------------------------------------
 * Exemplo de uso (para validar o JSON no console)
 * -------------------------------------------------------------------------
 *
 * import { fetchOrderForPrinting } from "@/lib/fetchOrderForPrinting";
 *
 * const order = await fetchOrderForPrinting("00000000-0000-0000-0000-000000000000");
 * console.log(JSON.stringify(order, null, 2));
 *
 * // Saída esperada:
 * // {
 * //   "id": "...",
 * //   "status": "delivered",
 * //   "created_at": "2025-04-23T12:34:56.000Z",
 * //   "customer_name": "João da Silva",
 * //   "customer_cpf": "12345678900",
 * //   "table_id": "...",
 * //   "tables": {
 * //     "table_name": "Mesa 1",
 * //     "table_number": 1
 * //   },
 * //   "order_items": [
 * //     {
 * //       "id": "...",
 * //       "quantity": 1,
 * //       "price_at_order": 37.9,
 * //       "notes": null,
 * //       "products": { "name": "Batatas Especiais" }
 * //     }
 * //   ]
 * // }
 * ----------------------------------------------------------------------- */
