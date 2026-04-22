import { supabase } from "@/integrations/supabase/client";

/**
 * Formats a raw phone string (e.g. "5511999998888") to (XX) XXXXX-XXXX
 */
function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // Remove country code 55 if present
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return local;
}

function formatPaymentType(type: string, brand?: string | null): string {
  const map: Record<string, string> = {
    cash: "Dinheiro",
    credit: "Cartão de Crédito",
    debit: "Cartão de Débito",
    pix: "PIX",
    pix_online: "PIX Online",
    card_online: "Cartão Online",
    credit_card_online: "Cartão Online",
    voucher: "Vale Refeição",
    meal_voucher: "Vale Refeição",
  };
  let base = map[type] || type;
  if (brand) {
    const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
    base = `${base} - ${brandName}`;
  }
  const onlineTypes = ["pix_online", "card_online", "credit_card_online", "online", "ifood_online"];
  if (onlineTypes.includes(type.toLowerCase())) {
    return base;
  }
  return `${base.toUpperCase()} - PAGAMENTO NO LOCAL`;
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
    payment_brand?: string;
    notes?: string;
    tables?: { table_number: number } | null;
    dd_scheduled_for?: string;
    cancellation_reason?: string;
    coupon_discount?: number;
    delivery_fee?: number;
    order_channel?: string;
    customer_cpf?: string;
    order_items: {
      id: string;
      quantity: number;
      price_at_order: number;
      notes?: string;
      products: { name: string } | null;
      order_item_extras: { price_at_order: number; extra_name?: string | null; product_extras: { name: string } | null }[];
    }[];
  },
  restaurantId: string
) => {
  // Fetch printer settings
  let paperSize = "80mm";
  let fontFamily = "Arial Black";
  let fontSize = 12;
  let fontBold = true;
  let printCopies = 1;
  let supportsAutoCut = false;
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
    if ((data as any)?.print_copies) printCopies = (data as any).print_copies;
    if ((data as any)?.supports_auto_cut) supportsAutoCut = Boolean((data as any).supports_auto_cut);
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

  // Fetch customer phone if not already available
  let customerPhone = order.delivery_phone || "";
  if (!customerPhone && order.customer_cpf) {
    try {
      const { data } = await supabase
        .from("customers")
        .select("phone")
        .eq("cpf", order.customer_cpf)
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      if (data?.phone) customerPhone = data.phone;
    } catch {}
  }

  const isLocal = order.order_type === "local";
  const isDelivery = order.delivery_type === "delivery";
  const isPickup = order.delivery_type === "pickup";
  const tableNumber = order.tables?.table_number;
  const dateStr = new Date(order.created_at).toLocaleString("pt-BR");

  // Build origin label
  let originLabel = "";
  if (isLocal) {
    originLabel = `MESA ${tableNumber || "?"}`;
  } else if (order.order_type === "balcao" || order.order_channel === "totem") {
    originLabel = order.order_channel === "totem" ? "TOTEM - BALCÃO" : "BALCÃO";
  } else if (isPickup) {
    originLabel = "RETIRADA";
  } else if (isDelivery) {
    originLabel = "ENTREGA";
  } else {
    originLabel = "PEDIDO";
  }

  // Calculate items
  const items = order.order_items.map((item) => {
    const extras = item.order_item_extras.map((e) => ({
      name: e.extra_name || e.product_extras?.name || "Extra",
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

  // Scheduled order section
  let scheduledSection = "";
  if (order.dd_scheduled_for) {
    const scheduledDate = new Date(order.dd_scheduled_for).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
    scheduledSection = `
      <div class="scheduled-alert">
        ⏰ AGENDADO PARA: ${scheduledDate}
      </div>
    `;
  }

  // Build items HTML with separators between items
  const itemsHtml = items
    .map((item, idx) => {
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

      const separator = idx < items.length - 1 ? '<div class="item-separator"></div>' : '';

      return `
        <div class="item">
          <div class="item-row">
            <span>${item.quantity}x ${item.name}</span>
            <span class="price">R$ ${itemTotal.toFixed(2)}</span>
          </div>
          ${extrasHtml}
          ${notesHtml}
        </div>
        ${separator}
      `;
    })
    .join("");

  // Phone line
  const phoneLine = customerPhone
    ? `<p><strong>Telefone:</strong> ${formatPhoneDisplay(customerPhone)}</p>`
    : "";

  // Address line (only for delivery)
  const addressLine = isDelivery && order.delivery_address
    ? `<p><strong>Endereço:</strong> ${order.delivery_address}</p>`
    : "";

  // Payment line
  const paymentLine = order.payment_type
    ? `<p><strong>Pagamento:</strong> ${formatPaymentType(order.payment_type, order.payment_brand)}</p>`
    : "";

  // Notes section
  const notesSection = order.notes
    ? `
      <div class="line"></div>
      <div class="section">
        <p><strong>Obs:</strong> ${order.notes}</p>
      </div>
    `
    : "";

  // Cancellation reason
  const cancelSection = order.cancellation_reason
    ? `
      <div class="line"></div>
      <div class="section">
        <p><strong>MOTIVO CANCELAMENTO:</strong> ${order.cancellation_reason}</p>
      </div>
    `
    : "";

  // Build totals
  const totalsHtml = (() => {
    const discount = order.coupon_discount || 0;
    const deliveryFee = order.delivery_fee || 0;
    const finalTotal = subtotal - discount + deliveryFee;
    const discountReasonMatch = order.notes?.match(/\[Desconto: (.+?)\]/);
    const discountReason = discountReasonMatch ? discountReasonMatch[1] : "";
    // Sempre mostra breakdown para entrega, mesmo com taxa 0 (transparência)
    const showBreakdown = discount > 0 || deliveryFee > 0 || isDelivery;
    if (showBreakdown) {
      return `
        <div class="total-row" style="font-size:12px;">
          <span>Subtotal</span>
          <span>R$ ${subtotal.toFixed(2)}</span>
        </div>
        ${discount > 0 ? `<div class="total-row" style="font-size:12px;">
          <span>Desconto</span>
          <span>- R$ ${discount.toFixed(2)}</span>
        </div>` : ""}
        ${discountReason ? `<div style="font-size:10px;font-style:italic;margin-bottom:4px;">Motivo: ${discountReason}</div>` : ""}
        ${isDelivery ? `<div class="total-row" style="font-size:12px;">
          <span>Taxa de entrega</span>
          <span>${deliveryFee > 0 ? `R$ ${deliveryFee.toFixed(2)}` : "Grátis"}</span>
        </div>` : (deliveryFee > 0 ? `<div class="total-row" style="font-size:12px;">
          <span>Taxa de entrega</span>
          <span>R$ ${deliveryFee.toFixed(2)}</span>
        </div>` : "")}
        <div class="total-row">
          <span>TOTAL</span>
          <span>R$ ${finalTotal.toFixed(2)}</span>
        </div>
      `;
    }
    return `
      <div class="total-row">
        <span>TOTAL</span>
        <span>R$ ${subtotal.toFixed(2)}</span>
      </div>
    `;
  })();

  // Build single copy content — new header order
  const copyContent = `
      <div class="center">
        <h1>${restaurantName || "Restaurante"}</h1>
      </div>
      <div class="line"></div>
      
      <div class="section">
        <p><strong>Pedido:</strong> #${order.id.slice(0, 8)} — ${dateStr}</p>
      </div>
      
      <div class="origin">${originLabel}</div>
      ${scheduledSection}
      
      <div class="section">
        <p><strong>Cliente:</strong> ${order.customer_name}</p>
        ${phoneLine}
        ${addressLine}
      </div>
      
      <div class="double-line"></div>
      
      ${itemsHtml}
      
      <div class="double-line"></div>
      
      ${totalsHtml}
      
      ${paymentLine ? `<div class="line"></div><div class="section">${paymentLine}</div>` : ""}
      ${notesSection}
      ${cancelSection}
      
      <div class="line"></div>
      <div class="footer">
        <p>Impresso em ${new Date().toLocaleString("pt-BR")}</p>
      </div>
      <div class="footer-margin"></div>
  `;

  // ESC/POS auto-cut command (GS V 1 = partial cut). Many thermal printer drivers
  // (Bematech, Epson, Elgin, etc.) interpret these raw bytes and trigger the
  // physical cutter even when printing via the browser. Drivers that don't
  // support it will simply ignore the characters.
  const ESC_POS_FEED_AND_CUT = "\x1B\x64\x05\x1D\x56\x01"; // ESC d 5 (feed 5 lines) + GS V 1

  // Build copies — each via separated by a hard page break so the printer
  // treats each cópia como página independente, evitando duas vias no mesmo papel.
  const allCopies = Array.from({ length: printCopies }, (_, i) => {
    const isLast = i === printCopies - 1;
    const cutBlock = !isLast
      ? `<div class="cut-section">
           <div class="footer-margin"></div>
           ${supportsAutoCut ? `<div class="esc-pos-cut">${ESC_POS_FEED_AND_CUT}</div>` : `<div class="cut-line">--- CORTE AQUI ---</div>`}
           <div class="footer-margin"></div>
         </div>
         <div class="page-break"></div>`
      : `<div class="cut-section">
           <div class="footer-margin"></div>
           ${supportsAutoCut ? `<div class="esc-pos-cut">${ESC_POS_FEED_AND_CUT}</div>` : ""}
         </div>`;

    return `<div class="copy">${copyContent}</div>${cutBlock}`;
  }).join("\n");

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
          padding: 24px 12px 0 12px;
          font-size: ${fontSize}px;
          font-weight: ${fontBold ? "bold" : "normal"};
          line-height: 1.7;
          color: #000;
        }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .line { border-top: 1px dashed #000; margin: 16px 0; }
        .double-line { border-top: 2px solid #000; margin: 18px 0; }
        h1 { font-size: 16px; margin: 8px 0; }
        .origin {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          padding: 8px 4px;
          border: 1px solid #000;
          margin: 14px 0;
        }
        .scheduled-alert {
          font-size: 14px;
          font-weight: bold;
          text-align: center;
          padding: 8px 4px;
          border: 2px solid #000;
          margin: 10px 0;
          background: #f0f0f0;
        }
        .item { margin: 14px 0; }
        .item-row {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
        }
        .item-separator {
          border-top: 1px dashed #aaa;
          margin: 10px 0;
        }
        .extra {
          font-size: 11px;
          display: flex;
          justify-content: space-between;
          padding-left: 8px;
          margin-top: 2px;
        }
        .obs {
          font-size: 11px;
          font-style: italic;
          padding-left: 8px;
          margin-top: 2px;
        }
        .price { text-align: right; }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 16px;
          font-weight: bold;
          margin: 10px 0;
        }
        .section { margin: 14px 0; }
        .section p { margin: 6px 0; font-size: 11px; }
        .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        .footer-margin { height: 60px; }
        .cut-section { text-align: center; }
        .cut-line {
          font-size: 10px;
          letter-spacing: 2px;
          color: #999;
          margin: 4px 0;
        }
        /* ESC/POS bytes ficam invisíveis na tela mas são enviados como
           caracteres ao driver da impressora, que pode interpretá-los
           como comando de corte automático. */
        .esc-pos-cut {
          font-size: 1px;
          line-height: 1px;
          color: #fff;
          opacity: 0;
          height: 1px;
          overflow: hidden;
        }
        /* Quebra de página forte entre as vias — força o driver a tratar
           cada cópia como página separada, evitando duas vias no mesmo papel. */
        .page-break {
          page-break-after: always;
          break-after: page;
          height: 0;
        }
        .copy {
          page-break-inside: avoid;
          break-inside: avoid;
        }
      </style>
    </head>
    <body>
      ${allCopies}
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
