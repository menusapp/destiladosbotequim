import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Plus, 
  Users, 
  CheckCircle, 
  LayoutGrid, 
  TrendingUp,
  MoreVertical,
  QrCode,
  Edit,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Table {
  id: string;
  table_number: number;
  qr_code: string | null;
  is_occupied: boolean;
  occupied_by: string | null;
  occupied_at: string | null;
}

type FilterType = "all" | "occupied" | "available";

const TablesTab = ({ restaurantId }: { restaurantId: string }) => {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [tableNumber, setTableNumber] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchRestaurantSlug();
    fetchTables();

    // Realtime subscription
    const channel = supabase
      .channel("tables-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tables",
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
    const { data } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .single();

    if (data) {
      setRestaurantSlug(data.slug);
    }
  };

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .neq("table_number", 9999)
      .order("table_number");

    if (error) {
      toast.error("Erro ao buscar mesas");
      console.error(error);
    } else {
      setTables(data || []);
    }
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
    setShowDialog(false);
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

  const downloadQRCode = async (table: Table) => {
    const link = `${window.location.origin}/menu/${restaurantSlug}/${table.table_number}`;
    const qrCode = await QRCode.toDataURL(link, { width: 512, margin: 2 });
    const downloadLink = document.createElement("a");
    downloadLink.href = qrCode;
    downloadLink.download = `mesa-${table.table_number}-qr.png`;
    downloadLink.click();
    toast.success("QR Code baixado!");
  };

  const filteredTables = tables.filter((table) => {
    const matchesSearch = table.table_number.toString().includes(searchQuery);
    if (!matchesSearch) return false;

    if (filter === "occupied") return table.is_occupied;
    if (filter === "available") return !table.is_occupied;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Mesas e Comandas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie as mesas e comandas do restaurante
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Mesas
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Mesa</DialogTitle>
              <DialogDescription>
                Adicione uma nova mesa ao restaurante
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="tableNumber">Número da Mesa</Label>
                  <Input
                    id="tableNumber"
                    type="number"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ex: 1"
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  Criar Mesa
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 items-center">
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            Todas
          </Button>
          <Button
            variant={filter === "occupied" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("occupied")}
          >
            Em uso
          </Button>
          <Button
            variant={filter === "available" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("available")}
          >
            Disponíveis
          </Button>
        </div>
        <Input
          placeholder="Buscar por número..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mesas</CardTitle>
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tables.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Livres</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {tables.filter((t) => !t.is_occupied).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mesas Ocupadas</CardTitle>
            <Users className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {tables.filter((t) => t.is_occupied).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Ocupação</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tables.length > 0
                ? Math.round((tables.filter((t) => t.is_occupied).length / tables.length) * 100)
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Mesas */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredTables.map((table) => (
          <Card
            key={table.id}
            className={`cursor-pointer transition-all hover:shadow-lg ${
              table.is_occupied ? "border-red-500" : "border-green-500"
            }`}
            onClick={() => navigate(`/admin/table/${table.id}`)}
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    table.is_occupied
                      ? "bg-red-100 dark:bg-red-950"
                      : "bg-green-100 dark:bg-green-950"
                  }`}
                >
                  <Users
                    className={`w-6 h-6 ${
                      table.is_occupied ? "text-red-600" : "text-green-600"
                    }`}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      downloadQRCode(table);
                    }}>
                      <QrCode className="w-4 h-4 mr-2" />
                      Baixar QR Code
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Editar número da mesa
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      disabled={table.is_occupied}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(table.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <h3 className="font-semibold text-lg mb-1">Mesa {table.table_number}</h3>
              {table.is_occupied && table.occupied_by ? (
                <div className="text-sm text-muted-foreground">
                  <p className="truncate">{table.occupied_by}</p>
                  {table.occupied_at && (
                    <p className="text-xs">
                      {formatDistanceToNow(new Date(table.occupied_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Disponível
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TablesTab;
