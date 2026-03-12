import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface ProductExtra {
  id: string;
  name: string;
  price: number;
  is_required?: boolean;
  min_selection?: number;
  max_selection?: number;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  promotional_price?: number;
  image_url?: string;
  product_extras?: ProductExtra[];
}

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  notes?: string;
  extras: {
    extraId: string;
    name: string;
    price: number;
  }[];
}

interface PDVProductDrawerProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export const PDVProductDrawer = ({
  product,
  open,
  onClose,
  onAddToCart,
}: PDVProductDrawerProps) => {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Reset state when product changes
  useEffect(() => {
    if (open) {
      setSelectedExtras([]);
      setNotes("");
      setQuantity(1);
    }
  }, [open, product?.id]);

  const extras = product?.product_extras || [];

  // Separar extras obrigatórios dos opcionais
  const { requiredExtras, optionalExtras } = useMemo(() => {
    const required = extras.filter(e => e.is_required);
    const optional = extras.filter(e => !e.is_required);
    return { requiredExtras: required, optionalExtras: optional };
  }, [extras]);

  // Verificar se há extras obrigatórios e se foram selecionados
  const hasRequiredExtras = requiredExtras.length > 0;
  const minRequiredSelection = hasRequiredExtras ? (requiredExtras[0]?.min_selection || 1) : 0;
  const maxRequiredSelection = hasRequiredExtras ? (requiredExtras[0]?.max_selection || 1) : 0;
  
  const selectedRequiredCount = requiredExtras.filter(e => selectedExtras.includes(e.id)).length;
  const isRequiredSatisfied = !hasRequiredExtras || selectedRequiredCount >= minRequiredSelection;
  const canAddMore = !maxRequiredSelection || selectedRequiredCount < maxRequiredSelection;

  if (!product) return null;

  const handleExtraToggle = (extraId: string, isRequired: boolean) => {
    const extra = extras.find(e => e.id === extraId);
    if (!extra) return;

    if (isRequired && maxRequiredSelection === 1) {
      const otherRequiredIds = requiredExtras.filter(e => e.id !== extraId).map(e => e.id);
      setSelectedExtras(prev => {
        const withoutOtherRequired = prev.filter(id => !otherRequiredIds.includes(id));
        if (withoutOtherRequired.includes(extraId)) {
          return withoutOtherRequired.filter(id => id !== extraId);
        }
        return [...withoutOtherRequired, extraId];
      });
    } else {
      setSelectedExtras((prev) =>
        prev.includes(extraId)
          ? prev.filter((id) => id !== extraId)
          : canAddMore || !isRequired ? [...prev, extraId] : prev
      );
    }
  };

  const handleAddToCart = () => {
    if (!isRequiredSatisfied) {
      toast.error(`Selecione pelo menos ${minRequiredSelection} opção obrigatória`);
      return;
    }

    const selectedExtrasData = extras
      .filter(e => selectedExtras.includes(e.id))
      .map(e => ({
        extraId: e.id,
        name: e.name,
        price: e.price,
      }));

    const effectivePrice = product.promotional_price ?? product.price;

    const cartItem: CartItem = {
      productId: product.id,
      productName: product.name,
      quantity,
      price: effectivePrice,
      notes: notes || undefined,
      extras: selectedExtrasData,
    };

    onAddToCart(cartItem);
    onClose();
  };

  const getTotalPrice = () => {
    const extrasTotal = extras
      .filter((e) => selectedExtras.includes(e.id))
      .reduce((sum, e) => sum + e.price, 0);
    const effectivePrice = product.promotional_price ?? product.price;
    return (effectivePrice + extrasTotal) * quantity;
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        {/* Header */}
        <div className="relative border-b border-border">
          <div className="flex gap-4 p-4">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-24 h-24 object-cover rounded-lg"
              />
            ) : (
              <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center text-2xl font-bold text-muted-foreground">
                {product.name.charAt(0)}
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground truncate">{product.name}</h2>
              {product.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
              )}
              <div className="mt-2">
                {product.promotional_price ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground line-through">
                      R$ {product.price.toFixed(2)}
                    </span>
                    <span className="text-lg font-bold text-primary">
                      R$ {product.promotional_price.toFixed(2)}
                    </span>
                  </div>
                ) : (
                  <span className="text-lg font-bold text-primary">
                    R$ {product.price.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4">
          {/* Extras Obrigatórios */}
          {hasRequiredExtras && (
            <div className="mb-6">
              <h3 className="font-bold text-foreground mb-1 flex items-center gap-1">
                Escolha uma opção
                <span className="text-destructive">*</span>
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Obrigatório • Escolha {minRequiredSelection === maxRequiredSelection 
                  ? `${minRequiredSelection} opção` 
                  : `${minRequiredSelection} a ${maxRequiredSelection} opções`}
              </p>
              <div className="space-y-2">
                {maxRequiredSelection === 1 ? (
                  <RadioGroup
                    value={selectedExtras.find(id => requiredExtras.some(e => e.id === id)) || ""}
                    onValueChange={(value) => {
                      const otherRequiredIds = requiredExtras.map(e => e.id);
                      setSelectedExtras(prev => {
                        const withoutRequired = prev.filter(id => !otherRequiredIds.includes(id));
                        return [...withoutRequired, value];
                      });
                    }}
                  >
                    {requiredExtras.map((extra) => {
                      const isSelected = selectedExtras.includes(extra.id);
                      return (
                        <label
                          key={extra.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <RadioGroupItem value={extra.id} />
                          <span className="flex-1 font-medium text-foreground">{extra.name}</span>
                          <span className="font-bold text-sm text-primary">
                            + R$ {extra.price.toFixed(2)}
                          </span>
                        </label>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  requiredExtras.map((extra) => {
                    const isSelected = selectedExtras.includes(extra.id);
                    return (
                      <label
                        key={extra.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleExtraToggle(extra.id, true)}
                        />
                        <span className="flex-1 font-medium text-foreground">{extra.name}</span>
                        <span className="font-bold text-sm text-primary">
                          + R$ {extra.price.toFixed(2)}
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Extras Opcionais */}
          {optionalExtras.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-foreground mb-3">Complementos</h3>
              <div className="space-y-2">
                {optionalExtras.map((extra) => {
                  const isSelected = selectedExtras.includes(extra.id);
                  return (
                    <label
                      key={extra.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleExtraToggle(extra.id, false)}
                      />
                      <span className="flex-1 font-medium text-foreground">{extra.name}</span>
                      <span className="font-bold text-sm text-primary">
                        + R$ {extra.price.toFixed(2)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observações */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              Observações (opcional)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 140))}
              placeholder="Ex: Sem cebola, ponto da carne..."
              className="resize-none min-h-[60px]"
              maxLength={140}
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-border p-4 bg-background">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 bg-muted rounded-lg px-3 py-2">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="text-foreground hover:text-primary"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="font-bold text-lg text-foreground min-w-[30px] text-center">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="text-primary"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={!isRequiredSatisfied}
              className="flex-1 h-11"
            >
              {isRequiredSatisfied ? `Adicionar • R$ ${getTotalPrice().toFixed(2)}` : "Selecione uma opção"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
