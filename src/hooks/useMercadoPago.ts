import { useState, useEffect, useCallback } from "react";

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface CardFormData {
  cardNumber: string;
  cardholderName: string;
  expirationMonth: string;
  expirationYear: string;
  securityCode: string;
  identificationType: string;
  identificationNumber: string;
}

interface Installment {
  installments: number;
  installment_amount: number;
  total_amount: number;
  recommended_message: string;
}

interface PaymentMethodInfo {
  id: string;
  name: string;
  payment_type_id: string;
  thumbnail: string;
  secure_thumbnail: string;
}

export const useMercadoPago = (publicKey: string | null) => {
  const [mp, setMp] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setError("Public Key não configurada");
      return;
    }

    const initMP = () => {
      try {
        if (window.MercadoPago) {
          const mercadopago = new window.MercadoPago(publicKey, {
            locale: "pt-BR",
          });
          setMp(mercadopago);
          setIsReady(true);
          setError(null);
        } else {
          setTimeout(initMP, 100);
        }
      } catch (err) {
        console.error("Erro ao inicializar MercadoPago:", err);
        setError("Erro ao inicializar SDK do Mercado Pago");
      }
    };

    initMP();
  }, [publicKey]);

  const createCardToken = useCallback(
    async (cardData: CardFormData): Promise<{ token: string } | { error: string }> => {
      if (!mp) {
        return { error: "SDK não inicializado" };
      }

      try {
        const cardToken = await mp.createCardToken({
          cardNumber: cardData.cardNumber.replace(/\s/g, ""),
          cardholderName: cardData.cardholderName,
          cardExpirationMonth: cardData.expirationMonth,
          cardExpirationYear: cardData.expirationYear,
          securityCode: cardData.securityCode,
          identificationType: cardData.identificationType,
          identificationNumber: cardData.identificationNumber.replace(/\D/g, ""),
        });

        if (cardToken.id) {
          return { token: cardToken.id };
        } else {
          return { error: "Erro ao gerar token do cartão" };
        }
      } catch (err: any) {
        console.error("Erro ao criar token:", err);
        const errorMessage = err?.message || err?.cause?.[0]?.description || "Erro ao processar cartão";
        return { error: errorMessage };
      }
    },
    [mp]
  );

  const getPaymentMethods = useCallback(
    async (bin: string): Promise<PaymentMethodInfo | null> => {
      if (!mp || bin.length < 6) return null;

      try {
        const response = await mp.getPaymentMethods({ bin });
        if (response.results && response.results.length > 0) {
          return response.results[0];
        }
        return null;
      } catch (err) {
        console.error("Erro ao buscar método de pagamento:", err);
        return null;
      }
    },
    [mp]
  );

  const getInstallments = useCallback(
    async (
      amount: number,
      bin: string,
      paymentMethodId?: string
    ): Promise<Installment[]> => {
      if (!mp || bin.length < 6) return [];

      try {
        const response = await mp.getInstallments({
          amount: String(amount),
          bin,
          paymentMethodId,
        });

        if (response && response.length > 0 && response[0].payer_costs) {
          return response[0].payer_costs.map((cost: any) => ({
            installments: cost.installments,
            installment_amount: cost.installment_amount,
            total_amount: cost.total_amount,
            recommended_message: cost.recommended_message,
          }));
        }
        return [];
      } catch (err) {
        console.error("Erro ao buscar parcelas:", err);
        return [];
      }
    },
    [mp]
  );

  return {
    mp,
    isReady,
    error,
    createCardToken,
    getPaymentMethods,
    getInstallments,
  };
};

export type { CardFormData, Installment, PaymentMethodInfo };
