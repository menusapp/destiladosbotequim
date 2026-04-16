import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";

interface BulkDeleteProductsDialogProps {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  isRestaurantOpen: boolean;
}

interface ProductItem {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string;
}

const BulkDeleteProductsDialog = ({ restaurantId, open, onOpenChange, onDeleted, isRestaurantOpen }: BulkDeleteProductsDialogProps) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      fetchProducts();
      setSelected(new Set());
      setSearch("");
    }
  }, [open]);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, category_id, categories(name)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    
    setProducts(
      (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        category_name: p.categories?.name || "Sem categoria",
      }))
    );
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const t = search.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(t));
  }, [products, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, ProductItem[]>();
    for (const p of filtered) {
      const key = p.category_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const toggleItem = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCategory = (items: ProductItem[]) => {
    const allSelected = items.every(i => selected.has(i.id));
    setSelected(prev => {
      const next = new Set(prev);
      items.forEach(i => allSelected ? next.delete(i.id) : next.add(i.id));
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para excluir produtos");
      return;
    }
    setDeleting(true);
    let errors = 0;
    for (const id of selected) {
      const { error } = await supabase.rpc("admin_delete_product", {
        p_product_id: id,
        p_restaurant_id: restaurantId,
      });
      if (error) errors++;
    }
    setDeleting(false);
    setConfirmOpen(false);
    if (errors > 0) {
      toast.error(`${errors} produto(s) não puderam ser excluídos`);
    } else {
      toast.success(`${selected.size} produto(s) excluído(s)`);
    }
    onOpenChange(false);
    onDeleted();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Exclusão em Massa — Produtos
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "400px" }}>
            <div className="space-y-4 pr-4">
              {grouped.map(([cat, items]) => {
                const allSelected = items.every(i => selected.has(i.id));
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleCategory(items)}
                      />
                      <span className="font-semibold text-sm">{cat} ({items.length})</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {items.map(p => (
                        <label key={p.id} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-muted/50 rounded px-2">
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleItem(p.id)}
                          />
                          <span className="text-sm">{p.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {grouped.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto encontrado</p>
              )}
            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
            <Button
              variant="destructive"
              disabled={selected.size === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Selecionados
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selected.size} produto(s)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir {selected.size} produto(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkDeleteProductsDialog;
