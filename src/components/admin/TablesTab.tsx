import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, QrCode, Copy, ExternalLink, User, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  is_occupied: boolean;
  occupied_at: string | null;
  occupied_by: string | null;
}

const TablesTab = ({ restaurantId }: { restaurantId: string }) => {
  const [tables, setTables] = useState<Table[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");

  useEffect(() => {
    fetchRestaurantSlug();
    fetchTables();

    // Realtime subscription para atualizar mesas em tempo real
    const channel = supabase
      .channel('tables-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        () => {
          fetchTables();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

  const fetchRestaurantSlug = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .single();

    if (error || !data) {
      toast.error("Erro ao carregar dados do restaurante");
      return;
    }

    setRestaurantSlug(data.slug);
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
      qr_code: `table-${restaurantId}-${tableNumber}`,
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

  const handleCopyLink = (tableNumber: number) => {
    const link = getMenuLink(tableNumber);
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleOpenLink = (tableNumber: number) => {
    const link = getMenuLink(tableNumber);
    window.open(link, "_blank");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Resumo de Ocupação */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-1">Total de Mesas</p>
          <p className="text-3xl font-bold">{tables.length}</p>
        </div>
        <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50 dark:bg-green-950/20">
          <p className="text-sm text-muted-foreground mb-1">Mesas Livres</p>
          <p className="text-3xl font-bold text-green-600">
            {tables.filter(t => !t.is_occupied).length}
          </p>
        </div>
        <div className="p-4 border-2 border-red-300 rounded-lg bg-red-50 dark:bg-red-950/20">
          <p className="text-sm text-muted-foreground mb-1">Mesas Ocupadas</p>
          <p className="text-3xl font-bold text-red-600">
            {tables.filter(t => t.is_occupied).length}
          </p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
          <p className="text-sm text-muted-foreground mb-1">Taxa de Ocupação</p>
          <p className="text-3xl font-bold">
            {tables.length > 0 
              ? Math.round((tables.filter(t => t.is_occupied).length / tables.length) * 100)
              : 0}%
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
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

      <div className="flex-1 overflow-y-auto pr-2">
        {tables.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-secondary/20">
            <p className="text-muted-foreground">Nenhuma mesa criada ainda</p>
          </div>
        ) : (
          <div className="grid gap-4">
          {tables.map((table) => (
            <div
              key={table.id}
              className={`p-4 border-2 rounded-lg transition-all ${
                table.is_occupied
                  ? "bg-red-50 border-red-300 dark:bg-red-950/20 dark:border-red-800"
                  : "bg-green-50 border-green-300 dark:bg-green-950/20 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-950/30"
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <QrCode className={`h-8 w-8 ${table.is_occupied ? "text-red-600" : "text-green-600"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-lg">Mesa {table.table_number}</p>
                      <Badge variant={table.is_occupied ? "destructive" : "default"}>
                        {table.is_occupied ? "Ocupada" : "Livre"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Link do Cardápio Digital</p>
                    {table.is_occupied && table.occupied_by && (
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-red-700 dark:text-red-400">
                          <User className="h-3 w-3" />
                          <span className="font-medium">{table.occupied_by}</span>
                        </div>
                        {table.occupied_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>
                              Desde {format(new Date(table.occupied_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(table.id)}
                  disabled={table.is_occupied}
                  title={table.is_occupied ? "Não é possível excluir mesa ocupada" : "Excluir mesa"}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="flex gap-2">
                <Input
                  value={getMenuLink(table.table_number)}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopyLink(table.table_number)}
                  title="Copiar link"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenLink(table.table_number)}
                  title="Abrir em nova aba"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TablesTab;
