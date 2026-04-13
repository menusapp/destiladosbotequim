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

interface ExtraGroup {
  categoryName: string;
  categoryId?: string;
  isRequired: boolean;
  minSelection: number;
  maxSelection: number;
  items: ProductExtra[];
}

export function KioskProductDetail({ product, extras, primaryColor, onAdd, onBack }: Props) {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [quantity, setQuantity] = useState(1);

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
    // Sort: "Qual pão você gostaria?" first, then others
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
    if (group.maxSelection === 1 && group.isRequired) {
      // Radio behavior: deselect others in this group, select this one
      setSelectedExtras(prev => {
        const groupIds = new Set(group.items.map(i => i.id));
        const withoutGroup = prev.filter(eid => !groupIds.has(eid));
        return [...withoutGroup, id];
      });
      return;
    }
    if (group.maxSelection === 1) {
      // Optional but max 1: toggle within group
      setSelectedExtras(prev => {
        const groupIds = new Set(group.items.map(i => i.id));
        const withoutGroup = prev.filter(eid => !groupIds.has(eid));
        if (prev.includes(id)) return withoutGroup;
        return [...withoutGroup, id];
      });
      return;
    }
    // Multi-select with max limit
    setSelectedExtras(prev => {
      if (prev.includes(id)) return prev.filter(e => e !== id);
      if (group.maxSelection > 0) {
        const groupIds = new Set(group.items.map(i => i.id));
        const currentCount = prev.filter(eid => groupIds.has(eid)).length;
        if (currentCount >= group.maxSelection) {
          toast.error(`Máximo de ${group.maxSelection} itens nesta categoria`);
          return prev;
        }
      }
      return [...prev, id];
    });
  };

  // Validate all required groups
  const allRequiredSatisfied = groups.every(group => {
    if (!group.isRequired) return true;
    const min = group.minSelection || 1;
    const groupIds = new Set(group.items.map(i => i.id));
    const count = selectedExtras.filter(id => groupIds.has(id)).length;
    return count >= min;
  });

  const effectivePrice = product.promotional_price ?? product.price;
  const extrasTotal = extras.filter(e => selectedExtras.includes(e.id)).reduce((s, e) => s + e.price, 0);
  const itemTotal = (effectivePrice + extrasTotal) * quantity;

  const handleAdd = () => {
    if (!allRequiredSatisfied) {
      toast.error("Selecione todas as opções obrigatórias");
      return;
    }
    const selected = extras.filter(e => selectedExtras.includes(e.id));
    onAdd(product, selected, notes || undefined, quantity);
  };

  const renderGroup = (group: ExtraGroup, index: number) => {
    const groupIds = new Set(group.items.map(i => i.id));
    const selectedInGroup = selectedExtras.filter(id => groupIds.has(id));
    const isRadio = group.maxSelection === 1;

    const selectionHint = group.isRequired
      ? isRadio ? "(escolha 1)" : `(mín. ${group.minSelection || 1}, máx. ${group.maxSelection})`
      : group.maxSelection > 0 ? `(máx. ${group.maxSelection})` : "";

    return (
      <div key={index} className="mb-6">
        <h3 className="text-lg font-bold mb-1 text-foreground">
          {group.categoryName}
          {group.isRequired && (
            <span className="text-sm font-semibold text-red-500 ml-2">(obrigatório)</span>
          )}
          {selectionHint && (
            <span className="text-sm font-normal text-muted-foreground ml-2">{selectionHint}</span>
          )}
        </h3>

        {isRadio && group.isRequired ? (
          <RadioGroup
            value={selectedInGroup[0] || ""}
            onValueChange={(v) => toggleExtra(v, group)}
          >
            {group.items.map(ext => (
              <label key={ext.id} className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={ext.id} />
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
          </RadioGroup>
        ) : (
          <div className="space-y-2">
            {group.items.map(ext => (
              <label key={ext.id} className="flex items-center justify-between p-4 rounded-xl border cursor-pointer hover:bg-muted transition-colors">
                <div className="flex items-center gap-3">
                  <Checkbox checked={selectedExtras.includes(ext.id)} onCheckedChange={() => toggleExtra(ext.id, group)} />
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
        )}
      </div>
    );
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

          {groups.map((group, i) => renderGroup(group, i))}

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
          disabled={!allRequiredSatisfied}
        >
          Adicionar • R$ {itemTotal.toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
