import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Trash2, Loader2, Pencil, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { normalizeSearch } from "@/lib/searchNormalize";

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
  available: boolean;
}

type BulkAction = "activate" | "deactivate" | "delete";

const BulkDeleteProductsDialog = ({ restaurantId, open, onOpenChange, onDeleted, isRestaurantOpen }: BulkDeleteProductsDialogProps) => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pendingAction, setPendingAction] = useState<BulkAction>("delete");

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
      .select("id, name, category_id, available, categories(name)")
      .eq("restaurant_id", restaurantId)
      .order("name");
    
    setProducts(
      (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category_id: p.category_id,
        category_name: p.categories?.name || "Sem categoria",
        available: p.available ?? true,
      }))
    );
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const t = normalizeSearch(search);
    return products.filter(p => normalizeSearch(p.name).includes(t));
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

  const requestAction = (action: BulkAction) => {
    if (isRestaurantOpen) {
      toast.error("Feche o restaurante para editar produtos");
      return;
    }
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const confirmationText: Record<BulkAction, { title: string; description: string; button: string }> = {
    activate: {
      title: "Confirmar Ativação",
      description: `Tem certeza que deseja ativar ${selected.size} produto(s)?`,
      button: `Ativar ${selected.size} produto(s)`,
    },
    deactivate: {
      title: "Confirmar Desativação",
      description: `Tem certeza que deseja desativar ${selected.size} produto(s)?`,
      button: `Desativar ${selected.size} produto(s)`,
    },
    delete: {
      title: "Confirmar Exclusão",
      description: `Tem certeza que deseja excluir ${selected.size} produto(s)? Esta ação não pode ser desfeita.`,
      button: `Excluir ${selected.size} produto(s)`,
    },
  };

  const handleConfirm = async () => {
    setProcessing(true);
    let errors = 0;

    if (pendingAction === "delete") {
      for (const id of selected) {
        const { error } = await supabase.rpc("admin_delete_product", {
          p_product_id: id,
          p_restaurant_id: restaurantId,
        });
        if (error) errors++;
      }
    } else {
      const newAvailable = pendingAction === "activate";
      for (const id of selected) {
        const { error } = await supabase
          .from("products")
          .update({ available: newAvailable })
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
      toast.error(`${errors} produto(s) não puderam ser ${labels[pendingAction]}`);
    } else {
      toast.success(`${selected.size} produto(s) ${labels[pendingAction]}`);
    }
    onOpenChange(false);
    onDeleted();
  };

  const ct = confirmationText[pendingAction];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg h-[90vh] max-h-[90vh] min-h-0 !flex !flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edição em Massa — Produtos
            </DialogTitle>
          </DialogHeader>

          <div className="relative shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-2">
            <div className="space-y-4 pr-2">
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
                          <span className="text-sm flex-1">{p.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${p.available ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {p.available ? "Ativo" : "Inativo"}
                          </span>
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
          </div>

          <div className="flex items-center justify-between pt-2 border-t gap-2 flex-wrap shrink-0">
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

export default BulkDeleteProductsDialog;
