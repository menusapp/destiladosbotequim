import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Plus, 
  Users, 
  CheckCircle, 
  LayoutGrid, 
  TrendingUp,
  MoreVertical,
  QrCode,
  Link as LinkIcon,
  Trash2,
  XCircle,
  Edit,
  Clock,
  CalendarCheck,
  Phone,
  User,
  Check,
  X,
  Upload,
  Loader2,
  Image,
  Copy,
  Search,
  FileText,
  Calendar as CalendarIcon,
} from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { format, formatDistanceToNow, isToday, parseISO, addMinutes, isBefore, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Comanda {
  id: string;
  customer_name: string;
  customer_cpf: string;
}

interface Reservation {
  id: string;
  restaurant_id: string;
  table_id: string | null;
  reservation_table_id: string | null;
  customer_name: string;
  customer_cpf: string;
  customer_phone: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
  notes: string | null;
  created_at: string;
}

interface Table {
  id: string;
  table_number: number;
  table_name: string | null;
  description: string | null;
  image_url: string | null;
  min_capacity: number;
  max_capacity: number;
  is_available_for_reservation: boolean;
  display_order: number;
  qr_code: string | null;
  is_occupied: boolean;
  occupied_by: string | null;
  occupied_at: string | null;
  comandas?: Comanda[];
  activeReservation?: Reservation | null;
}

type FilterType = "all" | "occupied" | "available" | "reserved";
type TableStatus = "available" | "occupied" | "reserved";

const TablesTab = ({ restaurantId }: { restaurantId: string }) => {
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [reservationsEnabled, setReservationsEnabled] = useState(false);
  const [followBusinessHours, setFollowBusinessHours] = useState(true);
  const [restaurantSlug, setRestaurantSlug] = useState("");
  const [showDialog, setShowDialog] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [tableToEmpty, setTableToEmpty] = useState<Table | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  
  // Form state for new/edit table
  const [tableForm, setTableForm] = useState({
    table_number: "",
    table_name: "",
    description: "",
    image_url: "",
    min_capacity: 1,
    max_capacity: 4,
    is_available_for_reservation: true,
  });

  // Reservation dialogs
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [cancellationReason, setCancellationReason] = useState("");
  const [arrivalDialogOpen, setArrivalDialogOpen] = useState(false);

  useEffect(() => {
    fetchRestaurantData();
    fetchTables();
    fetchReservations();

    // Realtime subscriptions
    const tablesChannel = supabase
      .channel("tables-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tables" }, () => fetchTables())
      .subscribe();

    const comandasChannel = supabase
      .channel("comandas-tables-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "comandas" }, () => fetchTables())
      .subscribe();

    const reservationsChannel = supabase
      .channel("reservations-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reservations" }, () => fetchReservations())
      .subscribe();

    return () => {
      supabase.removeChannel(tablesChannel);
      supabase.removeChannel(comandasChannel);
      supabase.removeChannel(reservationsChannel);
    };
  }, [restaurantId]);

  const fetchRestaurantData = async () => {
    const { data } = await supabase
      .from("restaurants")
      .select("slug, reservations_enabled, reservations_follow_business_hours")
      .eq("id", restaurantId)
      .single();

    if (data) {
      setRestaurantSlug(data.slug);
      setReservationsEnabled(data.reservations_enabled || false);
      setFollowBusinessHours(data.reservations_follow_business_hours ?? true);
    }
  };

  const fetchTables = async () => {
    const { data: tablesData, error } = await supabase
      .from("tables")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .neq("table_number", 9999)
      .order("display_order")
      .order("table_number");

    if (error) {
      toast.error("Erro ao buscar mesas");
      return;
    }

    const tableIds = (tablesData || []).map(t => t.id);
    
    if (tableIds.length > 0) {
      const { data: comandasData } = await supabase
        .from("comandas")
        .select("id, table_id, customer_name, customer_cpf")
        .in("table_id", tableIds)
        .eq("status", "active");

      const tablesWithComandas = (tablesData || []).map(table => ({
        ...table,
        comandas: (comandasData || []).filter(c => c.table_id === table.id)
      }));

      setTables(tablesWithComandas);
    } else {
      setTables(tablesData || []);
    }
  };

  const fetchReservations = async () => {
    const { data } = await supabase
      .from("reservations")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("reservation_date")
      .order("reservation_time");

    setReservations(data || []);
  };

  const getTableStatus = (table: Table): TableStatus => {
    if (table.is_occupied) {
      return "occupied";
    }
    
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    const currentTime = format(now, "HH:mm");
    
    // Check for active reservations (confirmed, for today, within time window)
    const activeReservation = reservations.find(r => {
      if (r.status !== "confirmed") return false;
      if (r.reservation_date !== today) return false;
      
      // Check if table matches (either table_id or legacy reservation_table_id)
      const tableMatches = r.table_id === table.id;
      if (!tableMatches) return false;
      
      // Check time window: 30 min before to 2 hours after
      const reservationTime = r.reservation_time.slice(0, 5);
      const reservationDate = parseISO(`${r.reservation_date}T${reservationTime}`);
      const windowStart = addMinutes(reservationDate, -30);
      const windowEnd = addMinutes(reservationDate, 120);
      
      return isAfter(now, windowStart) && isBefore(now, windowEnd);
    });
    
    if (activeReservation) {
      return "reserved";
    }
    
    return "available";
  };

  const getActiveReservation = (table: Table): Reservation | null => {
    const now = new Date();
    const today = format(now, "yyyy-MM-dd");
    
    return reservations.find(r => {
      if (r.status !== "confirmed") return false;
      if (r.reservation_date !== today) return false;
      if (r.table_id !== table.id) return false;
      
      const reservationTime = r.reservation_time.slice(0, 5);
      const reservationDate = parseISO(`${r.reservation_date}T${reservationTime}`);
      const windowStart = addMinutes(reservationDate, -30);
      const windowEnd = addMinutes(reservationDate, 120);
      
      return isAfter(now, windowStart) && isBefore(now, windowEnd);
    }) || null;
  };

  const openTableDialog = (table?: Table) => {
    if (table) {
      setEditingTable(table);
      setTableForm({
        table_number: table.table_number.toString(),
        table_name: table.table_name || `Mesa ${table.table_number}`,
        description: table.description || "",
        image_url: table.image_url || "",
        min_capacity: table.min_capacity || 1,
        max_capacity: table.max_capacity || 4,
        is_available_for_reservation: table.is_available_for_reservation ?? true,
      });
    } else {
      setEditingTable(null);
      setTableForm({
        table_number: "",
        table_name: "",
        description: "",
        image_url: "",
        min_capacity: 1,
        max_capacity: 4,
        is_available_for_reservation: true,
      });
    }
    setShowDialog(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${restaurantId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('table-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('table-images')
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tableData = {
      restaurant_id: restaurantId,
      table_number: parseInt(tableForm.table_number),
      table_name: tableForm.table_name || `Mesa ${tableForm.table_number}`,
      description: tableForm.description || null,
      image_url: tableForm.image_url || null,
      min_capacity: tableForm.min_capacity,
      max_capacity: tableForm.max_capacity,
      is_available_for_reservation: tableForm.is_available_for_reservation,
      qr_code: `table-${restaurantId}-${tableForm.table_number}`,
    };

    if (editingTable) {
      const { error } = await supabase
        .from("tables")
        .update(tableData)
        .eq("id", editingTable.id);

      if (error) {
        toast.error("Erro ao atualizar mesa");
        return;
      }
      toast.success("Mesa atualizada!");
    } else {
      const { error } = await supabase.from("tables").insert(tableData);

      if (error) {
        toast.error("Erro ao criar mesa");
        return;
      }
      toast.success("Mesa criada!");
    }

    setShowDialog(false);
    setEditingTable(null);
    setTableForm({
      table_number: "",
      table_name: "",
      description: "",
      image_url: "",
      min_capacity: 1,
      max_capacity: 4,
      is_available_for_reservation: true,
    });
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

  const copyTableLink = async (table: Table, e: React.MouseEvent) => {
    e.stopPropagation();
    const link = `${window.location.origin}/${restaurantSlug}/mesa/${table.table_number}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success(`Link da Mesa ${table.table_number} copiado!`);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = link;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      toast.success(`Link da Mesa ${table.table_number} copiado!`);
    }
  };

  const downloadQRCode = async (table: Table) => {
    const link = `${window.location.origin}/${restaurantSlug}/mesa/${table.table_number}`;
    const qrCode = await QRCode.toDataURL(link, { width: 512, margin: 2 });
    const downloadLink = document.createElement("a");
    downloadLink.href = qrCode;
    downloadLink.download = `mesa-${table.table_number}-qr.png`;
    downloadLink.click();
    toast.success("QR Code baixado!");
  };

  const checkCanEmptyTable = async (tableId: string): Promise<{ canEmpty: boolean; reason?: string }> => {
    const { data: activeOrders } = await supabase
      .from("orders")
      .select("id")
      .eq("table_id", tableId)
      .in("status", ["pending", "accepted", "preparing", "ready"]);

    if (activeOrders && activeOrders.length > 0) {
      return { canEmpty: false, reason: "Existem pedidos ativos nesta mesa. Finalize-os primeiro." };
    }

    return { canEmpty: true };
  };

  const handleRequestEmptyTable = async (table: Table) => {
    const { canEmpty, reason } = await checkCanEmptyTable(table.id);
    
    if (!canEmpty) {
      toast.error(reason || "Não é possível esvaziar esta mesa");
      return;
    }

    setTableToEmpty(table);
  };

  const handleEmptyTable = async (tableId: string) => {
    try {
      await supabase
        .from("comandas")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("table_id", tableId)
        .eq("status", "active");

      const { error } = await supabase
        .from("tables")
        .update({
          is_occupied: false,
          occupied_by: null,
          occupied_at: null,
        })
        .eq("id", tableId);

      if (error) throw error;

      toast.success("Mesa esvaziada!");
      fetchTables();
    } catch (error) {
      console.error("Erro ao esvaziar mesa:", error);
      toast.error("Erro ao esvaziar mesa");
    } finally {
      setTableToEmpty(null);
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

  const handleToggleFollowBusinessHours = async (enabled: boolean) => {
    const { error } = await supabase
      .from("restaurants")
      .update({ reservations_follow_business_hours: enabled })
      .eq("id", restaurantId);

    if (error) {
      toast.error("Erro ao atualizar configuração");
      return;
    }

    setFollowBusinessHours(enabled);
    toast.success(enabled ? "Reservas seguirão horário de funcionamento" : "Reservas usarão horário padrão");
  };

  const handleCopyReservationLink = () => {
    const link = `${window.location.origin}/${restaurantSlug}/reservas`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  // Helper para enviar WhatsApp de reserva
  const sendReservationWhatsApp = async (
    reservation: Reservation,
    messageType: 'confirmed' | 'cancelled'
  ) => {
    try {
      const table = tables.find(t => t.id === reservation.table_id);
      const tableName = table?.table_name || `Mesa ${table?.table_number}`;
      
      const { data: whatsappConfig } = await supabase
        .from('whatsapp_config')
        .select('enabled, instance_status, message_reservation_confirmed, message_reservation_cancelled')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (!whatsappConfig?.enabled || whatsappConfig?.instance_status !== 'connected') {
        return;
      }

      const defaultMessages = {
        confirmed: "✅ Olá {nome}! Sua reserva foi CONFIRMADA!\n\n🪑 Mesa: {mesa}\n📆 Data: {data}\n⏰ Horário: {horario}\n👥 Pessoas: {pessoas}\n\nAguardamos você! 🎉",
        cancelled: "❌ Olá {nome}, infelizmente sua reserva para {data} às {horario} foi cancelada.\n\nEntre em contato conosco para mais informações ou faça uma nova reserva."
      };

      const template = messageType === 'confirmed'
        ? (whatsappConfig.message_reservation_confirmed || defaultMessages.confirmed)
        : (whatsappConfig.message_reservation_cancelled || defaultMessages.cancelled);

      // Formatar data
      const [year, month, day] = reservation.reservation_date.split('-');
      const formattedDate = `${day}/${month}/${year}`;

      const message = template
        .replace(/{nome}/g, reservation.customer_name)
        .replace(/{mesa}/g, tableName)
        .replace(/{data}/g, formattedDate)
        .replace(/{horario}/g, reservation.reservation_time.slice(0, 5))
        .replace(/{pessoas}/g, reservation.party_size.toString());

      await supabase.functions.invoke('whatsapp-send', {
        body: {
          restaurantId,
          phone: reservation.customer_phone,
          message,
          messageType: `reservation_${messageType}`
        }
      });
    } catch (error) {
      console.error('[WhatsApp] Erro ao enviar:', error);
    }
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

    // Enviar WhatsApp
    sendReservationWhatsApp(selectedReservation, 'confirmed');

    toast.success("Reserva confirmada!");
    setConfirmDialogOpen(false);
    setSelectedReservation(null);
    fetchReservations();
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

    // Enviar WhatsApp
    sendReservationWhatsApp(selectedReservation, 'cancelled');

    toast.success("Reserva cancelada!");
    setCancelDialogOpen(false);
    setSelectedReservation(null);
    setCancellationReason("");
    fetchReservations();
  };

  const handleClientArrival = async () => {
    if (!selectedReservation) return;

    try {
      // Find the table
      const table = tables.find(t => t.id === selectedReservation.table_id);
      if (!table) {
        toast.error("Mesa não encontrada");
        return;
      }

      // Create comanda for the customer
      await supabase.from("comandas").insert({
        restaurant_id: restaurantId,
        table_id: table.id,
        customer_name: selectedReservation.customer_name,
        customer_cpf: selectedReservation.customer_cpf,
        status: "active",
      });

      // Mark table as occupied
      await supabase
        .from("tables")
        .update({
          is_occupied: true,
          occupied_by: selectedReservation.customer_name,
          occupied_at: new Date().toISOString(),
        })
        .eq("id", table.id);

      // Mark reservation as completed
      await supabase
        .from("reservations")
        .update({ status: "completed" })
        .eq("id", selectedReservation.id);

      toast.success("Cliente chegou! Comanda criada.");
      setArrivalDialogOpen(false);
      setSelectedReservation(null);
      fetchTables();
      fetchReservations();
    } catch (error) {
      console.error("Erro:", error);
      toast.error("Erro ao registrar chegada");
    }
  };

  const maskCPF = (cpf: string) => {
    if (cpf.length === 11) {
      return `***.***${cpf.slice(6, 9)}-${cpf.slice(9)}`;
    }
    return cpf;
  };

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

  // Filter tables
  const filteredTables = tables.filter((table) => {
    const displayName = table.table_name || `Mesa ${table.table_number}`;
    const matchesSearch = displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.table_number.toString().includes(searchQuery);
    if (!matchesSearch) return false;

    const status = getTableStatus(table);
    if (filter === "occupied") return status === "occupied";
    if (filter === "available") return status === "available";
    if (filter === "reserved") return status === "reserved";
    return true;
  });

  // Filter reservations
  const filteredReservations = reservations.filter((r) => {
    const matchesSearch =
      r.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.customer_cpf.includes(searchTerm) ||
      r.customer_phone.includes(searchTerm);

    const matchesStatus = statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const stats = {
    total: tables.length,
    available: tables.filter(t => getTableStatus(t) === "available").length,
    occupied: tables.filter(t => getTableStatus(t) === "occupied").length,
    reserved: tables.filter(t => getTableStatus(t) === "reserved").length,
  };

  const pendingReservationsCount = reservations.filter(r => r.status === "pending").length;

  // Get today's reservations
  const todayReservations = reservations.filter(r => {
    return r.reservation_date === format(new Date(), "yyyy-MM-dd") && 
      (r.status === "confirmed" || r.status === "pending");
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Mesas e Reservas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie mesas, comandas e reservas do restaurante
          </p>
        </div>
      </div>

      <Tabs defaultValue="mesas" className="w-full">
        <TabsList>
          <TabsTrigger value="mesas">Mesas</TabsTrigger>
          <TabsTrigger value="reservas" className="relative">
            Reservas
            {pendingReservationsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                {pendingReservationsCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Mesas Tab */}
        <TabsContent value="mesas" className="mt-6 space-y-6">
          {/* Header with Add button */}
          <div className="flex justify-end">
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
              <DialogTrigger asChild>
                <Button onClick={() => openTableDialog()}>
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Mesa
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingTable ? "Editar Mesa" : "Nova Mesa"}</DialogTitle>
                  <DialogDescription>
                    Configure os detalhes da mesa
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tableNumber">Número da Mesa *</Label>
                        <Input
                          id="tableNumber"
                          type="number"
                          value={tableForm.table_number}
                          onChange={(e) => setTableForm({ ...tableForm, table_number: e.target.value })}
                          placeholder="Ex: 1"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="tableName">Nome da Mesa</Label>
                        <Input
                          id="tableName"
                          value={tableForm.table_name}
                          onChange={(e) => setTableForm({ ...tableForm, table_name: e.target.value })}
                          placeholder="Ex: Mesa Romântica"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Descrição</Label>
                      <Textarea
                        placeholder="Descreva a mesa, localização, características..."
                        value={tableForm.description}
                        onChange={(e) => setTableForm({ ...tableForm, description: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>Foto da Mesa</Label>
                      {tableForm.image_url ? (
                        <div className="relative w-full h-40 rounded-lg overflow-hidden border mt-2">
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
                        <div className="border-2 border-dashed rounded-lg p-6 text-center mt-2">
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
                      <div>
                        <Label>Mínimo de Pessoas</Label>
                        <Input
                          type="number"
                          min={1}
                          value={tableForm.min_capacity}
                          onChange={(e) => setTableForm({ ...tableForm, min_capacity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      <div>
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
                        checked={tableForm.is_available_for_reservation}
                        onCheckedChange={(checked) => setTableForm({ ...tableForm, is_available_for_reservation: checked })}
                      />
                      <Label>Disponível para reserva online</Label>
                    </div>

                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                        Cancelar
                      </Button>
                      <Button type="submit">
                        {editingTable ? "Salvar" : "Criar Mesa"}
                      </Button>
                    </DialogFooter>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filters */}
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
                Ocupadas
              </Button>
              <Button
                variant={filter === "available" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("available")}
              >
                Disponíveis
              </Button>
              <Button
                variant={filter === "reserved" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("reserved")}
              >
                Reservadas
              </Button>
            </div>
            <Input
              placeholder="Buscar por nome ou número..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
                <LayoutGrid className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disponíveis</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ocupadas</CardTitle>
                <Users className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.occupied}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reservadas</CardTitle>
                <CalendarCheck className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">{stats.reserved}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredTables.map((table) => {
              const status = getTableStatus(table);
              const clientCount = table.comandas?.length || 0;
              const displayName = table.table_name || `Mesa ${table.table_number}`;
              const activeReservation = getActiveReservation(table);
              
              const borderColor = status === "occupied" 
                ? "border-red-500" 
                : status === "reserved" 
                  ? "border-orange-500" 
                  : "border-green-500";
              
              const iconBgColor = status === "occupied"
                ? "bg-red-100 dark:bg-red-950"
                : status === "reserved"
                  ? "bg-orange-100 dark:bg-orange-950"
                  : "bg-green-100 dark:bg-green-950";
              
              const iconColor = status === "occupied"
                ? "text-red-600"
                : status === "reserved"
                  ? "text-orange-600"
                  : "text-green-600";

              return (
                <Card
                  key={table.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${borderColor}`}
                  onClick={() => navigate(`/admin/table/${table.id}`)}
                >
                  {table.image_url && (
                    <img 
                      src={table.image_url} 
                      alt={displayName}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgColor}`}>
                        {status === "reserved" ? (
                          <CalendarCheck className={`w-5 h-5 ${iconColor}`} />
                        ) : (
                          <Users className={`w-5 h-5 ${iconColor}`} />
                        )}
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
                            openTableDialog(table);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Mesa
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            downloadQRCode(table);
                          }}>
                            <QrCode className="w-4 h-4 mr-2" />
                            Baixar QR Code
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => copyTableLink(table, e)}>
                            <LinkIcon className="w-4 h-4 mr-2" />
                            Copiar Link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-orange-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestEmptyTable(table);
                            }}
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Esvaziar Mesa
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

                    <h3 className="font-semibold text-lg mb-1">{displayName}</h3>
                    <p className="text-xs text-muted-foreground mb-2">
                      {table.min_capacity}-{table.max_capacity} pessoas
                    </p>
                    
                    {status === "occupied" && clientCount > 0 ? (
                      <div className="space-y-2">
                        <Badge variant="secondary" className="gap-1 bg-red-100 text-red-800">
                          <Users className="w-3 h-3" />
                          {clientCount} cliente{clientCount > 1 ? 's' : ''}
                        </Badge>
                        <div className="space-y-1">
                          {table.comandas?.slice(0, 2).map((comanda) => (
                            <p key={comanda.id} className="text-xs text-muted-foreground truncate">
                              {comanda.customer_name} - {maskCPF(comanda.customer_cpf)}
                            </p>
                          ))}
                        </div>
                        {table.occupied_at && (
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(table.occupied_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </p>
                        )}
                      </div>
                    ) : status === "reserved" && activeReservation ? (
                      <div className="space-y-2">
                        <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-800">
                          <CalendarCheck className="w-3 h-3" />
                          Reservada
                        </Badge>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p className="truncate">{activeReservation.customer_name}</p>
                          <p className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {activeReservation.reservation_time.slice(0, 5)}
                          </p>
                          <p className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {activeReservation.party_size} pessoas
                          </p>
                        </div>
                        <Button
                          size="sm"
                          className="w-full mt-2 bg-orange-600 hover:bg-orange-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReservation(activeReservation);
                            setArrivalDialogOpen(true);
                          }}
                        >
                          <Check className="w-3 h-3 mr-1" />
                          Cliente Chegou
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Disponível
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Reservas Tab */}
        <TabsContent value="reservas" className="mt-6 space-y-6">
          {/* Configurações */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Configurações de Reserva</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reservations-toggle" className="font-medium">Ativar Reservas Online</Label>
                  <p className="text-sm text-muted-foreground">
                    Permite que clientes façam reservas pelo cardápio digital
                  </p>
                </div>
                <Switch
                  id="reservations-toggle"
                  checked={reservationsEnabled}
                  onCheckedChange={handleToggleReservations}
                />
              </div>
              
              {reservationsEnabled && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div>
                    <Label htmlFor="business-hours-toggle" className="font-medium">Seguir Horário de Funcionamento</Label>
                    <p className="text-sm text-muted-foreground">
                      Mostrar apenas horários disponíveis conforme configurado em Configurações → Horário de Funcionamento
                    </p>
                  </div>
                  <Switch
                    id="business-hours-toggle"
                    checked={followBusinessHours}
                    onCheckedChange={handleToggleFollowBusinessHours}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          

          <Tabs defaultValue="today" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-lg">
              <TabsTrigger value="today">
                Hoje ({todayReservations.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="relative">
                Pendentes
                {pendingReservationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {pendingReservationsCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {/* Today's Reservations */}
            <TabsContent value="today" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reservas de Hoje</CardTitle>
                  <CardDescription>Reservas confirmadas e pendentes para hoje</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {todayReservations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhuma reserva para hoje</p>
                        </div>
                      ) : (
                        todayReservations
                          .sort((a, b) => a.reservation_time.localeCompare(b.reservation_time))
                          .map((reservation) => {
                            const table = tables.find(t => t.id === reservation.table_id);
                            return (
                              <Card key={reservation.id} className={reservation.status === "confirmed" ? "border-green-200" : "border-yellow-200"}>
                                <CardContent className="p-4">
                                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <span className="font-medium text-lg">
                                          {reservation.reservation_time.slice(0, 5)}
                                        </span>
                                        <Badge variant="outline">{table?.table_name || `Mesa ${table?.table_number}`}</Badge>
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
                                    <div className="flex gap-2">
                                      {reservation.status === "confirmed" && (
                                        <Button
                                          size="sm"
                                          className="bg-orange-600 hover:bg-orange-700"
                                          onClick={() => {
                                            setSelectedReservation(reservation);
                                            setArrivalDialogOpen(true);
                                          }}
                                        >
                                          <Check className="h-4 w-4 mr-1" />
                                          Cliente Chegou
                                        </Button>
                                      )}
                                      {reservation.status === "pending" && (
                                        <>
                                          <Button
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
                                            className="text-destructive"
                                            onClick={() => {
                                              setSelectedReservation(reservation);
                                              setCancelDialogOpen(true);
                                            }}
                                          >
                                            <X className="h-4 w-4 mr-1" />
                                            Recusar
                                          </Button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pending Reservations */}
            <TabsContent value="pending" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Reservas Pendentes</CardTitle>
                  <CardDescription>Aguardando confirmação</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {reservations.filter(r => r.status === "pending").length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhuma reserva pendente</p>
                        </div>
                      ) : (
                        reservations
                          .filter(r => r.status === "pending")
                          .map((reservation) => {
                            const table = tables.find(t => t.id === reservation.table_id);
                            return (
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
                                        <Badge variant="outline">{table?.table_name || `Mesa ${table?.table_number}`}</Badge>
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
                                        className="text-destructive"
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
                            );
                          })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            {/* History */}
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
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-3 pr-4">
                      {filteredReservations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>Nenhuma reserva encontrada</p>
                        </div>
                      ) : (
                        filteredReservations.map((reservation) => {
                          const table = tables.find(t => t.id === reservation.table_id);
                          return (
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
                                      <Badge variant="outline">{table?.table_name || `Mesa ${table?.table_number}`}</Badge>
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
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {/* AlertDialog para confirmar esvaziamento */}
      <AlertDialog open={!!tableToEmpty} onOpenChange={() => setTableToEmpty(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esvaziar {tableToEmpty?.table_name || `Mesa ${tableToEmpty?.table_number}`}?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as comandas ativas serão fechadas e os clientes serão deslogados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => tableToEmpty && handleEmptyTable(tableToEmpty.id)}
            >
              Esvaziar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Dialog para cliente chegou */}
      <AlertDialog open={arrivalDialogOpen} onOpenChange={setArrivalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cliente Chegou?</AlertDialogTitle>
            <AlertDialogDescription>
              Registrar a chegada de {selectedReservation?.customer_name}? 
              Uma comanda será criada automaticamente e a mesa será marcada como ocupada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClientArrival} className="bg-orange-600 hover:bg-orange-700">
              Confirmar Chegada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TablesTab;
