import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, Ticket } from "lucide-react";
import { CartItem } from "@/types/menu";
import { Card } from "@/components/ui/card";
import { UpsellOfferCard } from "./UpsellOfferCard";
import { useCartUpsells, buildUpsellCartItem, UpsellOffer } from "@/hooks/useCartUpsells";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  items: CartItem[];
  restaurantName: string;
  restaurantLogo: string | null;
  primaryColor: string;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  onAddMoreItems: () => void;
  onContinue: () => void;
  mode: "delivery" | "local"; // delivery = sacola, local = comanda
  onAddItem?: (item: CartItem) => void;
}

export const CartDrawer = ({
  open,
  onClose,
  items,
  restaurantName,
  restaurantLogo,
  primaryColor,
  onUpdateQuantity,
  onClearCart,
  onAddMoreItems,
  onContinue,
  mode,
  onAddItem,
}: CartDrawerProps) => {
  const upsellsByTrigger = useCartUpsells(items);

  const handleAddUpsell = (offer: UpsellOffer) => {
    if (!onAddItem) return;
    onAddItem(buildUpsellCartItem(offer));
  };
  const total = items.reduce((sum, item) => {
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const effectivePrice = item.product.promotional_price ?? item.product.price;
    return sum + (effectivePrice + extrasTotal) * item.quantity;
  }, 0);

  const title = mode === "delivery" ? "SACOLA" : "COMANDA";

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <button onClick={onClose} className="text-muted-foreground">
              ✕
            </button>
            <DrawerTitle className="text-lg font-bold">{title}</DrawerTitle>
            <button onClick={onClearCart} className="text-destructive text-sm font-medium">
              Limpar
            </button>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto flex-1 px-4 py-4">
          {/* Restaurant Info */}
          <div className="flex items-center gap-3 mb-4">
            {restaurantLogo ? (
              <img src={restaurantLogo} alt={restaurantName} className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                {restaurantName.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-bold text-foreground">{restaurantName}</h3>
              <button
                onClick={onAddMoreItems}
                className="text-sm font-medium"
                style={{ color: primaryColor }}
              >
                Adicionar mais itens
              </button>
            </div>
          </div>

          {/* Items */}
          <div className="mb-6">
            <h4 className="font-bold text-foreground mb-3">Itens adicionados</h4>
            <div className="space-y-3">
              {items.map((item) => {
                const effectivePrice = item.product.promotional_price ?? item.product.price;
                const itemTotal =
                  (effectivePrice + item.extras.reduce((s, e) => s + e.price, 0)) *
                  item.quantity;

                const itemUpsells = upsellsByTrigger[item.product.id] || [];

                return (
                  <div key={item.id}>
                  <Card className="p-3">
                    <div className="flex gap-3">
                      {item.product.image_url && (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h5 className="font-bold text-sm text-foreground">
                            {item.product.name}
                          </h5>
                          <button
                            onClick={() => onUpdateQuantity(item.id, -item.quantity)}
                            className="text-destructive flex-shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        {item.extras.length > 0 && (
                          <p className="text-xs text-muted-foreground mb-1">
                            {item.extras.map((e) => e.name).join(", ")}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-muted-foreground mb-1">
                            Obs: {item.notes}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <p className="font-bold text-sm" style={{ color: primaryColor }}>
                            R$ {itemTotal.toFixed(2)}
                          </p>
                          <div className="flex items-center gap-3 bg-accent/50 rounded-full px-3 py-1">
                            <button
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="text-foreground"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="font-bold text-foreground min-w-[20px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              style={{ color: primaryColor }}
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                  {/* Ofertas "peça junto com desconto" deste item */}
                  {onAddItem &&
                    itemUpsells.map((offer) => (
                      <UpsellOfferCard key={offer.id} offer={offer} onAdd={handleAddUpsell} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coupon */}
          <Card className="p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Cupom</span>
              </div>
              <button className="text-sm font-medium" style={{ color: primaryColor }}>
                Adicionar
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Digite um código</p>
          </Card>
        </div>

        {/* Bottom */}
        <div className="border-t border-border p-4 bg-background">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">
              Total {mode === "delivery" ? "sem a entrega" : "parcial"}
            </span>
            <span className="text-lg font-bold text-foreground">R$ {total.toFixed(2)}</span>
          </div>
          <Button
            onClick={onContinue}
            className="w-full h-12 text-base font-bold rounded-xl"
            style={{ backgroundColor: primaryColor, color: "white" }}
          >
            Continuar
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
