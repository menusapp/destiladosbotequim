import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Minus, Plus } from "lucide-react";
import { Product, ProductExtra } from "@/types/menu";
import { toast } from "@/components/ui/sonner";

interface Props {
  product: Product;
  extras: ProductExtra[];
  primaryColor: string;
  onAdd: (product: Product, extras: ProductExtra[], notes?: string, quantity?: number) => void;
  onBack: () => void;
}

export function KioskProductDetail({ product, extras, primaryColor, onAdd, onBack }: Props) {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

  const { requiredExtras, optionalExtrasGrouped } = useMemo(() => {
    const required = extras.filter(e => e.is_required);
    const optional = extras.filter(e => !e.is_required);
    const grouped: { categoryName: string; items: ProductExtra[] }[] = [];
    const uncategorized: ProductExtra[] = [];
    const categoryMap = new Map<string, ProductExtra[]>();
    for (const ext of optional) {
      const catName = ext.extra_category_name;
      if (catName) {
        if (!categoryMap.has(catName)) categoryMap.set(catName, []);
        categoryMap.get(catName)!.push(ext);
      } else {
        uncategorized.push(ext);
      }
    }
    for (const [name, items] of categoryMap) {
      grouped.push({ categoryName: name, items });
    }
    if (uncategorized.length > 0) {
      grouped.push({ categoryName: "Adicionais", items: uncategorized });
    }
    return { requiredExtras: required, optionalExtrasGrouped: grouped };
  }, [extras]);

  const hasRequired = requiredExtras.length > 0;
  const minRequired = hasRequired ? (requiredExtras[0]?.min_selection || 1) : 0;
  const maxRequired = hasRequired ? (requiredExtras[0]?.max_selection || 1) : 0;
  const selectedRequiredCount = requiredExtras.filter(e => selectedExtras.includes(e.id)).length;
  const isRequiredSatisfied = !hasRequired || selectedRequiredCount >= minRequired;

  const toggleExtra = (id: string, isRequired: boolean) => {
    if (isRequired && maxRequired === 1) {
      setSelectedExtras(prev => {
        const withoutRequired = prev.filter(eid => !requiredExtras.some(re => re.id === eid));
        return [...withoutRequired, id];
      });
      return;
    }
    setSelectedExtras(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const effectivePrice = product.promotional_price ?? product.price;
  const extrasTotal = extras.filter(e => selectedExtras.includes(e.id)).reduce((s, e) => s + e.price, 0);
  const itemTotal = (effectivePrice + extrasTotal) * quantity;

  const handleAdd = () => {
    if (!isRequiredSatisfied) {
      toast.error(`Selecione pelo menos ${minRequired} opção obrigatória`);
      return;
    }
    const selected = extras.filter(e => selectedExtras.includes(e.id));
    onAdd(product, selected, notes || undefined, quantity);
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 p-6 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-14 w-14 rounded-full">
          <ArrowLeft className="h-8 w-8" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground truncate">{product.name}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6">
          {product.image_url && (
            <img src={product.image_url} alt={product.name} className="w-full max-h-72 object-cover rounded-2xl mb-6" />
          )}

          {product.description && <p className="text-lg text-muted-foreground mb-6">{product.description}</p>}

          <div className="flex items-center gap-3 mb-6">
            {product.promotional_price != null && (
              <span className="text-lg line-through text-muted-foreground">R$ {product.price.toFixed(2)}</span>
            )}
            <span className="text-3xl font-bold" style={{ color: primaryColor }}>R$ {effectivePrice.toFixed(2)}</span>
          </div>

          {/* Required extras */}
          {hasRequired && (
            <div className="mb-6">
              <h3 className="text-lg font-bold mb-1 text-foreground">
                Escolha obrigatória
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {maxRequired === 1 ? "(escolha 1)" : `(mín. ${minRequired}, máx. ${maxRequired})`}
                </span>
              </h3>
              {maxRequired === 1 ? (
                <RadioGroup value={selectedExtras.find(id => requiredExtras.some(e => e.id === id)) || ""} onValueChange={(v) => toggleExtra(v, true)}>
                  {requiredExtras.map(ext => (
                    <label key={ext.id} className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={ext.id} />
                        <span className="text-base">{ext.name}</span>
                      </div>
                      {ext.price > 0 && <span className="text-base font-medium" style={{ color: primaryColor }}>+ R$ {ext.price.toFixed(2)}</span>}
                    </label>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {requiredExtras.map(ext => (
                    <label key={ext.id} className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-muted transition-colors">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={selectedExtras.includes(ext.id)} onCheckedChange={() => toggleExtra(ext.id, true)} />
                        <span className="text-base">{ext.name}</span>
                      </div>
                      {ext.price > 0 && <span className="text-base font-medium" style={{ color: primaryColor }}>+ R$ {ext.price.toFixed(2)}</span>}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Optional extras - grouped by category */}
          {optionalExtrasGrouped.map((group, gi) => (
            <div key={gi} className="mb-6">
              <h3 className="text-lg font-bold mb-1 text-foreground">{group.categoryName}</h3>
              <div className="space-y-2">
                {group.items.map(ext => (
                  <label key={ext.id} className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedExtras.includes(ext.id)} onCheckedChange={() => toggleExtra(ext.id, false)} />
                      <div>
                        <span className="text-base">{ext.name}</span>
                        {ext.description && (
                          <p className="text-xs text-muted-foreground leading-tight mt-0.5">{ext.description}</p>
                        )}
                      </div>
                    </div>
                    {ext.price > 0 && <span className="text-base font-medium" style={{ color: primaryColor }}>+ R$ {ext.price.toFixed(2)}</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {/* Notes */}
          <div className="mb-6">
            <Label className="text-lg font-bold">Observação</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex: sem cebola, ponto da carne..." className="mt-2 text-base h-24" />
          </div>
        </div>
      </div>

      {/* Bottom action */}
      <div className="border-t bg-card p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 bg-muted rounded-xl p-2">
          <Button variant="ghost" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-12 w-12 rounded-xl">
            <Minus className="h-6 w-6" />
          </Button>
          <span className="text-2xl font-bold w-8 text-center text-foreground">{quantity}</span>
          <Button variant="ghost" size="icon" onClick={() => setQuantity(q => q + 1)} className="h-12 w-12 rounded-xl">
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        <Button
          onClick={handleAdd}
          className="flex-1 h-16 text-xl font-bold rounded-xl text-white"
          style={{ backgroundColor: primaryColor }}
          disabled={!isRequiredSatisfied}
        >
          Adicionar • R$ {itemTotal.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
