import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Users,
  Clock,
  Calendar as CalendarIcon,
  Phone,
  User,
  MapPin,
  Check,
  ChevronLeft,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  reservations_enabled: boolean;
}

interface ReservationTable {
  id: string;
  restaurant_id: string;
  table_name: string;
  description: string | null;
  image_url: string | null;
  min_capacity: number;
  max_capacity: number;
  is_available: boolean;
}

const Reservations = () => {
  const { restaurantSlug } = useParams<{ restaurantSlug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [tables, setTables] = useState<ReservationTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"tables" | "login" | "form" | "success">("tables");
  const [selectedTable, setSelectedTable] = useState<ReservationTable | null>(null);
  
  // Customer data
  const [customerName, setCustomerName] = useState("");
  const [customerCpf, setCustomerCpf] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  
  // Reservation data
  const [reservationDate, setReservationDate] = useState<Date | undefined>();
  const [reservationTime, setReservationTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (restaurantSlug) {
      fetchRestaurant();
    }
  }, [restaurantSlug]);

  const fetchRestaurant = async () => {
    setLoading(true);
    try {
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id, name, slug, logo_url, primary_color, reservations_enabled")
        .eq("slug", restaurantSlug)
        .single();

      if (restaurantError) throw restaurantError;

      if (!restaurantData.reservations_enabled) {
        toast.error("Reservas não estão habilitadas para este restaurante");
        setRestaurant(restaurantData);
        setLoading(false);
        return;
      }

      setRestaurant(restaurantData);

      // Fetch available tables
      const { data: tablesData } = await supabase
        .from("reservation_tables")
        .select("*")
        .eq("restaurant_id", restaurantData.id)
        .eq("is_available", true)
        .order("display_order");

      setTables(tablesData || []);
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      toast.error("Restaurante não encontrado");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTable = (table: ReservationTable) => {
    setSelectedTable(table);
    // Check if already logged in
    const savedCpf = localStorage.getItem(`reservation_cpf_${restaurant?.id}`);
    if (savedCpf) {
      const savedName = localStorage.getItem(`reservation_name_${restaurant?.id}`);
      const savedPhone = localStorage.getItem(`reservation_phone_${restaurant?.id}`);
      setCustomerCpf(savedCpf);
      setCustomerName(savedName || "");
      setCustomerPhone(savedPhone || "");
      setStep("form");
    } else {
      setStep("login");
    }
  };

  const handleLogin = () => {
    if (!customerName || !customerCpf || !customerPhone) {
      toast.error("Preencha todos os campos");
      return;
    }

    // Save to localStorage
    localStorage.setItem(`reservation_cpf_${restaurant?.id}`, customerCpf);
    localStorage.setItem(`reservation_name_${restaurant?.id}`, customerName);
    localStorage.setItem(`reservation_phone_${restaurant?.id}`, customerPhone);

    setStep("form");
  };

  const handleSubmitReservation = async () => {
    if (!reservationDate || !reservationTime || !selectedTable || !restaurant) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("reservations").insert({
        restaurant_id: restaurant.id,
        reservation_table_id: selectedTable.id,
        customer_name: customerName,
        customer_cpf: customerCpf,
        customer_phone: customerPhone,
        reservation_date: format(reservationDate, "yyyy-MM-dd"),
        reservation_time: reservationTime,
        party_size: partySize,
        notes: notes || null,
        status: "pending",
      });

      if (error) throw error;

      setStep("success");
    } catch (error) {
      console.error("Error creating reservation:", error);
      toast.error("Erro ao criar reserva. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    return numbers
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 11; hour <= 23; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
      slots.push(`${hour.toString().padStart(2, "0")}:30`);
    }
    return slots;
  };

  const primaryColor = restaurant?.primary_color || "#f97316";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Restaurante não encontrado</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!restaurant.reservations_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <CalendarCheck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-bold mb-2">Reservas Indisponíveis</h2>
            <p className="text-muted-foreground">
              Este restaurante não está aceitando reservas no momento.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="sticky top-0 z-50 py-4 px-6"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          {step !== "tables" && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => {
                if (step === "login") setStep("tables");
                else if (step === "form") setStep("login");
                else if (step === "success") setStep("tables");
              }}
            >
              <ChevronLeft className="h-6 w-6" />
            </Button>
          )}
          {restaurant.logo_url && (
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          )}
          <div className="text-white">
            <h1 className="font-bold text-lg">{restaurant.name}</h1>
            <p className="text-sm opacity-90">Reservas</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        {/* Step: Select Table */}
        {step === "tables" && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold">Faça sua Reserva</h2>
              <p className="text-muted-foreground">Escolha a mesa ideal para você</p>
            </div>

            {tables.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <CalendarCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma mesa disponível no momento</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {tables.map((table) => (
                  <Card
                    key={table.id}
                    className="overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:border-primary"
                    onClick={() => handleSelectTable(table)}
                  >
                    {table.image_url ? (
                      <img
                        src={table.image_url}
                        alt={table.table_name}
                        className="w-full h-48 object-cover"
                      />
                    ) : (
                      <div className="w-full h-48 bg-muted flex items-center justify-center">
                        <MapPin className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-lg">{table.table_name}</h3>
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Users className="h-4 w-4" />
                        {table.min_capacity}-{table.max_capacity} pessoas
                      </p>
                      {table.description && (
                        <p className="text-sm text-muted-foreground mt-2">{table.description}</p>
                      )}
                      <Button
                        className="w-full mt-4"
                        style={{ backgroundColor: primaryColor }}
                      >
                        Selecionar
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step: Login */}
        {step === "login" && (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Seus Dados</CardTitle>
              <CardDescription>
                Informe seus dados para fazer a reserva
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome Completo *</Label>
                <Input
                  placeholder="Seu nome"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={customerCpf}
                  onChange={(e) => setCustomerCpf(formatCpf(e.target.value))}
                  maxLength={14}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone (WhatsApp) *</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                  maxLength={15}
                />
              </div>
              <Button
                className="w-full"
                style={{ backgroundColor: primaryColor }}
                onClick={handleLogin}
              >
                Continuar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Reservation Form */}
        {step === "form" && selectedTable && (
          <div className="space-y-6 max-w-md mx-auto">
            <Card>
              {selectedTable.image_url && (
                <img
                  src={selectedTable.image_url}
                  alt={selectedTable.table_name}
                  className="w-full h-48 object-cover"
                />
              )}
              <CardContent className="p-4">
                <h3 className="font-semibold text-lg">{selectedTable.table_name}</h3>
                <p className="text-sm text-muted-foreground">
                  Capacidade: {selectedTable.min_capacity}-{selectedTable.max_capacity} pessoas
                </p>
                {selectedTable.description && (
                  <p className="text-sm text-muted-foreground mt-2">{selectedTable.description}</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes da Reserva</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !reservationDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {reservationDate
                          ? format(reservationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                          : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={reservationDate}
                        onSelect={setReservationDate}
                        disabled={(date) => date < new Date()}
                        locale={ptBR}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Horário *</Label>
                  <Select value={reservationTime} onValueChange={setReservationTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateTimeSlots().map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Quantidade de Pessoas *</Label>
                  <Select
                    value={partySize.toString()}
                    onValueChange={(v) => setPartySize(parseInt(v))}
                  >
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
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Alguma observação especial? (aniversário, cadeira de bebê, etc.)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <Button
                  className="w-full"
                  style={{ backgroundColor: primaryColor }}
                  onClick={handleSubmitReservation}
                  disabled={submitting}
                >
                  {submitting ? "Enviando..." : "Confirmar Reserva"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step: Success */}
        {step === "success" && (
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="pt-8 pb-6">
              <div
                className="h-16 w-16 rounded-full mx-auto mb-4 flex items-center justify-center"
                style={{ backgroundColor: primaryColor }}
              >
                <Check className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Reserva Solicitada!</h2>
              <p className="text-muted-foreground mb-6">
                Sua reserva foi enviada e está aguardando confirmação.
              </p>

              <Card className="bg-muted/50 text-left">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {reservationDate && format(reservationDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{reservationTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedTable?.table_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{partySize} {partySize === 1 ? "pessoa" : "pessoas"}</span>
                  </div>
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground mt-4">
                Você receberá uma confirmação por WhatsApp.
              </p>

              <Button
                className="mt-6"
                variant="outline"
                onClick={() => {
                  setStep("tables");
                  setSelectedTable(null);
                  setReservationDate(undefined);
                  setReservationTime("");
                  setNotes("");
                }}
              >
                Fazer Nova Reserva
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Reservations;
