import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAYMENT_BASE_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  dinheiro: "Dinheiro",
  credit: "Crédito",
  credit_card_online: "Crédito",
  credito: "Crédito",
  "crédito": "Crédito",
  debit: "Débito",
  debito: "Débito",
  "débito": "Débito",
  card: "Crédito",
  pix: "PIX",
  pix_online: "PIX",
  meal_voucher: "Vale Refeição",
  "vale refeição": "Vale Refeição",
  pending: "Pendente",
  ifood_online: "iFood Online",
  "pago pelo ifood": "iFood Online",
  "pago delivery direto": "Pago DD",
  online: "Pago Online",
  outros: "Outros",
};

/**
 * Normaliza a exibição de formas de pagamento no frontend.
 * 
 * Aceita qualquer formato salvo no backend (cash, credit, credito-Visa, Crédito - Mastercard, etc.)
 * e retorna uma string padronizada para exibição.
 * 
 * Exemplos:
 *   "cash" → "Dinheiro"
 *   "credit" → "Crédito"
 *   "credito-Visa" → "Crédito - Visa"
 *   "Crédito - Mastercard" → "Crédito - Mastercard"
 *   "debit" → "Débito"
 *   "Débito - Elo" → "Débito - Elo"
 * 
 * NÃO altera nada no backend — apenas camada de exibição.
 */
export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";

  // Already well-formatted with " - " brand separator? Normalize base only.
  if (method.includes(" - ")) {
    const [base, ...brandParts] = method.split(" - ");
    const brand = brandParts.join(" - ").trim();
    const normalizedBase = PAYMENT_BASE_LABELS[base.trim().toLowerCase()] || base.trim();
    if (process.env.NODE_ENV === "development") {
      console.info("[PaymentDisplay] input:", method, "→", `${normalizedBase} - ${brand}`);
    }
    return brand ? `${normalizedBase} - ${brand}` : normalizedBase;
  }

  // Handle internal format with hyphen separator: "credito-Visa", "debito-Elo"
  if (method.includes("-") && !method.startsWith("pix")) {
    const [base, ...brandParts] = method.split("-");
    const brand = brandParts.join("-").trim();
    const normalizedBase = PAYMENT_BASE_LABELS[base.trim().toLowerCase()] || base.trim();
    if (brand) {
      if (process.env.NODE_ENV === "development") {
        console.info("[PaymentDisplay] input:", method, "→", `${normalizedBase} - ${brand}`);
      }
      return `${normalizedBase} - ${brand}`;
    }
  }

  // Direct lookup (case-insensitive)
  const label = PAYMENT_BASE_LABELS[method.toLowerCase()];
  if (label) {
    if (process.env.NODE_ENV === "development") {
      console.info("[PaymentDisplay] input:", method, "→", label);
    }
    return label;
  }

  // If starts with known Portuguese prefix, return as-is (already formatted)
  const lm = method.toLowerCase();
  if (lm.startsWith("crédito") || lm.startsWith("débito") || lm.startsWith("vale")) {
    return method;
  }

  if (process.env.NODE_ENV === "development") {
    console.info("[PaymentDisplay] input:", method, "→ passthrough:", method);
  }
  return method;
}

/**
 * Combina payment_type + payment_brand para exibição padronizada.
 * Ex: formatPaymentWithBrand("credit", "visa") → "Crédito - Visa"
 *     formatPaymentWithBrand("Crédito - Visa", null) → "Crédito - Visa" (já formatado)
 */
export function formatPaymentWithBrand(type: string | null | undefined, brand: string | null | undefined): string {
  if (!type) return "—";
  // If already contains brand info (e.g. "Crédito - Visa"), just normalize
  if (type.includes(" - ") || type.includes("-")) {
    return formatPaymentMethod(type);
  }
  const formatted = formatPaymentMethod(type);
  if (brand) {
    // Capitalize brand name
    const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
    // Don't duplicate if formatted already contains brand
    if (!formatted.toLowerCase().includes(brand.toLowerCase())) {
      return `${formatted} - ${brandName}`;
    }
  }
  return formatted;
}
