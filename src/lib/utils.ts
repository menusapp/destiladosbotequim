import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Dinheiro",
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX",
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
  return PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS[method.toLowerCase()] || method;
}
