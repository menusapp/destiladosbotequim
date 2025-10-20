import { CreditCard, Smartphone, Banknote } from "lucide-react";

export const usePaymentFormat = () => {
  const getPaymentIcon = (method: string) => {
    switch (method) {
      case "card":
        return CreditCard;
      case "pix":
        return Smartphone;
      case "cash":
        return Banknote;
      default:
        return null;
    }
  };

  const getPaymentLabel = (method: string) => {
    const labels: Record<string, string> = {
      card: "Cartão",
      pix: "PIX",
      cash: "Dinheiro",
    };
    return labels[method] || method;
  };

  return { getPaymentIcon, getPaymentLabel };
};
