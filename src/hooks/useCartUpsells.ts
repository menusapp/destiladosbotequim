import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CartItem, Product } from "@/types/menu";

/**
 * Ofertas de upsell da sacola ("peça junto com desconto").
 *
 * Configuradas no painel (Produtos → Ofertas da Sacola): quando o produto
 * gatilho está na sacola, o produto oferta aparece logo abaixo dele com
 * preço riscado + preço com desconto + badge do desconto.
 */
export interface UpsellOffer {
  id: string;
  trigger_product_id: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  product: Product;
}

/** Preço base, preço com desconto e texto da badge de uma oferta. */
export function getUpsellPricing(offer: UpsellOffer): {
  basePrice: number;
  discountedPrice: number;
  badge: string;
} {
  const basePrice = offer.product.promotional_price ?? offer.product.price;
  let discountedPrice: number;
  let badge: string;
  if (offer.discount_type === "percentage") {
    discountedPrice = basePrice * (1 - offer.discount_value / 100);
    badge = `-${Number(offer.discount_value)}%`;
  } else {
    discountedPrice = basePrice - offer.discount_value;
    badge = `-R$ ${Number(offer.discount_value).toFixed(2).replace(".", ",")}`;
  }
  discountedPrice = Math.max(0, Math.round(discountedPrice * 100) / 100);
  return { basePrice, discountedPrice, badge };
}

/**
 * Monta o CartItem da oferta: o preço com desconto entra como
 * promotional_price, então o restante do fluxo (subtotal, pedido,
 * price_at_order) usa o valor com desconto automaticamente.
 */
export function buildUpsellCartItem(offer: UpsellOffer): CartItem {
  const { discountedPrice } = getUpsellPricing(offer);
  return {
    id: crypto.randomUUID(),
    product: { ...offer.product, promotional_price: discountedPrice },
    quantity: 1,
    extras: [],
    notes: "",
  };
}

/**
 * Mapa trigger_product_id → ofertas ativas, já filtrando produtos que
 * o cliente colocou na sacola (a oferta some sozinha após adicionar).
 */
export function useCartUpsells(cart: CartItem[]): Record<string, UpsellOffer[]> {
  const [offers, setOffers] = useState<UpsellOffer[]>([]);

  // Ids dos produtos "normais" na sacola (gatilhos possíveis)
  const triggerIds = useMemo(
    () =>
      Array.from(
        new Set(
          cart
            .filter((i) => !i.isRewardItem && !i.isCouponFreeItem)
            .map((i) => i.product.id)
        )
      ),
    [cart]
  );
  const triggerKey = triggerIds.slice().sort().join(",");

  useEffect(() => {
    if (!triggerIds.length) {
      setOffers([]);
      return;
    }
    let active = true;
    (async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("product_upsells")
          .select(
            "id, trigger_product_id, discount_type, discount_value, product:products!product_upsells_upsell_product_id_fkey(id, name, description, price, promotional_price, available, image_url)"
          )
          .in("trigger_product_id", triggerIds)
          .eq("is_active", true);
        if (!active) return;
        if (error || !data) {
          setOffers([]);
          return;
        }
        setOffers(
          (data as any[])
            .filter((o) => o.product && o.product.available !== false)
            .map((o) => ({
              id: o.id,
              trigger_product_id: o.trigger_product_id,
              discount_type: o.discount_type,
              discount_value: Number(o.discount_value),
              product: o.product as Product,
            }))
        );
      } catch {
        if (active) setOffers([]);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  return useMemo(() => {
    const inCart = new Set(cart.map((i) => i.product.id));
    const map: Record<string, UpsellOffer[]> = {};
    const seen = new Set<string>();
    for (const offer of offers) {
      if (inCart.has(offer.product.id)) continue; // já adicionado
      if (seen.has(offer.product.id)) continue; // dedupe entre gatilhos
      seen.add(offer.product.id);
      (map[offer.trigger_product_id] ??= []).push(offer);
    }
    return map;
  }, [offers, cart]);
}
