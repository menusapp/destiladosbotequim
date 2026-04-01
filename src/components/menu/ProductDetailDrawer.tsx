import { useState, useMemo } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, ChevronDown } from "lucide-react";
import { useRef } from "react";
import { Product, ProductExtra } from "@/types/menu";
import { toast } from "@/components/ui/sonner";

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
  const notesRef = useRef<HTMLTextAreaElement>(null);

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

    // Se é obrigatório e max_selection é 1, funciona como radio (seleciona apenas um)
    if (isRequired && maxRequiredSelection === 1) {
      // Desmarcar outros obrigatórios e marcar este
      const otherRequiredIds = requiredExtras.filter(e => e.id !== extraId).map(e => e.id);
      setSelectedExtras(prev => {
        const withoutOtherRequired = prev.filter(id => !otherRequiredIds.includes(id));
        if (withoutOtherRequired.includes(extraId)) {
          return withoutOtherRequired.filter(id => id !== extraId);
        }
        return [...withoutOtherRequired, extraId];
      });
    } else {
      // Toggle normal
      setSelectedExtras((prev) =>
        prev.includes(extraId)
          ? prev.filter((id) => id !== extraId)
          : canAddMore || !isRequired ? [...prev, extraId] : prev
      );
    }
  };

  const handleAddToCart = () => {
    // Validar se extras obrigatórios foram selecionados
    if (!isRequiredSatisfied) {
      toast.error(`Selecione pelo menos ${minRequiredSelection} opção obrigatória`);
      return;
    }

    const extrasToAdd = extras.filter((e) => selectedExtras.includes(e.id));
    // Passa a quantidade diretamente ao invés de usar loop
    onAddToCart(product, extrasToAdd, notes || undefined, quantity);
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
    const effectivePrice = product.promotional_price ?? product.price;
    return (effectivePrice + extrasTotal) * quantity;
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
          <div className="absolute bottom-4 left-4 bg-white rounded-lg px-3 py-2 shadow-lg flex items-center gap-2">
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
              <p className="text-muted-foreground">
                {product.prep_time_minutes ? `${product.prep_time_minutes} min` : deliveryTime}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-4">
          {/* Product Info */}
          <h2 className="text-2xl font-bold text-foreground mb-2">{product.name}</h2>
          {product.description && (
            <p className="text-sm text-muted-foreground mb-4">{product.description}</p>
          )}

          {product.promotional_price ? (
            <div className="flex flex-col gap-1 mb-6">
              <span className="text-sm text-muted-foreground line-through">
                R$ {product.price.toFixed(2)}
              </span>
              <span
                className="inline-block px-4 py-2 rounded-lg font-bold text-2xl"
                style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
              >
                R$ {product.promotional_price.toFixed(2)}
              </span>
            </div>
          ) : (
            <div
              className="inline-block px-4 py-2 rounded-lg font-bold text-2xl mb-6"
              style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
            >
              R$ {product.price.toFixed(2)}
            </div>
          )}

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
              <div className="space-y-3">
                {maxRequiredSelection === 1 ? (
                  // Radio group para seleção única
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
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-primary bg-accent/50"
                              : "border-border hover:border-border/60"
                          }`}
                        >
                          <RadioGroupItem value={extra.id} className="text-primary" />
                          <div className="flex-1">
                            <p className="font-medium text-foreground">{extra.name}</p>
                          </div>
                          <p className="font-bold text-sm" style={{ color: primaryColor }}>
                            + R$ {extra.price.toFixed(2)}
                          </p>
                        </label>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  // Checkboxes para seleção múltipla
                  requiredExtras.map((extra) => {
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
                          onCheckedChange={() => handleExtraToggle(extra.id, true)}
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
                  })
                )}
              </div>
            </div>
          )}

          {/* Extras Opcionais */}
          {optionalExtras.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold text-foreground mb-3">
                Complementos
              </h3>
              <div className="space-y-3">
                {optionalExtras.map((extra) => {
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
                        onCheckedChange={() => handleExtraToggle(extra.id, false)}
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
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 140))}
              onFocus={() => {
                setTimeout(() => {
                  notesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
              }}
              placeholder="Ex: Sem cebola, ponto da carne..."
              className="resize-none min-h-[80px]"
              maxLength={140}
            />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-border p-4 bg-background my-0 mb-0">
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
              disabled={!isRequiredSatisfied}
              className="flex-1 h-12 text-base font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: isRequiredSatisfied ? primaryColor : undefined, color: isRequiredSatisfied ? "white" : undefined }}
            >
              {isRequiredSatisfied ? `Adicionar • R$ ${getTotalPrice().toFixed(2)}` : "Selecione uma opção"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
