import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  credit: "Crédito",
  credit_card_online: "Crédito",
  debit: "Débito",
  pix: "PIX",
  pix_online: "PIX",
  meal_voucher: "Vale Refeição",
  pending: "Pendente",
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  ifood_online: "iFood Online",
  "Pago pelo iFood": "iFood Online",
  Outros: "Outros",
};

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return "—";
  // Strip brand suffix for display normalization: "Crédito - Visa" stays as-is (already readable)
  const label = PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS[method.toLowerCase()];
  if (label) return label;
  return method;
}
