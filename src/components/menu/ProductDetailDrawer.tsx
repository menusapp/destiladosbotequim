import { useState, useMemo, useRef } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus, ChevronDown } from "lucide-react";
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

interface ExtraGroup {
  categoryName: string;
  categoryId?: string;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  items: ProductExtra[];
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
}: ProductDetailDrawerProps) => {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  const groups = useMemo(() => {
    const groupMap = new Map<string, ExtraGroup>();
    for (const ext of extras) {
      const key = ext.extra_category_name || ext.extra_category_id || "__uncategorized__";
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          categoryName: ext.extra_category_name || "Variações",
          categoryId: ext.extra_category_id,
          isRequired: ext.is_required || false,
          minSelection: ext.min_selection || 0,
          maxSelection: ext.max_selection || 0,
          items: [],
        });
      }
      groupMap.get(key)!.items.push(ext);
    }
    const groupList = Array.from(groupMap.values());
    groupList.sort((a, b) => {
      const aIsPao = a.categoryName.toLowerCase().includes("qual pão");
      const bIsPao = b.categoryName.toLowerCase().includes("qual pão");
      if (aIsPao && !bIsPao) return -1;
      if (!aIsPao && bIsPao) return 1;
      return 0;
    });
    return groupList;
  }, [extras]);

  const toggleExtra = (id: string, group: ExtraGroup) => {
    const groupIds = new Set(group.items.map(i => i.id));
    if (group.maxSelection === 1) {
      setSelectedExtras(prev => {
        const withoutGroup = prev.filter(eid => !groupIds.has(eid));
        if (prev.includes(id) && !group.isRequired) return withoutGroup;
        return [...withoutGroup, id];
      });
      return;
    }
    setSelectedExtras(prev => {
      if (prev.includes(id)) return prev.filter(e => e !== id);
      if (group.maxSelection > 0) {
        const currentCount = prev.filter(eid => groupIds.has(eid)).length;
        if (currentCount >= group.maxSelection) {
          toast.error(`Máximo de ${group.maxSelection} itens nesta categoria`);
          return prev;
        }
      }
      return [...prev, id];
    });
  };

  const allRequiredSatisfied = groups.every(group => {
    if (!group.isRequired) return true;
    const min = group.minSelection || 1;
    const groupIds = new Set(group.items.map(i => i.id));
    const count = selectedExtras.filter(id => groupIds.has(id)).length;
    return count >= min;
  });

  if (!product) return null;

  const handleAddToCart = () => {
    if (!allRequiredSatisfied) {
      toast.error("Selecione todas as opções obrigatórias");
      return;
    }
    const extrasToAdd = extras.filter((e) => selectedExtras.includes(e.id));
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
    const extrasTotal = extras.filter((e) => selectedExtras.includes(e.id)).reduce((sum, e) => sum + e.price, 0);
    const effectivePrice = product.promotional_price ?? product.price;
    return (effectivePrice + extrasTotal) * quantity;
  };

  const renderGroup = (group: ExtraGroup, index: number) => {
    const groupIds = new Set(group.items.map(i => i.id));
    const selectedInGroup = selectedExtras.filter(id => groupIds.has(id));
    const isRadio = group.maxSelection === 1;

    const selectionHint = group.isRequired
      ? isRadio ? "Escolha 1 opção" : `Escolha ${group.minSelection || 1} a ${group.maxSelection} opções`
      : group.maxSelection > 0 ? `Até ${group.maxSelection} opções` : "";

    return (
      <div key={index} className="mb-6">
        <h3 className="font-bold text-foreground mb-1 flex items-center gap-1">
          {group.categoryName}
          {group.isRequired && <span className="text-destructive">*</span>}
        </h3>
        {selectionHint && (
          <p className="text-xs text-muted-foreground mb-3">
            {group.isRequired ? "Obrigatório • " : ""}{selectionHint}
          </p>
        )}
        <div className="space-y-3">
          {isRadio && group.isRequired ? (
            <RadioGroup
              value={selectedInGroup[0] || ""}
              onValueChange={(v) => toggleExtra(v, group)}
            >
              {group.items.map((extra) => {
                const isSelected = selectedExtras.includes(extra.id);
                return (
                  <label
                    key={extra.id}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSelected ? `${primaryColor}12` : 'transparent',
                      borderColor: isSelected ? `${primaryColor}40` : 'hsl(var(--border))',
                    }}
                  >
                    <RadioGroupItem value={extra.id} style={{ color: primaryColor }} />
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{extra.name}</p>
                      {extra.description && (
                        <p className="text-xs text-muted-foreground leading-tight mt-0.5">{extra.description}</p>
                      )}
                    </div>
                    {extra.price > 0 && (
                      <p className="font-bold text-sm" style={{ color: primaryColor }}>
                        + R$ {extra.price.toFixed(2)}
                      </p>
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
                  className="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all"
                  style={{
                    backgroundColor: isSelected ? `${primaryColor}12` : 'transparent',
                    borderColor: isSelected ? `${primaryColor}40` : 'hsl(var(--border))',
                  }}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleExtra(extra.id, group)}
                    style={isSelected ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{extra.name}</p>
                    {extra.description && (
                      <p className="text-xs text-muted-foreground leading-tight mt-0.5">{extra.description}</p>
                    )}
                  </div>
                  {extra.price > 0 && (
                    <p className="font-bold text-sm" style={{ color: primaryColor }}>
                      + R$ {extra.price.toFixed(2)}
                    </p>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>
    );
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

          {/* All groups rendered by category */}
          {groups.map((group, i) => renderGroup(group, i))}

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
              disabled={!allRequiredSatisfied}
              className="flex-1 h-12 text-base font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: allRequiredSatisfied ? primaryColor : undefined, color: allRequiredSatisfied ? "white" : undefined }}
            >
              {allRequiredSatisfied ? `Adicionar • R$ ${getTotalPrice().toFixed(2)}` : "Selecione as opções obrigatórias"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
