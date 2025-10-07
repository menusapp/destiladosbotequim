import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, QrCode } from "lucide-react";
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

  useEffect(() => {
    fetchTables();
  }, [restaurantId]);

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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className="relative p-6 border rounded-lg hover:bg-secondary/50 transition-colors text-center"
            >
              <QrCode className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-bold text-lg">Mesa {table.table_number}</p>
              <Button
                variant="destructive"
                size="sm"
                className="mt-4 w-full"
                onClick={() => handleDelete(table.id)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TablesTab;
