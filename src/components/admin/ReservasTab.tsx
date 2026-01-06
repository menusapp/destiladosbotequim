import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Plus,
  Edit,
  Trash2,
  Users,
  Check,
  X,
  Clock,
  Calendar as CalendarIcon,
  Phone,
  User,
  Copy,
  Search,
  Image,
  FileText,
  Upload,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ReservationTable {
  id: string;
  restaurant_id: string;
  table_name: string;
  description: string | null;
  image_url: string | null;
  min_capacity: number;
  max_capacity: number;
  is_available: boolean;
  display_order: number;
}

interface Reservation {
  id: string;
  restaurant_id: string;
  reservation_table_id: string;
  customer_name: string;
  customer_cpf: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
  notes: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  cancelled_by: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  reservation_table?: ReservationTable;
}

interface ReservasTabProps {
  restaurantId: string;
  restaurantSlug?: string;
}

export default function ReservasTab({ restaurantId, restaurantSlug }: ReservasTabProps) {
  const [reservationsEnabled, setReservationsEnabled] = useState(false);
  const [tables, setTables] = useState<ReservationTable[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  
  // Dialog states
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<ReservationTable | null>(null);
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [uploading, setUploading] = useState(false);
  
  // Form state
  const [tableForm, setTableForm] = useState({
    table_name: "",
    description: "",
    image_url: "",
    min_capacity: 1,
    max_capacity: 4,
    is_available: true,
  });

  useEffect(() => {
    fetchData();
  }, [restaurantId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch restaurant settings
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("reservations_enabled, slug")
        .eq("id", restaurantId)
        .single();

      if (restaurant) {
        setReservationsEnabled(restaurant.reservations_enabled || false);
      }

      // Fetch reservation tables
      const { data: tablesData } = await supabase
        .from("reservation_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("display_order");

      setTables(tablesData || []);

      // Fetch reservations with table info
      const { data: reservationsData } = await supabase
        .from("reservations")
        .select("*, reservation_table:reservation_tables(*)")
        .eq("restaurant_id", restaurantId)
        .order("reservation_date", { ascending: true })
        .order("reservation_time", { ascending: true });

      setReservations(reservationsData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReservations = async (enabled: boolean) => {
    const { error } = await supabase
      .from("restaurants")
      .update({ reservations_enabled: enabled })
      .eq("id", restaurantId);

    if (error) {
      toast.error("Erro ao atualizar configuração");
      return;
    }

    setReservationsEnabled(enabled);
    toast.success(enabled ? "Reservas ativadas!" : "Reservas desativadas");
  };

  const handleCopyLink = () => {
    const slug = restaurantSlug || "";
    const link = `${window.location.origin}/reservas/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('reservation-tables')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('reservation-tables')
        .getPublicUrl(fileName);
      
      setTableForm({ ...tableForm, image_url: publicUrl });
      toast.success("Imagem enviada!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
    }
  };

  const openTableDialog = (table?: ReservationTable) => {
    if (table) {
      setEditingTable(table);
      setTableForm({
        table_name: table.table_name,
        description: table.description || "",
        image_url: table.image_url || "",
        min_capacity: table.min_capacity,
        max_capacity: table.max_capacity,
        is_available: table.is_available,
      });
    } else {
      setEditingTable(null);
      setTableForm({
        table_name: "",
        description: "",
        image_url: "",
        min_capacity: 1,
        max_capacity: 4,
        is_available: true,
      });
    }
    setTableDialogOpen(true);
  };

  const handleSaveTable = async () => {
    if (!tableForm.table_name) {
      toast.error("Nome da mesa é obrigatório");
      return;
    }

    try {
      if (editingTable) {
        const { error } = await supabase
          .from("reservation_tables")
          .update({
            table_name: tableForm.table_name,
            description: tableForm.description || null,
            image_url: tableForm.image_url || null,
            min_capacity: tableForm.min_capacity,
            max_capacity: tableForm.max_capacity,
            is_available: tableForm.is_available,
          })
          .eq("id", editingTable.id);

        if (error) throw error;
        toast.success("Mesa atualizada!");
      } else {
        const { error } = await supabase
          .from("reservation_tables")
          .insert({
            restaurant_id: restaurantId,
            table_name: tableForm.table_name,
            description: tableForm.description || null,
            image_url: tableForm.image_url || null,
            min_capacity: tableForm.min_capacity,
            max_capacity: tableForm.max_capacity,
            is_available: tableForm.is_available,
            display_order: tables.length,
          });

        if (error) throw error;
        toast.success("Mesa criada!");
      }

      setTableDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error("Erro ao salvar mesa");
    }
  };

  const handleDeleteTable = async () => {
    if (!deleteTableId) return;

    const { error } = await supabase
      .from("reservation_tables")
      .delete()
      .eq("id", deleteTableId);

    if (error) {
      toast.error("Erro ao excluir mesa");
      return;
    }

    toast.success("Mesa excluída!");
    setDeleteTableId(null);
    fetchData();
  };

  const handleConfirmReservation = async () => {
    if (!selectedReservation) return;

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "confirmed",
        confirmed_by: "Admin",
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", selectedReservation.id);

    if (error) {
      toast.error("Erro ao confirmar reserva");
      return;
    }

    toast.success("Reserva confirmada!");
    setConfirmDialogOpen(false);
    setSelectedReservation(null);
    fetchData();
  };

  const handleCancelReservation = async () => {
    if (!selectedReservation) return;

    const { error } = await supabase
      .from("reservations")
      .update({
        status: "cancelled",
        cancelled_by: "Admin",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancellationReason || null,
      })
      .eq("id", selectedReservation.id);

    if (error) {
      toast.error("Erro ao cancelar reserva");
      return;
    }

    toast.success("Reserva cancelada!");
    setCancelDialogOpen(false);
    setSelectedReservation(null);
    setCancellationReason("");
    fetchData();
  };

  const filteredReservations = reservations.filter((r) => {
    const matchesSearch =
      r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_cpf.includes(searchTerm) ||
      r.customer_phone.includes(searchTerm);

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = reservations.filter((r) => r.status === "pending").length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendente</Badge>;
      case "confirmed":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Confirmada</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Cancelada</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Concluída</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            Reservas de Mesa
          </h2>
          <p className="text-muted-foreground">Gerencie reservas de mesas do seu restaurante</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="reservations-toggle">Ativar Reservas</Label>
            <Switch
              id="reservations-toggle"
              checked={reservationsEnabled}
              onCheckedChange={handleToggleReservations}
            />
          </div>
        </div>
      </div>

      {/* Link público */}
      {reservationsEnabled && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <p className="text-sm font-medium">Link público para reservas:</p>
                <code className="text-sm text-muted-foreground">
                  {window.location.origin}/reservas/{restaurantSlug || "seu-slug"}
                </code>
              </div>
              <Button variant="outline" onClick={handleCopyLink}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="tables" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="tables">Mesas</TabsTrigger>
          <TabsTrigger value="pending" className="relative">
            Pendentes
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* Mesas de Reserva */}
        <TabsContent value="tables" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Mesas de Reserva</CardTitle>
                  <CardDescription>Configure as mesas disponíveis para reserva</CardDescription>
                </div>
                <Button onClick={() => openTableDialog()}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Mesa
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {tables.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma mesa cadastrada</p>
                  <p className="text-sm">Adicione mesas para os clientes reservarem</p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {tables.map((table) => (
                    <Card key={table.id} className="overflow-hidden">
                      {table.image_url ? (
                        <img
                          src={table.image_url}
                          alt={table.table_name}
                          className="w-full h-40 object-cover"
                        />
                      ) : (
                        <div className="w-full h-40 bg-muted flex items-center justify-center">
                          <Image className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{table.table_name}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {table.min_capacity}-{table.max_capacity} pessoas
                            </p>
                            {table.description && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {table.description}
                              </p>
                            )}
                          </div>
                          <Badge variant={table.is_available ? "default" : "secondary"}>
                            {table.is_available ? "Disponível" : "Indisponível"}
                          </Badge>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="outline" size="sm" onClick={() => openTableDialog(table)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTableId(table.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reservas Pendentes */}
        <TabsContent value="pending" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Reservas Pendentes</CardTitle>
              <CardDescription>Reservas aguardando confirmação</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-4">
                  {reservations.filter((r) => r.status === "pending").length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma reserva pendente</p>
                    </div>
                  ) : (
                    reservations
                      .filter((r) => r.status === "pending")
                      .map((reservation) => (
                        <Card key={reservation.id} className="border-yellow-200">
                          <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <CalendarIcon className="h-4 w-4 text-primary" />
                                  <span className="font-medium">
                                    {format(new Date(reservation.reservation_date), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                  <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                                  <span>{reservation.reservation_time.slice(0, 5)}</span>
                                  <Badge variant="outline">{reservation.reservation_table?.table_name}</Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {reservation.customer_name}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {reservation.customer_phone}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {reservation.party_size} pessoas
                                  </span>
                                </div>
                                {reservation.notes && (
                                  <p className="text-sm text-muted-foreground">
                                    Obs: {reservation.notes}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => {
                                    setSelectedReservation(reservation);
                                    setConfirmDialogOpen(true);
                                  }}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Confirmar
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setSelectedReservation(reservation);
                                    setCancelDialogOpen(true);
                                  }}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Recusar
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico */}
        <TabsContent value="history" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle>Histórico de Reservas</CardTitle>
                  <CardDescription>Todas as reservas realizadas</CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Pesquisar..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-[200px]"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                      <SelectItem value="confirmed">Confirmadas</SelectItem>
                      <SelectItem value="cancelled">Canceladas</SelectItem>
                      <SelectItem value="completed">Concluídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-4">
                  {filteredReservations.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma reserva encontrada</p>
                    </div>
                  ) : (
                    filteredReservations.map((reservation) => (
                      <Card key={reservation.id}>
                        <CardContent className="p-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                <span className="font-medium">
                                  {format(new Date(reservation.reservation_date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                                <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                                <span>{reservation.reservation_time.slice(0, 5)}</span>
                                <Badge variant="outline">{reservation.reservation_table?.table_name}</Badge>
                                {getStatusBadge(reservation.status)}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {reservation.customer_name}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {reservation.customer_phone}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />
                                  {reservation.party_size} pessoas
                                </span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para criar/editar mesa */}
      <Dialog open={tableDialogOpen} onOpenChange={setTableDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTable ? "Editar Mesa" : "Nova Mesa de Reserva"}</DialogTitle>
            <DialogDescription>
              Configure os detalhes da mesa para reserva
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Mesa *</Label>
              <Input
                placeholder="Ex: Mesa Romântica, Área VIP..."
                value={tableForm.table_name}
                onChange={(e) => setTableForm({ ...tableForm, table_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Descreva a mesa, localização, características..."
                value={tableForm.description}
                onChange={(e) => setTableForm({ ...tableForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Foto da Mesa</Label>
              
              {tableForm.image_url ? (
                <div className="relative w-full h-40 rounded-lg overflow-hidden border">
                  <img 
                    src={tableForm.image_url}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => setTableForm({ ...tableForm, image_url: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="table-image-upload"
                    disabled={uploading}
                  />
                  <label 
                    htmlFor="table-image-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          Clique para selecionar uma imagem
                        </span>
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mínimo de Pessoas</Label>
                <Input
                  type="number"
                  min={1}
                  value={tableForm.min_capacity}
                  onChange={(e) => setTableForm({ ...tableForm, min_capacity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máximo de Pessoas</Label>
                <Input
                  type="number"
                  min={1}
                  value={tableForm.max_capacity}
                  onChange={(e) => setTableForm({ ...tableForm, max_capacity: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={tableForm.is_available}
                onCheckedChange={(checked) => setTableForm({ ...tableForm, is_available: checked })}
              />
              <Label>Disponível para reserva</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTableDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTable}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para confirmar reserva */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Reserva?</AlertDialogTitle>
            <AlertDialogDescription>
              Confirmar a reserva de {selectedReservation?.customer_name} para{" "}
              {selectedReservation && format(new Date(selectedReservation.reservation_date), "dd/MM/yyyy", { locale: ptBR })} às{" "}
              {selectedReservation?.reservation_time.slice(0, 5)}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmReservation} className="bg-green-600 hover:bg-green-700">
              Confirmar Reserva
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para cancelar reserva */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar Reserva</DialogTitle>
            <DialogDescription>
              Informe o motivo da recusa (opcional)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Motivo da recusa..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelReservation}>
              Recusar Reserva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para deletar mesa */}
      <AlertDialog open={!!deleteTableId} onOpenChange={() => setDeleteTableId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Mesa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as reservas associadas serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTable} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
