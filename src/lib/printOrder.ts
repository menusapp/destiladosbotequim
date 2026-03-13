import { supabase } from "@/integrations/supabase/client";

interface PrintOrderItem {
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: { name: string; price: number }[];
}

interface PrintOrderData {
  orderId: string;
  createdAt: string;
  customerName: string;
  orderType: "local" | "delivery";
  deliveryType?: "delivery" | "pickup";
  tableNumber?: number;
  items: PrintOrderItem[];
  subtotal: number;
  // Delivery-specific
  deliveryAddress?: string;
  deliveryPhone?: string;
  paymentType?: string;
  notes?: string;
}

/**
 * Generates thermal-printer-friendly HTML and opens print dialog
 */
export const printOrder = async (
  order: {
    id: string;
    created_at: string;
    customer_name: string;
    order_type?: string;
    delivery_type?: string;
    table_id?: string;
    delivery_address?: string;
    delivery_phone?: string;
    payment_type?: string;
    notes?: string;
    tables?: { table_number: number } | null;
    order_items: {
      id: string;
      quantity: number;
      price_at_order: number;
      notes?: string;
      products: { name: string } | null;
      order_item_extras: { price_at_order: number; product_extras: { name: string } | null }[];
    }[];
  },
  restaurantId: string
) => {
  // Fetch printer settings
  let paperSize = "80mm";
  let fontFamily = "Arial Black";
  let fontSize = 12;
  let fontBold = true;
  try {
    const { data } = await supabase
      .from("printer_settings")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .maybeSingle();
    if (data?.paper_size) paperSize = data.paper_size;
    if ((data as any)?.font_family) fontFamily = (data as any).font_family;
    if ((data as any)?.font_size) fontSize = (data as any).font_size;
    if ((data as any)?.font_bold !== undefined) fontBold = Boolean((data as any).font_bold);
  } catch {}

  // Fetch restaurant name
  let restaurantName = "";
  try {
    const { data } = await supabase
      .from("restaurants")
      .select("name")
      .eq("id", restaurantId)
      .single();
    if (data) restaurantName = data.name;
  } catch {}

  const isLocal = order.order_type === "local";
  const isDelivery = order.delivery_type === "delivery";
  const isPickup = order.delivery_type === "pickup";
  const tableNumber = order.tables?.table_number;
  const dateStr = new Date(order.created_at).toLocaleString("pt-BR");

  // Calculate items
  const items = order.order_items.map((item) => {
    const extras = item.order_item_extras.map((e) => ({
      name: e.product_extras?.name || "Extra",
      price: e.price_at_order,
    }));
    return {
      name: item.products?.name || "Produto",
      quantity: item.quantity,
      price: item.price_at_order,
      notes: item.notes,
      extras,
    };
  });

  const subtotal = items.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    return sum + (item.price + extrasTotal) * item.quantity;
  }, 0);

  // Build origin label
  let originLabel = "";
  if (isLocal) {
    originLabel = `PEDIDO LOCAL - MESA ${tableNumber || "?"}`;
  } else if (isPickup) {
    originLabel = "PEDIDO ONLINE - RETIRADA";
  } else {
    originLabel = "PEDIDO ONLINE - ENTREGA";
  }

  // Build items HTML
  const itemsHtml = items
    .map((item) => {
      const extrasHtml = item.extras
        .map(
          (e) =>
            `<div class="extra">  + ${e.name} <span class="price">R$ ${e.price.toFixed(2)}</span></div>`
        )
        .join("");
      const notesHtml = item.notes
        ? `<div class="obs">  Obs: ${item.notes}</div>`
        : "";
      const itemTotal =
        (item.price + item.extras.reduce((s, e) => s + e.price, 0)) *
        item.quantity;

      return `
        <div class="item">
          <div class="item-row">
            <span>${item.quantity}x ${item.name}</span>
            <span class="price">R$ ${itemTotal.toFixed(2)}</span>
          </div>
          ${extrasHtml}
          ${notesHtml}
        </div>
      `;
    })
    .join("");

  // Delivery-specific section
  let deliverySection = "";
  if (!isLocal) {
    const addressLine = order.delivery_address
      ? `<p><strong>Endereço:</strong> ${order.delivery_address}</p>`
      : "";
    const phoneLine = order.delivery_phone
      ? `<p><strong>Telefone:</strong> ${order.delivery_phone}</p>`
      : "";
    const paymentLine = order.payment_type
      ? `<p><strong>Pagamento:</strong> ${formatPaymentType(order.payment_type)}</p>`
      : "";

    if (addressLine || phoneLine || paymentLine) {
      deliverySection = `
        <div class="line"></div>
        <div class="section">
          ${addressLine}
          ${phoneLine}
          ${paymentLine}
        </div>
      `;
    }
  }

  // Notes section
  const notesSection = order.notes
    ? `
      <div class="line"></div>
      <div class="section">
        <p><strong>Obs:</strong> ${order.notes}</p>
      </div>
    `
    : "";

  const html = `
    <html>
    <head>
      <title>Pedido #${order.id.slice(0, 8)}</title>
      <style>
        @page { margin: 0; size: ${paperSize} auto; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: '${fontFamily}', 'Courier New', monospace;
          width: ${paperSize};
          margin: 0 auto;
          padding: 6px;
          font-size: ${fontSize}px;
          font-weight: ${fontBold ? "bold" : "normal"};
          line-height: 1.4;
          color: #000;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 6px 0; }
        .double-line { border-top: 2px solid #000; margin: 6px 0; }
        h1 { font-size: 16px; margin: 2px 0; }
        h2 { font-size: 14px; margin: 2px 0; }
        .origin {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          padding: 4px;
          border: 1px solid #000;
          margin: 6px 0;
        }
        .item { margin: 4px 0; }
        .item-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
        }
        .extra {
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          padding-left: 8px;
        }
        .obs {
          font-size: 11px;
          font-style: italic;
          padding-left: 8px;
        }
        .price { text-align: right; }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: bold;
          margin: 4px 0;
        }
        .section { margin: 4px 0; }
        .section p { margin: 2px 0; font-size: 11px; }
        .footer { text-align: center; margin-top: 8px; font-size: 10px; }
      </style>
    </head>
    <body>
      <div class="center">
        <h1>${restaurantName || "Restaurante"}</h1>
      </div>
      <div class="line"></div>
      
      <div class="origin">${originLabel}</div>
      
      <div class="section">
        <p><strong>Pedido:</strong> #${order.id.slice(0, 8)}</p>
        <p><strong>Data:</strong> ${dateStr}</p>
        <p><strong>Cliente:</strong> ${order.customer_name}</p>
      </div>
      
      <div class="double-line"></div>
      
      ${itemsHtml}
      
      <div class="double-line"></div>
      
      <div class="total-row">
        <span>TOTAL</span>
        <span>R$ ${subtotal.toFixed(2)}</span>
      </div>
      
      ${deliverySection}
      ${notesSection}
      
      <div class="line"></div>
      <div class="footer">
        <p>Impresso em ${new Date().toLocaleString("pt-BR")}</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=400,height=600");
  if (!printWindow) {
    throw new Error("Popup bloqueado. Permita popups para imprimir.");
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
};

function formatPaymentType(type: string): string {
  const map: Record<string, string> = {
    cash: "Dinheiro",
    credit: "Cartão de Crédito",
    debit: "Cartão de Débito",
    pix: "PIX",
    pix_online: "PIX Online",
    card_online: "Cartão Online",
  };
  return map[type] || type;
}
