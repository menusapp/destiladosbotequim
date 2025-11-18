import { useState } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, ChevronDown } from "lucide-react";
import { Product, ProductExtra } from "@/types/menu";

interface ProductDetailDrawerProps {
  product: Product | null;
  extras: ProductExtra[];
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, selectedExtras: ProductExtra[], notes?: string, quantity?: number) => void;
  restaurantName: string;
  restaurantLogo: string | null;
  primaryColor: string;
  deliveryTime?: string;
  deliveryFee?: number;
}

export const ProductDetailDrawer = ({
  product,
  extras,
  open,
  onClose,
  onAddToCart,
  restaurantName,
  restaurantLogo,
  primaryColor,
  deliveryTime = "50-60 min",
  deliveryFee = 3.0,
}: ProductDetailDrawerProps) => {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const handleExtraToggle = (extraId: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

  const handleAddToCart = () => {
    const extrasToAdd = extras.filter((e) => selectedExtras.includes(e.id));
    // Add the item quantity times
    for (let i = 0; i < quantity; i++) {
      onAddToCart(product, extrasToAdd, notes || undefined);
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setSelectedExtras([]);
    setNotes("");
    setQuantity(1);
    onClose();
  };

  const getTotalPrice = () => {
    const extrasTotal = extras
      .filter((e) => selectedExtras.includes(e.id))
      .reduce((sum, e) => sum + e.price, 0);
    return (product.price + extrasTotal) * quantity;
  };

  return (
    <Drawer open={open} onOpenChange={resetAndClose}>
      <DrawerContent className="max-h-[95vh]">
        {/* Header Image */}
        <div className="relative">
          <button
            onClick={resetAndClose}
            className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-64 object-cover"
            />
          ) : (
            <div
              className="w-full h-64 flex items-center justify-center text-white text-4xl font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {product.name.charAt(0)}
            </div>
          )}
          {/* Restaurant info overlay */}
          <div className="absolute bottom-4 left-4 bg-white rounded-full px-3 py-2 shadow-lg flex items-center gap-2">
            {restaurantLogo ? (
              <img src={restaurantLogo} alt={restaurantName} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: primaryColor }}
              >
                {restaurantName.charAt(0)}
              </div>
            )}
            <div className="text-xs">
              <p className="font-semibold text-foreground">{restaurantName}</p>
              <p className="text-muted-foreground">{deliveryTime} • R$ {deliveryFee.toFixed(2)}</p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4">
          {/* Product Info */}
          <h2 className="text-2xl font-bold text-foreground mb-2">{product.name}</h2>
          {product.description && (
            <p className="text-sm text-muted-foreground mb-2">{product.description}</p>
          )}
          {product.prep_time_minutes && (
            <p className="text-xs text-muted-foreground mb-4">
              ⏱️ Tempo de preparo: {product.prep_time_minutes} min
            </p>
          )}

          <div
            className="inline-block px-4 py-2 rounded-lg font-bold text-2xl mb-6"
            style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
          >
            R$ {product.price.toFixed(2)}
          </div>

          {/* Extras */}
          {extras.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-foreground mb-3">
                Adicionais
              </h3>
              <div className="space-y-3">
                {extras.map((extra) => {
                  const isSelected = selectedExtras.includes(extra.id);
                  return (
                    <label
                      key={extra.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-accent/50"
                          : "border-border hover:border-border/60"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleExtraToggle(extra.id)}
                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{extra.name}</p>
                      </div>
                      <p className="font-bold text-sm" style={{ color: primaryColor }}>
                        + R$ {extra.price.toFixed(2)}
                      </p>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <Label className="text-sm text-muted-foreground flex items-center gap-2 mb-2">
              💬 Alguma observação?
              <span className="ml-auto text-xs">0/140</span>
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 140))}
              placeholder="Ex: Sem cebola, ponto da carne..."
              className="resize-none min-h-[80px]"
              maxLength={140}
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-accent rounded-xl px-4 py-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-foreground"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="font-bold text-lg text-foreground min-w-[30px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                style={{ color: primaryColor }}
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={handleAddToCart}
              className="flex-1 h-12 text-base font-bold rounded-xl"
              style={{ backgroundColor: primaryColor, color: "white" }}
            >
              Adicionar • R$ {getTotalPrice().toFixed(2)}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
