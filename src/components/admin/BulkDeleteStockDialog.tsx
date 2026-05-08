import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Trash2, Loader2, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { normalizeSearch } from "@/lib/searchNormalize";

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
  is_active: boolean;
}

type BulkAction = "activate" | "deactivate" | "delete";

const BulkDeleteStockDialog = ({ restaurantId, open, onOpenChange, onDeleted }: BulkDeleteStockDialogProps) => {
  const [items, setItems] = useState<StockItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<BulkAction>("delete");
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
      .select("id, name, is_active, stock_categories(name)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    
    setItems(
      (data || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        category_name: i.stock_categories?.name || "Sem categoria",
        is_active: i.is_active ?? true,
      }))
    );
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const t = normalizeSearch(search);
    return items.filter(i => normalizeSearch(i.name).includes(t));
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

  const requestAction = (action: BulkAction) => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const confirmationText: Record<BulkAction, { title: string; description: string; button: string }> = {
    activate: {
      title: "Confirmar Ativação",
      description: `Tem certeza que deseja ativar ${selected.size} insumo(s)?`,
      button: `Ativar ${selected.size} insumo(s)`,
    },
    deactivate: {
      title: "Confirmar Desativação",
      description: `Tem certeza que deseja desativar ${selected.size} insumo(s)?`,
      button: `Desativar ${selected.size} insumo(s)`,
    },
    delete: {
      title: "Confirmar Exclusão",
      description: `Tem certeza que deseja excluir ${selected.size} insumo(s)? Esta ação não pode ser desfeita.`,
      button: `Excluir ${selected.size} insumo(s)`,
    },
  };

  const handleConfirm = async () => {
    setProcessing(true);
    let errors = 0;

    if (pendingAction === "delete") {
      for (const id of selected) {
        const { error } = await supabase.rpc("admin_delete_stock_item", {
          p_stock_item_id: id,
          p_restaurant_id: restaurantId,
        });
        if (error) errors++;
      }
    } else {
      const newActive = pendingAction === "activate";
      for (const id of selected) {
        const { error } = await supabase
          .from("stock_items")
          .update({ is_active: newActive })
          .eq("id", id)
          .eq("restaurant_id", restaurantId);
        if (error) errors++;
      }
    }

    setProcessing(false);
    setConfirmOpen(false);

    const labels: Record<BulkAction, string> = {
      activate: "ativado(s)",
      deactivate: "desativado(s)",
      delete: "excluído(s)",
    };

    if (errors > 0) {
      toast({ title: `${errors} insumo(s) não puderam ser ${labels[pendingAction]}`, variant: "destructive" });
    } else {
      toast({ title: `${selected.size} insumo(s) ${labels[pendingAction]}` });
    }
    onOpenChange(false);
    onDeleted();
  };

  const ct = confirmationText[pendingAction];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "80vh" }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edição em Massa — Insumos
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

          <ScrollArea className="flex-1 min-h-0" style={{ maxHeight: "calc(80vh - 200px)" }}>
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
                          <span className="text-sm flex-1">{item.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${item.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {item.is_active ? "Ativo" : "Inativo"}
                          </span>
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

          <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{selected.size} selecionado(s)</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => requestAction("activate")}
              >
                <ToggleRight className="h-4 w-4 mr-1" />
                Ativar
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => requestAction("deactivate")}
              >
                <ToggleLeft className="h-4 w-4 mr-1" />
                Desativar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => requestAction("delete")}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Excluir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ct.title}</AlertDialogTitle>
            <AlertDialogDescription>{ct.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={processing}
              className={pendingAction === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {ct.button}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BulkDeleteStockDialog;
