import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Users,
  Clock,
  Calendar as CalendarIcon,
  MapPin,
  Check,
  ChevronLeft,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface TableData {
  id: string;
  restaurant_id: string;
  table_number: number;
  table_name: string | null;
  description: string | null;
  image_url: string | null;
  min_capacity: number;
  max_capacity: number;
  is_available_for_reservation: boolean;
}

interface BusinessHour {
  day_of_week: number;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
}

interface Reservation {
  id: string;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  status: string;
  notes: string | null;
  table_id: string | null;
  created_at: string;
}

interface ReservationsViewProps {
  restaurant: any;
  customerCPF: string;
  customerName: string;
  customerPhone?: string;
  primaryColor: string;
}

export const ReservationsView = ({
  restaurant,
  customerCPF,
  customerName,
  customerPhone = "",
  primaryColor,
}: ReservationsViewProps) => {
  const [view, setView] = useState<"history" | "tables" | "form" | "success">("history");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<TableData[]>([]);
  const [tableNames, setTableNames] = useState<Record<string, string>>({});
  const [reservedTableIds, setReservedTableIds] = useState<string[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedTable, setSelectedTable] = useState<TableData | null>(null);
  const [reservationDate, setReservationDate] = useState<Date | undefined>();
  const [reservationTime, setReservationTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!restaurant?.id) return;
    setLoading(true);
    try {
      // Fetch reservations for this customer
      const { data: resData } = await supabase
        .from("reservations")
        .select("id, reservation_date, reservation_time, party_size, status, notes, table_id, created_at")
        .eq("restaurant_id", restaurant.id)
        .eq("customer_cpf", customerCPF.replace(/\D/g, ""))
        .order("created_at", { ascending: false });

      setReservations(resData || []);

      // Fetch table names for display
      if (resData && resData.length > 0) {
        const tableIds = [...new Set(resData.map(r => r.table_id).filter(Boolean))] as string[];
        if (tableIds.length > 0) {
          const { data: tData } = await supabase
            .from("tables")
            .select("id, table_name, table_number")
            .in("id", tableIds);
          const names: Record<string, string> = {};
          (tData || []).forEach((t: any) => {
            names[t.id] = t.table_name || `Mesa ${t.table_number}`;
          });
          setTableNames(names);
        }
      }

      // Fetch available tables
      const { data: tablesData } = await supabase
        .from("tables")
        .select("*")
        .eq("restaurant_id", restaurant.id)
        .eq("is_available_for_reservation", true)
        .neq("table_number", 9999)
        .order("display_order")
        .order("table_number");

      setTables(tablesData || []);

      // Fetch hours based on configuration
      if (restaurant.reservations_follow_business_hours) {
        const { data: hoursData } = await supabase
          .from("business_hours")
          .select("day_of_week, is_open, open_time, close_time")
          .eq("restaurant_id", restaurant.id);
        setBusinessHours(hoursData || []);
      } else {
        const { data: resHours } = await supabase
          .from("reservation_hours")
          .select("day_of_week, is_open, open_time, close_time")
          .eq("restaurant_id", restaurant.id);
        if (resHours && resHours.length > 0) {
          setBusinessHours(resHours);
        }
      }
    } catch (error) {
      console.error("Error fetching reservations data:", error);
    } finally {
      setLoading(false);
    }
  }, [restaurant?.id, customerCPF]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for reservation status updates
  useEffect(() => {
    if (!restaurant?.id || !customerCPF) return;

    const channel = supabase
      .channel(`reservations-${customerCPF}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'reservations',
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.customer_cpf === customerCPF.replace(/\D/g, "")) {
          setReservations(prev =>
            prev.map(r => r.id === updated.id ? { ...r, status: updated.status } : r)
          );
          if (updated.status === 'confirmed') {
            toast.success("🎉 Sua reserva foi confirmada!");
          } else if (updated.status === 'cancelled') {
            toast.error("Sua reserva foi cancelada.");
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurant?.id, customerCPF]);

  // Fetch reserved tables when date changes
  useEffect(() => {
    if (!reservationDate || !restaurant?.id) return;
    const dateStr = format(reservationDate, "yyyy-MM-dd");
    supabase
      .from("reservations")
      .select("table_id")
      .eq("restaurant_id", restaurant.id)
      .eq("reservation_date", dateStr)
      .eq("status", "confirmed")
      .then(({ data }) => {
        setReservedTableIds((data || []).map(r => r.table_id).filter(Boolean) as string[]);
      });
  }, [reservationDate, restaurant?.id]);

  const generateTimeSlots = (date: Date | undefined) => {
    if (!date) return [];

    const dayOfWeek = date.getDay();
    const dayHours = businessHours.find(h => h.day_of_week === dayOfWeek);
    let slots: string[] = [];

    if (dayHours?.is_open && dayHours.open_time && dayHours.close_time) {
      const openParts = dayHours.open_time.split(':');
      const closeParts = dayHours.close_time.split(':');
      const openHour = parseInt(openParts[0]);
      const openMinute = parseInt(openParts[1] || '0');
      const closeHour = parseInt(closeParts[0]);
      const closeMinute = parseInt(closeParts[1] || '0');

      for (let hour = openHour; hour <= closeHour; hour++) {
        if (hour === openHour && openMinute > 0) {
          if (openMinute <= 30) {
            slots.push(`${hour.toString().padStart(2, "0")}:30`);
          }
        } else if (hour === closeHour) {
          if (closeMinute >= 0) slots.push(`${hour.toString().padStart(2, "0")}:00`);
          if (closeMinute >= 30) slots.push(`${hour.toString().padStart(2, "0")}:30`);
        } else {
          slots.push(`${hour.toString().padStart(2, "0")}:00`);
          slots.push(`${hour.toString().padStart(2, "0")}:30`);
        }
      }
    } else {
      for (let hour = 11; hour <= 23; hour++) {
        slots.push(`${hour.toString().padStart(2, "0")}:00`);
        slots.push(`${hour.toString().padStart(2, "0")}:30`);
      }
    }

    // Filter out past time slots if date is today
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (isToday) {
      const bufferMinutes = now.getHours() * 60 + now.getMinutes() + 60;
      slots = slots.filter(slot => {
        const [h, m] = slot.split(":").map(Number);
        return h * 60 + m > bufferMinutes;
      });
    }

    return slots;
  };

  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    if (compareDate < today) return true;

    if (restaurant?.reservations_follow_business_hours && businessHours.length > 0) {
      const dayOfWeek = date.getDay();
      const dayHours = businessHours.find(h => h.day_of_week === dayOfWeek);
      if (!dayHours?.is_open) return true;
    }
    return false;
  };

  const handleSubmitReservation = async () => {
    if (!reservationDate || !reservationTime || !selectedTable || !restaurant) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const { data: existingReservation } = await supabase
      .from("reservations")
      .select("id")
      .eq("restaurant_id", restaurant.id)
      .eq("table_id", selectedTable.id)
      .eq("reservation_date", format(reservationDate, "yyyy-MM-dd"))
      .eq("status", "confirmed")
      .maybeSingle();

    if (existingReservation) {
      toast.error("Esta mesa já está reservada para esta data. Escolha outra data ou mesa.");
      return;
    }

    setSubmitting(true);
    try {
      const cleanCpf = customerCPF.replace(/\D/g, "");
      const cleanPhone = customerPhone.replace(/\D/g, "");

      const { error } = await supabase.from("reservations").insert({
        restaurant_id: restaurant.id,
        reservation_table_id: null,
        table_id: selectedTable.id,
        customer_name: customerName,
        customer_cpf: cleanCpf,
        customer_phone: cleanPhone || "00000000000",
        reservation_date: format(reservationDate, "yyyy-MM-dd"),
        reservation_time: reservationTime,
        party_size: partySize,
        notes: notes || null,
        status: "pending",
      });

      if (error) throw error;

      // WhatsApp notification
      const tableName = selectedTable.table_name || `Mesa ${selectedTable.table_number}`;
      if (cleanPhone) {
        const { data: whatsappConfig } = await supabase
          .from('whatsapp_config')
          .select('enabled, instance_status, message_reservation_created')
          .eq('restaurant_id', restaurant.id)
          .maybeSingle();

        if (whatsappConfig?.enabled && whatsappConfig?.instance_status === 'connected') {
          const defaultMessage = "📅 Olá {nome}! Sua reserva foi recebida e está aguardando confirmação.\n\n🪑 Mesa: {mesa}\n📆 Data: {data}\n⏰ Horário: {horario}\n👥 Pessoas: {pessoas}\n\nEm breve você receberá a confirmação!";
          const template = whatsappConfig.message_reservation_created || defaultMessage;
          const message = template
            .replace(/{nome}/g, customerName)
            .replace(/{mesa}/g, tableName)
            .replace(/{data}/g, format(reservationDate, "dd/MM/yyyy"))
            .replace(/{horario}/g, reservationTime)
            .replace(/{pessoas}/g, partySize.toString());

          supabase.functions.invoke('whatsapp-send', {
            body: { restaurantId: restaurant.id, phone: cleanPhone, message, messageType: 'reservation_created' }
          }).catch(err => console.error('[WhatsApp] Erro ao enviar:', err));
        }
      }

      setView("success");
      fetchData(); // Refresh history
      toast.success("Reserva enviada com sucesso!");
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast.error("Erro ao criar reserva. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedTable(null);
    setReservationDate(undefined);
    setReservationTime("");
    setNotes("");
    setPartySize(2);
    setView("history");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Mesa Reservada ✅</Badge>;
      case "cancelled":
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelada</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Aguardando Confirmação</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }} />
      </div>
    );
  }

  // Success view
  if (view === "success") {
    return (
      <div className="px-4 pb-20">
        <Card className="text-center">
          <CardContent className="pt-8 pb-6">
            <div
              className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              <Check className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">Reserva Solicitada!</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              Sua reserva foi enviada e está aguardando confirmação do restaurante.
            </p>

            <Card className="bg-muted/50 text-left mb-4">
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{reservationDate && format(reservationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{reservationTime}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedTable?.table_name || `Mesa ${selectedTable?.table_number}`}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{partySize} {partySize === 1 ? "pessoa" : "pessoas"}</span>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground mb-4">
              Você receberá uma confirmação por WhatsApp.
            </p>

            <Button variant="outline" onClick={resetForm}>
              Voltar para Minhas Reservas
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Table selection view
  if (view === "tables") {
    return (
      <div className="px-4 pb-20">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setView("history")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-bold">Escolha a Mesa</h2>
        </div>

        {tables.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma mesa disponível no momento</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {tables.map((table) => {
              const isReserved = reservedTableIds.includes(table.id);
              return (
              <Card
                key={table.id}
                className={cn(
                  "overflow-hidden transition-all",
                  isReserved ? "opacity-60 cursor-not-allowed" : "cursor-pointer active:scale-[0.98]"
                )}
                onClick={() => {
                  if (isReserved) return;
                  setSelectedTable(table);
                  setPartySize(table.min_capacity);
                  setView("form");
                }}
              >
                <div className="flex">
                  {table.image_url ? (
                    <img
                      src={table.image_url}
                      alt={table.table_name || `Mesa ${table.table_number}`}
                      className="w-28 h-28 object-cover"
                    />
                  ) : (
                    <div className="w-28 h-28 bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                  )}
                  <CardContent className="p-3 flex flex-col justify-center">
                    <h3 className="font-semibold">{table.table_name || `Mesa ${table.table_number}`}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Users className="h-3 w-3" />
                      {table.min_capacity}-{table.max_capacity} pessoas
                    </p>
                    {table.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{table.description}</p>
                    )}
                    {isReserved && (
                      <Badge className="bg-red-100 text-red-800 border-red-200 mt-1 text-[10px]">
                        Reservada para esta data
                      </Badge>
                    )}
                  </CardContent>
                </div>
              </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Reservation form view
  if (view === "form" && selectedTable) {
    return (
      <div className="px-4 pb-20">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => setView("tables")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-bold">Detalhes da Reserva</h2>
        </div>

        <Card className="mb-4">
          <CardContent className="p-3 flex items-center gap-3">
            {selectedTable.image_url ? (
              <img src={selectedTable.image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                <MapPin className="h-6 w-6 text-muted-foreground/40" />
              </div>
            )}
            <div>
              <h3 className="font-semibold">{selectedTable.table_name || `Mesa ${selectedTable.table_number}`}</h3>
              <p className="text-xs text-muted-foreground">
                {selectedTable.min_capacity}-{selectedTable.max_capacity} pessoas
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Data *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !reservationDate && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {reservationDate ? format(reservationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={reservationDate}
                    onSelect={(date) => {
                      setReservationDate(date);
                      setReservationTime("");
                    }}
                    disabled={isDateDisabled}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              {reservationDate && selectedTable && reservedTableIds.includes(selectedTable.id) && (
                <p className="text-xs text-destructive">⚠️ Esta mesa já possui reserva confirmada para esta data.</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Horário *</Label>
              <Select value={reservationTime} onValueChange={setReservationTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o horário" />
                </SelectTrigger>
                <SelectContent>
                  {generateTimeSlots(reservationDate).map((time) => (
                    <SelectItem key={time} value={time}>{time}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Quantidade de Pessoas *</Label>
              <Select value={partySize.toString()} onValueChange={(v) => setPartySize(parseInt(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(
                    { length: selectedTable.max_capacity - selectedTable.min_capacity + 1 },
                    (_, i) => selectedTable.min_capacity + i
                  ).map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      {num} {num === 1 ? "pessoa" : "pessoas"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Observações</Label>
              <Textarea
                placeholder="Aniversário, cadeira de bebê, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
              />
            </div>

            <Button
              className="w-full"
              style={{ backgroundColor: primaryColor }}
              onClick={handleSubmitReservation}
              disabled={submitting || !reservationDate || !reservationTime || reservedTableIds.includes(selectedTable.id)}
            >
              {submitting ? "Enviando..." : "Solicitar Reserva"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // History view (default)
  return (
    <div className="px-4 pb-20">
      <Button
        className="w-full mb-4"
        style={{ backgroundColor: primaryColor }}
        onClick={() => setView("tables")}
      >
        <Plus className="h-4 w-4 mr-2" />
        Fazer Nova Reserva
      </Button>

      {reservations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CalendarCheck className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Você ainda não fez nenhuma reserva</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reservations.map((reservation) => (
            <Card key={reservation.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {format(new Date(reservation.reservation_date + "T12:00:00"), "dd/MM/yyyy")}
                    </span>
                    <Clock className="h-4 w-4 text-muted-foreground ml-1" />
                    <span>{reservation.reservation_time.slice(0, 5)}</span>
                  </div>
                  {getStatusBadge(reservation.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {reservation.table_id && tableNames[reservation.table_id] && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {tableNames[reservation.table_id]}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {reservation.party_size} {reservation.party_size === 1 ? "pessoa" : "pessoas"}
                  </span>
                </div>
                {reservation.notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">"{reservation.notes}"</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
