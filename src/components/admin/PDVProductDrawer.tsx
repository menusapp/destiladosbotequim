import { useState, useMemo, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface ProductExtra {
  id: string;
  name: string;
  price: number;
  is_required?: boolean;
  min_selection?: number;
  max_selection?: number;
  extra_category_id?: string | null;
  extra_category_name?: string;
  extra_categories?: { name: string } | null;
  group_order?: number;
  is_complement?: boolean;
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
    is_complement?: boolean;
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

  const extras = useMemo(() => product?.product_extras ?? [], [product?.product_extras]);

  // Agrupar TODOS os extras por categoria real
  const groupedExtras = useMemo(() => {
    const groups: Record<string, {
      name: string;
      items: ProductExtra[];
      isRequired: boolean;
      minSelection: number;
      maxSelection: number;
      sortOrder: number;
    }> = {};

    extras.forEach((extra) => {
      const explicitCategoryName = extra.extra_categories?.name || extra.extra_category_name;
      const catId = extra.extra_category_id || (explicitCategoryName ? `named:${explicitCategoryName}` : extra.is_required ? "variations" : "ungrouped");
      const catName = explicitCategoryName || (extra.is_required ? "Variações" : "Complementos");
      const sortOrder = extra.group_order ?? (catName === "Variações" ? -1 : 9999);

      if (!groups[catId]) {
        groups[catId] = {
          name: catName,
          items: [],
          isRequired: !!extra.is_required,
          minSelection: extra.min_selection || (extra.is_required ? 1 : 0),
          maxSelection: extra.max_selection || 0,
          sortOrder,
        };
      } else {
        groups[catId].sortOrder = Math.min(groups[catId].sortOrder, sortOrder);
        groups[catId].isRequired = groups[catId].isRequired || !!extra.is_required;
        groups[catId].minSelection = Math.max(groups[catId].minSelection, extra.min_selection || 0);
        groups[catId].maxSelection = Math.max(groups[catId].maxSelection, extra.max_selection || 0);
      }

      groups[catId].items.push(extra);
    });

    return Object.entries(groups).sort(([, a], [, b]) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      if (a.name === "Variações" && b.name !== "Variações") return -1;
      if (a.name !== "Variações" && b.name === "Variações") return 1;
      if (a.isRequired && !b.isRequired) return -1;
      if (!a.isRequired && b.isRequired) return 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
  }, [extras]);

  // Verificar se todos os grupos obrigatórios foram satisfeitos
  const allRequiredSatisfied = useMemo(() => {
    return groupedExtras.every(([, group]) => {
      if (!group.isRequired) return true;
      const selectedInGroup = group.items.filter(e => selectedExtras.includes(e.id)).length;
      return selectedInGroup >= group.minSelection;
    });
  }, [groupedExtras, selectedExtras]);

  if (!product) return null;

  const handleExtraToggle = (extraId: string, groupKey: string) => {
    const group = groupedExtras.find(([k]) => k === groupKey)?.[1];
    if (!group) return;

    if (group.isRequired && group.maxSelection === 1) {
      // Radio behavior: deselect others in same group, select this one
      const groupIds = group.items.map(e => e.id);
      setSelectedExtras(prev => {
        const withoutGroup = prev.filter(id => !groupIds.includes(id));
        return [...withoutGroup, extraId];
      });
    } else {
      // Checkbox behavior
      const selectedInGroup = group.items.filter(e => selectedExtras.includes(e.id)).length;
      setSelectedExtras(prev => {
        if (prev.includes(extraId)) {
          return prev.filter(id => id !== extraId);
        }
        if (group.maxSelection && selectedInGroup >= group.maxSelection) return prev;
        return [...prev, extraId];
      });
    }
  };

  const handleAddToCart = () => {
    if (!allRequiredSatisfied) {
      toast.error("Selecione as opções obrigatórias");
      return;
    }

    const selectedExtrasData = extras
      .filter(e => selectedExtras.includes(e.id))
      .map(e => ({
        extraId: e.id,
        name: e.name,
        price: e.price,
        is_complement: e.is_complement,
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
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
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
          {/* Extras agrupados por categoria */}
          {groupedExtras.map(([catId, group]) => {
            const selectedInGroup = group.items.filter(e => selectedExtras.includes(e.id)).length;
            return (
              <div key={catId} className="mb-6">
                <h3 className="font-bold text-foreground mb-1 flex items-center gap-1">
                  {group.name}
                  {group.isRequired && <span className="text-destructive">*</span>}
                </h3>
                <p className="text-xs text-muted-foreground mb-3">
                  {group.isRequired ? "Obrigatório • " : "Opcional • "}
                  {group.minSelection === group.maxSelection && group.maxSelection > 0
                    ? `Escolha ${group.minSelection} opção`
                    : group.maxSelection > 0
                      ? `Escolha ${group.minSelection} a ${group.maxSelection} opções`
                      : "Escolha quantas quiser"}
                  {group.isRequired && selectedInGroup < group.minSelection && (
                    <span className="text-destructive ml-1">
                      (falta {group.minSelection - selectedInGroup})
                    </span>
                  )}
                </p>
                <div className="space-y-2">
                  {group.isRequired && group.maxSelection === 1 ? (
                    <RadioGroup
                      value={selectedExtras.find(id => group.items.some(e => e.id === id)) || ""}
                      onValueChange={(value) => handleExtraToggle(value, catId)}
                    >
                      {group.items.map((extra) => {
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
                            {extra.price > 0 && (
                              <span className="font-bold text-sm text-primary">
                                + R$ {extra.price.toFixed(2)}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </RadioGroup>
                  ) : (
                    group.items.map((extra) => {
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
                            onCheckedChange={() => handleExtraToggle(extra.id, catId)}
                          />
                          <span className="flex-1 font-medium text-foreground">{extra.name}</span>
                          {extra.price > 0 && (
                            <span className="font-bold text-sm text-primary">
                              + R$ {extra.price.toFixed(2)}
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

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
        <div className="border-t border-border p-4 bg-background pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-2 py-1">
              <button
                type="button"
                aria-label="Diminuir quantidade"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="h-11 w-11 flex items-center justify-center rounded-md text-foreground hover:bg-background active:scale-95 transition-all touch-manipulation"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="font-bold text-lg text-foreground min-w-[28px] text-center">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Aumentar quantidade"
                onClick={() => setQuantity(quantity + 1)}
                className="h-11 w-11 flex items-center justify-center rounded-md text-primary hover:bg-background active:scale-95 transition-all touch-manipulation"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <Button
              onClick={handleAddToCart}
              disabled={!allRequiredSatisfied}
              className="flex-1 h-12 text-base font-semibold"
            >
              {allRequiredSatisfied ? `Adicionar • R$ ${getTotalPrice().toFixed(2)}` : "Selecione as opções obrigatórias"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
