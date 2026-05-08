import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, Users, AlertTriangle, Check, X, Calendar as CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { normalizeSearch } from "@/lib/searchNormalize";

interface EmployeeCreditsTabProps {
  restaurantId: string;
}

interface EmployeeCredit {
  id: string;
  employee_name: string;
  employee_id: string | null;
  order_id: string | null;
  amount: number;
  status: string;
  notes: string | null;
  due_date: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  paid_method: string | null;
  created_at: string;
  created_by: string | null;
}

export const EmployeeCreditsTab = ({ restaurantId }: EmployeeCreditsTabProps) => {
  const [credits, setCredits] = useState<EmployeeCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [nameFilter, setNameFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);

  // Pay dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<EmployeeCredit | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [creditToCancel, setCreditToCancel] = useState<EmployeeCredit | null>(null);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("employee_credits")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (dateRange?.from) {
        query = query.gte("created_at", dateRange.from.toISOString());
        if (dateRange.to) {
          query = query.lte("created_at", new Date(dateRange.to.getTime() + 86400000).toISOString());
        }
      }

      const { data, error } = await query;
      if (error) throw error;
      setCredits(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar créditos: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, [restaurantId, statusFilter, dateRange]);

  const filtered = useMemo(() => {
    if (!nameFilter) return credits;
    return credits.filter(c => normalizeSearch(c.employee_name).includes(normalizeSearch(nameFilter)));
  }, [credits, nameFilter]);

  const totalPending = useMemo(() =>
    credits.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0),
    [credits]
  );

  const totalPaid = useMemo(() =>
    credits.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.paid_amount || c.amount), 0),
    [credits]
  );

  const uniqueEmployees = useMemo(() =>
    new Set(credits.filter(c => c.status === "pending").map(c => c.employee_name)).size,
    [credits]
  );

  const handleMarkPaid = async () => {
    if (!selectedCredit) return;
    const amount = parseFloat(payAmount) || selectedCredit.amount;
    try {
      const { error } = await supabase
        .from("employee_credits")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_amount: amount,
          paid_method: payMethod,
        })
        .eq("id", selectedCredit.id);
      if (error) throw error;
      toast.success("Crédito marcado como pago!");
      setPayDialogOpen(false);
      setSelectedCredit(null);
      setPayAmount("");
      fetchCredits();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const handleCancel = async () => {
    if (!creditToCancel) return;
    try {
      const { error } = await supabase
        .from("employee_credits")
        .update({ status: "cancelled" })
        .eq("id", creditToCancel.id);
      if (error) throw error;
      toast.success("Crédito cancelado!");
      setCancelDialogOpen(false);
      setCreditToCancel(null);
      fetchCredits();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pendente</Badge>;
      case "paid":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Pago</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando créditos...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Totalizadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">R$ {totalPending.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Pendente</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">R$ {totalPaid.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">Total Pago</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueEmployees}</p>
              <p className="text-xs text-muted-foreground">Funcionários com crédito aberto</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Filtrar por nome..."
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          className="w-48"
        />

        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {dateRange?.from
                ? dateRange.to
                  ? `${format(dateRange.from, "dd/MM", { locale: ptBR })} - ${format(dateRange.to, "dd/MM", { locale: ptBR })}`
                  : format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) setDatePopoverOpen(false);
              }}
              locale={ptBR}
            />
          </PopoverContent>
        </Popover>

        {(dateRange || statusFilter !== "all" || nameFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setDateRange(undefined); setStatusFilter("all"); setNameFilter(""); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-3 font-medium">Funcionário</th>
                  <th className="text-left p-3 font-medium">Data</th>
                  <th className="text-left p-3 font-medium">Pedido</th>
                  <th className="text-right p-3 font-medium">Valor</th>
                  <th className="text-left p-3 font-medium">Vencimento</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Nenhum crédito encontrado
                    </td>
                  </tr>
                ) : (
                  filtered.map(credit => (
                    <tr key={credit.id} className="border-b hover:bg-muted/20">
                      <td className="p-3 font-medium">{credit.employee_name}</td>
                      <td className="p-3 text-muted-foreground">
                        {format(new Date(credit.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="p-3 text-muted-foreground font-mono text-xs">
                        {credit.order_id ? `#${credit.order_id.slice(0, 8)}` : "-"}
                      </td>
                      <td className="p-3 text-right font-semibold tabular-nums">
                        R$ {Number(credit.amount).toFixed(2)}
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {credit.due_date ? format(new Date(credit.due_date), "dd/MM/yyyy") : "-"}
                      </td>
                      <td className="p-3">{statusBadge(credit.status)}</td>
                      <td className="p-3 text-right">
                        {credit.status === "pending" && (
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="outline" size="sm" className="h-7 gap-1 text-green-600"
                              onClick={() => {
                                setSelectedCredit(credit);
                                setPayAmount(String(credit.amount));
                                setPayDialogOpen(true);
                              }}
                            >
                              <Check className="h-3 w-3" /> Pagar
                            </Button>
                            <Button
                              variant="outline" size="sm" className="h-7 gap-1 text-red-600"
                              onClick={() => {
                                setCreditToCancel(credit);
                                setCancelDialogOpen(true);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {credit.status === "paid" && credit.paid_method && (
                          <span className="text-xs text-muted-foreground">
                            {credit.paid_method === "cash" ? "Dinheiro" :
                             credit.paid_method === "pix" ? "PIX" :
                             credit.paid_method === "payroll" ? "Desconto em folha" :
                             credit.paid_method}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog: Marcar como Pago */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar Crédito como Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="bg-muted/30 p-3 rounded-lg text-sm">
              <p><strong>Funcionário:</strong> {selectedCredit?.employee_name}</p>
              <p><strong>Valor original:</strong> R$ {Number(selectedCredit?.amount || 0).toFixed(2)}</p>
            </div>
            <div>
              <Label>Valor pago (R$)</Label>
              <Input
                type="number" step="0.01"
                value={payAmount}
                onChange={e => setPayAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Método de quitação</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="payroll">Desconto em folha</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleMarkPaid} className="w-full">Confirmar Pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Cancelar */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm">
              Tem certeza que deseja cancelar o crédito de <strong>{creditToCancel?.employee_name}</strong> no valor de <strong>R$ {Number(creditToCancel?.amount || 0).toFixed(2)}</strong>?
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setCancelDialogOpen(false)}>Não</Button>
              <Button variant="destructive" className="flex-1" onClick={handleCancel}>Sim, Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeCreditsTab;
