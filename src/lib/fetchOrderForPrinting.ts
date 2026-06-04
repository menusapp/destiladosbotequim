import { supabase } from "@/integrations/supabase/client";

export interface OrderItemExtraForPrinting {
  name: string;
  price: number;
}

export interface OrderItemForPrinting {
  id: string;
  quantity: number;
  price_at_order: number;
  notes: string | null;
  products: {
    name: string;
  };
  order_item_extras: OrderItemExtraForPrinting[];
}

export interface OrderForPrinting {
  id: string;
  daily_order_number: number | null;
  status: string;
  created_at: string;
  customer_name: string;
  customer_cpf: string;
  customer_phone: string | null;
  // Tipo / canal / agendamento
  order_type: string | null; // 'local' | 'delivery' | 'balcao' | ...
  order_channel: string | null; // 'totem' | 'ifood' | 'delivery_direto' | 'balcao' | ...
  delivery_type: string | null; // 'delivery' | 'pickup'
  delivery_address: string | null;
  delivery_phone: string | null;
  delivery_fee: number;
  service_fee: number;
  coupon_discount: number;
  coupon_code: string | null;
  payment_type: string | null;
  payment_brand: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  dd_scheduled_for: string | null;
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
 * Garante PARIDADE com o conteúdo do PDF antigo (printOrder):
 *  - tipo de pedido, canal, agendamento, taxa entrega, desconto
 *  - telefone, endereço, pagamento, observações, cancelamento
 *  - extras/complementos com preço e nome
 *  - fallback de produto deletado
 */
export async function fetchOrderForPrinting(
  orderId: string
): Promise<OrderForPrinting> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      daily_order_number,
      status,
      created_at,
      customer_name,
      customer_cpf,
      order_type,
      order_channel,
      delivery_type,
      delivery_address,
      delivery_phone,
      delivery_fee,
      service_fee,
      coupon_discount,
      coupon_code,
      payment_type,
      payment_brand,
      notes,
      cancellation_reason,
      dd_scheduled_for,
      restaurant_id,
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
        ),
        order_item_extras (
          price_at_order,
          extra_name,
          product_extras:product_extra_id (
            name
          )
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

  const rawItems = (order.order_items ?? []) as Array<any>;

  // Fallback: produtos deletados
  const missingProductIds = Array.from(
    new Set(
      rawItems
        .filter((it) => !it.products?.name && it.product_id)
        .map((it) => it.product_id as string)
    )
  );

  const fallbackMap = new Map<string, string>();
  if (missingProductIds.length > 0) {
    const { data: fallbackProducts } = await supabase
      .from("products")
      .select("id, name")
      .in("id", missingProductIds);
    for (const p of fallbackProducts ?? []) {
      fallbackMap.set(p.id, p.name);
    }
  }

  // Telefone do cliente (fallback via tabela customers)
  let customerPhone: string | null = (order as any).delivery_phone ?? null;
  if (!customerPhone && (order as any).customer_cpf) {
    const { data: cust } = await supabase
      .from("customers")
      .select("phone")
      .eq("cpf", (order as any).customer_cpf)
      .eq("restaurant_id", (order as any).restaurant_id)
      .maybeSingle();
    if (cust?.phone) customerPhone = cust.phone;
  }

  const order_items: OrderItemForPrinting[] = rawItems.map((it) => {
    const name =
      it.products?.name ??
      (it.product_id ? fallbackMap.get(it.product_id) : undefined) ??
      "Produto removido";

    const order_item_extras: OrderItemExtraForPrinting[] = (
      it.order_item_extras ?? []
    ).map((ex: any) => ({
      name: ex.extra_name ?? ex.product_extras?.name ?? "Extra",
      price: Number(ex.price_at_order ?? 0),
    }));

    return {
      id: it.id,
      quantity: it.quantity,
      price_at_order: Number(it.price_at_order),
      notes: it.notes,
      products: { name },
      order_item_extras,
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
    daily_order_number: (order as any).daily_order_number ?? null,
    status: order.status as string,
    created_at: order.created_at as string,
    customer_name: (order as any).customer_name,
    customer_cpf: (order as any).customer_cpf,
    customer_phone: customerPhone,
    order_type: (order as any).order_type ?? null,
    order_channel: (order as any).order_channel ?? null,
    delivery_type: (order as any).delivery_type ?? null,
    delivery_address: (order as any).delivery_address ?? null,
    delivery_phone: (order as any).delivery_phone ?? null,
    delivery_fee: Number((order as any).delivery_fee ?? 0),
    service_fee: Number((order as any).service_fee ?? 0),
    coupon_discount: Number((order as any).coupon_discount ?? 0),
    payment_type: (order as any).payment_type ?? null,
    payment_brand: (order as any).payment_brand ?? null,
    notes: (order as any).notes ?? null,
    cancellation_reason: (order as any).cancellation_reason ?? null,
    dd_scheduled_for: (order as any).dd_scheduled_for ?? null,
    table_id: (order as any).table_id ?? null,
    tables,
    order_items,
  };
}
