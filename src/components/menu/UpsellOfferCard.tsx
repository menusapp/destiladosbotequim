import { Plus, Sparkles } from "lucide-react";
import { UpsellOffer, getUpsellPricing } from "@/hooks/useCartUpsells";

interface UpsellOfferCardProps {
  offer: UpsellOffer;
  onAdd: (offer: UpsellOffer) => void;
}

/**
 * Card de oferta na sacola: "Peça junto com desconto".
 * Preço original riscado, preço com desconto em verde/negrito e
 * badge com o tamanho do desconto.
 */
export const UpsellOfferCard = ({ offer, onAdd }: UpsellOfferCardProps) => {
  const { basePrice, discountedPrice, badge } = getUpsellPricing(offer);

  return (
    <div className="relative mt-2 ml-4 rounded-xl border-2 border-dashed border-green-500/60 bg-green-50 dark:bg-green-950/30 p-3">
      {/* Badge de desconto */}
      <span className="absolute -top-2.5 right-3 rounded-full bg-green-600 px-2 py-0.5 text-[11px] font-bold text-white shadow">
        {badge}
      </span>

      <div className="flex items-center gap-3">
        {offer.product.image_url ? (
          <img
            src={offer.product.image_url}
            alt={offer.product.name}
            className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-green-600" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700 dark:text-green-400">
            Peça junto com desconto
          </p>
          <h5 className="font-bold text-sm text-foreground truncate">
            {offer.product.name}
          </h5>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground line-through">
              R$ {basePrice.toFixed(2).replace(".", ",")}
            </span>
            <span className="text-base font-extrabold text-green-600">
              R$ {discountedPrice.toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        <button
          onClick={() => onAdd(offer)}
          className="flex items-center gap-1 rounded-full bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-3 py-2 flex-shrink-0 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Adicionar
        </button>
      </div>
    </div>
  );
};
