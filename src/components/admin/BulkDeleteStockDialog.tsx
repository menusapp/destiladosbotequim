import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BulkDeleteStockDialogProps {
  restaurantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

interface StockItem {
  id: string;
  name: string;
  category_name: string;
}

const BulkDeleteStockDialog = ({ restaurantId, open, onOpenChange, onDeleted }: BulkDeleteStockDialogProps) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchItems();
      setSelected(new Set());
      setSearch("");
    }
  }, [open]);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("stock_items")
      .select("id, name, stock_categories(name)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    
    setItems(
      (data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category_name: i.stock_categories?.name || "Sem categoria",
      }))
    );
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const t = search.toLowerCase();
    return items.filter(i => i.name.toLowerCase().includes(t));
  }, [items, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, StockItem[]>();
    for (const i of filtered) {
      const key = i.category_name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
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

  const toggleCategory = (catItems: StockItem[]) => {
    const allSelected = catItems.every(i => selected.has(i.id));
    setSelected(prev => {
      const next = new Set(prev);
      catItems.forEach(i => allSelected ? next.delete(i.id) : next.add(i.id));
      return next;
    });
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    let errors = 0;
    for (const id of selected) {
      const { error } = await supabase.rpc("admin_delete_stock_item", {
        p_stock_item_id: id,
        p_restaurant_id: restaurantId,
      });
      if (error) errors++;
    }
    setDeleting(false);
    setConfirmOpen(false);
    if (errors > 0) {
      toast({ title: `${errors} insumo(s) não puderam ser excluídos`, variant: "destructive" });
    } else {
      toast({ title: `${selected.size} insumo(s) excluído(s)` });
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
              Exclusão em Massa — Insumos
            </DialogTitle>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar insumo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "400px" }}>
            <div className="space-y-4 pr-4">
              {grouped.map(([cat, catItems]) => {
                const allSelected = catItems.every(i => selected.has(i.id));
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={() => toggleCategory(catItems)}
                      />
                      <span className="font-semibold text-sm">{cat} ({catItems.length})</span>
                    </div>
                    <div className="space-y-1 ml-6">
                      {catItems.map(item => (
                        <label key={item.id} className="flex items-center gap-2 cursor-pointer py-1 hover:bg-muted/50 rounded px-2">
                          <Checkbox
                            checked={selected.has(item.id)}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                          <span className="text-sm">{item.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
              {grouped.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum insumo encontrado</p>
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
              Tem certeza que deseja excluir {selected.size} insumo(s)? Esta ação não pode ser desfeita e removerá os insumos de todas as receitas.
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
              Excluir {selected.size} insumo(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkDeleteStockDialog;
