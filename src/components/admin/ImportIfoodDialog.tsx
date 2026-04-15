import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAllUsedPdvCodes } from "@/lib/pdvCodeGenerator";
import { Loader2, ChevronDown, ChevronRight, Link2 } from "lucide-react";

interface IfoodItem {
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  selected: boolean;
  editPrice: string;
}

interface IfoodCategory {
  name: string;
  items: IfoodItem[];
  expanded: boolean;
  selected: boolean;
}

interface ImportIfoodDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  onImportComplete: () => void;
}

const ImportIfoodDialog = ({ open, onOpenChange, restaurantId, onImportComplete }: ImportIfoodDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState<IfoodCategory[]>([]);
  const [ifoodUrl, setIfoodUrl] = useState("");
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!open) {
      setFetched(false);
      setCategories([]);
      setIfoodUrl("");
    }
  }, [open]);

  const fetchCatalog = async () => {
    if (!ifoodUrl.trim()) {
      toast.error("Cole o link do restaurante no iFood");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ifood-catalog", {
        body: { url: ifoodUrl.trim() },
      });

      if (error || data?.error) {
        toast.error(data?.error || "Erro ao buscar cardápio do iFood");
        return;
      }

      const cats: IfoodCategory[] = (data.categories || []).map((c: any) => ({
        name: c.name,
        expanded: true,
        selected: true,
        items: (c.items || []).map((item: any) => ({
          name: item.name,
          description: item.description || "",
          price: item.price || 0,
          image_url: item.image_url || null,
          selected: true,
          editPrice: String(item.price || 0),
        })),
      }));

      setCategories(cats);
      setFetched(true);

      if (cats.length === 0) {
        toast.info("Nenhum produto encontrado no cardápio");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao conectar com o iFood");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (idx: number) => {
    setCategories(prev => prev.map((c, i) => {
      if (i !== idx) return c;
      const newSel = !c.selected;
      return { ...c, selected: newSel, items: c.items.map(it => ({ ...it, selected: newSel })) };
    }));
  };

  const toggleItem = (catIdx: number, itemIdx: number) => {
    setCategories(prev => prev.map((c, ci) => {
      if (ci !== catIdx) return c;
      const newItems = c.items.map((it, ii) => ii === itemIdx ? { ...it, selected: !it.selected } : it);
      return { ...c, items: newItems, selected: newItems.some(it => it.selected) };
    }));
  };

  const updatePrice = (catIdx: number, itemIdx: number, value: string) => {
    setCategories(prev => prev.map((c, ci) => {
      if (ci !== catIdx) return c;
      return { ...c, items: c.items.map((it, ii) => ii === itemIdx ? { ...it, editPrice: value } : it) };
    }));
  };

  const toggleExpand = (idx: number) => {
    setCategories(prev => prev.map((c, i) => i === idx ? { ...c, expanded: !c.expanded } : c));
  };

  const totalSelected = categories.reduce((acc, c) => acc + c.items.filter(i => i.selected).length, 0);

  const handleImport = async () => {
    if (totalSelected === 0) {
      toast.error("Selecione ao menos um produto");
      return;
    }

    setImporting(true);
    try {
      const { data: existingCats } = await supabase
        .from("categories")
        .select("id, name")
        .eq("restaurant_id", restaurantId);

      const catMap = new Map<string, string>();
      for (const ec of existingCats || []) {
        catMap.set(ec.name.toLowerCase().trim(), ec.id);
      }

      const usedCodes = await getAllUsedPdvCodes(restaurantId);
      let nextCode = 1;
      const getNextCode = () => {
        while (usedCodes.has(nextCode)) nextCode++;
        const code = String(nextCode).padStart(3, "0");
        usedCodes.add(nextCode);
        nextCode++;
        return code;
      };

      let importedCount = 0;

      for (const cat of categories) {
        const selectedItems = cat.items.filter(i => i.selected);
        if (selectedItems.length === 0) continue;

        let categoryId = catMap.get(cat.name.toLowerCase().trim());
        if (!categoryId) {
          const { data: newCat, error: catErr } = await supabase
            .from("categories")
            .insert({ name: cat.name, restaurant_id: restaurantId })
            .select("id")
            .single();

          if (catErr) {
            console.error("Error creating category:", catErr);
            continue;
          }
          categoryId = newCat.id;
          catMap.set(cat.name.toLowerCase().trim(), categoryId);
        }

        for (const item of selectedItems) {
          const price = parseFloat(item.editPrice) || item.price || 0;
          const pdvCode = getNextCode();

          const { error: prodErr } = await supabase
            .from("products")
            .insert({
              name: item.name,
              description: item.description || null,
              price,
              category_id: categoryId,
              available: true,
              image_url: item.image_url,
              pdv_code: pdvCode,
            } as any);

          if (prodErr) {
            console.error("Error creating product:", prodErr);
          } else {
            importedCount++;
          }
        }
      }

      toast.success(`${importedCount} produto(s) importado(s) com sucesso!`);
      onImportComplete();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao importar produtos");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Cardápio do iFood</DialogTitle>
          <DialogDescription>
            Cole o link do restaurante no iFood para importar os produtos
          </DialogDescription>
        </DialogHeader>

        {!fetched ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Link do restaurante no iFood</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="https://www.ifood.com.br/delivery/cidade/restaurante/..."
                    value={ifoodUrl}
                    onChange={(e) => setIfoodUrl(e.target.value)}
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
                <Button onClick={fetchCatalog} disabled={loading || !ifoodUrl.trim()}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Buscar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Abra o restaurante no iFood, copie o link da barra de endereço e cole aqui
              </p>
            </div>
          </div>
        ) : categories.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <p className="text-muted-foreground">Nenhum produto encontrado no cardápio</p>
            <Button variant="outline" onClick={() => setFetched(false)}>Tentar outro link</Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {categories.map((cat, catIdx) => (
                <div key={catIdx} className="border rounded-lg">
                  <div className="flex items-center gap-2 p-3 bg-muted/30">
                    <button onClick={() => toggleExpand(catIdx)} className="p-0.5">
                      {cat.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Checkbox
                      checked={cat.selected}
                      onCheckedChange={() => toggleCategory(catIdx)}
                    />
                    <span className="font-semibold text-sm">{cat.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {cat.items.filter(i => i.selected).length}/{cat.items.length}
                    </span>
                  </div>

                  {cat.expanded && (
                    <div className="divide-y">
                      {cat.items.map((item, itemIdx) => (
                        <div key={itemIdx} className="flex items-center gap-3 px-4 py-2.5">
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleItem(catIdx, itemIdx)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-xs text-muted-foreground">R$</span>
                            <Input
                              value={item.editPrice}
                              onChange={(e) => updatePrice(catIdx, itemIdx, e.target.value)}
                              className="w-20 h-8 text-sm text-right"
                              disabled={!item.selected}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => setFetched(false)}>
                  ← Outro link
                </Button>
                <span className="text-sm text-muted-foreground">
                  {totalSelected} produto(s) selecionado(s)
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
                  Cancelar
                </Button>
                <Button onClick={handleImport} disabled={importing || totalSelected === 0}>
                  {importing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Importar
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImportIfoodDialog;
