import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, QrCode, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Table {
  id: string;
  table_number: number;
  qr_code: string | null;
}

const TablesTab = ({ restaurantId }: { restaurantId: string }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");

  useEffect(() => {
    fetchRestaurantSlug();
    fetchTables();
  }, [restaurantId]);

  const fetchRestaurantSlug = async () => {
    const { data } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .single();
    
    if (data) setRestaurantSlug(data.slug);
  };

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("table_number");

    if (error) {
      toast.error("Erro ao carregar mesas");
      return;
    }

    setTables(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.from("tables").insert({
      restaurant_id: restaurantId,
      table_number: parseInt(tableNumber),
      qr_code: `table-${restaurantId}-${tableNumber}`, // Simplificado
    });

    if (error) {
      toast.error("Erro ao criar mesa");
      return;
    }

    toast.success("Mesa criada!");
    setDialogOpen(false);
    setTableNumber("");
    fetchTables();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta mesa?")) return;

    const { error } = await supabase.from("tables").delete().eq("id", id);

    if (error) {
      toast.error("Erro ao excluir mesa");
      return;
    }

    toast.success("Mesa excluída!");
    fetchTables();
  };

  const getMenuLink = (tableNumber: number) => {
    return `${window.location.origin}/menu/${restaurantSlug}/${tableNumber}`;
  };

  const copyMenuLink = (tableNumber: number) => {
    const link = getMenuLink(tableNumber);
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const openMenuLink = (tableNumber: number) => {
    window.open(getMenuLink(tableNumber), '_blank');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Mesas do Restaurante</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setTableNumber("")}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Mesa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Mesa</DialogTitle>
              <DialogDescription>
                Adicione uma nova mesa ao restaurante
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="table-number">Número da Mesa</Label>
                <Input
                  id="table-number"
                  type="number"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="Ex: 1, 2, 3..."
                  required
                  min="1"
                />
              </div>
              <Button type="submit" className="w-full">
                Criar Mesa
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-secondary/20">
          <p className="text-muted-foreground">Nenhuma mesa criada ainda</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="p-4 border rounded-lg hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                    <QrCode className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-lg">Mesa {table.table_number}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <code className="text-xs bg-secondary px-2 py-1 rounded truncate block max-w-[300px]">
                        {getMenuLink(table.table_number)}
                      </code>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyMenuLink(table.table_number)}
                    title="Copiar link"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openMenuLink(table.table_number)}
                    title="Abrir cardápio"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(table.id)}
                    title="Excluir mesa"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TablesTab;
