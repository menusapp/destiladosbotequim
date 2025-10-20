import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Calendar as CalendarIcon, PlusCircle, MinusCircle } from "lucide-react";
import { format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface CashRegisterTabProps {
  restaurantId: string;
}

interface CashSession {
  id: string;
  opened_by: string;
  closed_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening_balance: number;
  closing_balance: number | null;
  expected_balance: number | null;
  difference: number | null;
  status: string;
  notes: string | null;
}

interface CashMovement {
  id: string;
  cash_session_id: string;
  movement_type: string;
  amount: number;
  description: string;
  category: string | null;
  payment_method: string | null;
  created_by: string;
  created_at: string;
  bill_id: string | null;
}

export default function CashRegisterTab({ restaurantId }: CashRegisterTabProps) {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [closedSessions, setClosedSessions] = useState<CashSession[]>([]);
  const [allMovements, setAllMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para abrir caixa
  const [openingBalance, setOpeningBalance] = useState("");
  const [openedBy, setOpenedBy] = useState("");

  // Estados para fechar caixa
  const [closingBalance, setClosingBalance] = useState("");
  const [closedBy, setClosedBy] = useState("");
  const [closeNotes, setCloseNotes] = useState("");

  // Estados para movimentação
  const [movementType, setMovementType] = useState("entrada");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementDescription, setMovementDescription] = useState("");
  const [movementCategory, setMovementCategory] = useState("");
  const [movementPaymentMethod, setMovementPaymentMethod] = useState("dinheiro");
  const [movementCreatedBy, setMovementCreatedBy] = useState("");

  // Estados para relatórios
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();

  useEffect(() => {
    fetchCurrentSession();
    fetchClosedSessions();
  }, [restaurantId]);

  useEffect(() => {
    if (currentSession) {
      fetchMovements();
    }
  }, [currentSession]);

  const fetchCurrentSession = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cash_register_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentSession(data);
    } catch (error: any) {
      toast.error("Erro ao buscar sessão de caixa: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async () => {
    if (!currentSession) return;
    
    try {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("cash_session_id", currentSession.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error: any) {
      toast.error("Erro ao buscar movimentações: " + error.message);
    }
  };

  const fetchClosedSessions = async () => {
    try {
      const { data, error } = await supabase
        .from("cash_register_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "closed")
        .order("closed_at", { ascending: false});

      if (error) throw error;
      setClosedSessions(data || []);
      
      // Buscar movimentações das sessões fechadas
      if (data && data.length > 0) {
        const sessionIds = data.map(s => s.id);
        const { data: movementsData, error: movError } = await supabase
          .from("cash_movements")
          .select("*")
          .in("cash_session_id", sessionIds)
          .order("created_at", { ascending: false });
        
        if (movError) throw movError;
        setAllMovements(movementsData || []);
      } else {
        setAllMovements([]);
      }
    } catch (error: any) {
      console.error("Erro ao buscar sessões fechadas:", error);
    }
  };

  const handleOpenCashRegister = async () => {
    if (!openedBy || !openingBalance) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("cash_register_sessions").insert({
        restaurant_id: restaurantId,
        opened_by: openedBy,
        opening_balance: parseFloat(openingBalance),
        status: "open"
      });

      if (error) throw error;
      
      toast.success("Caixa aberto com sucesso!");
      setOpenedBy("");
      setOpeningBalance("");
      fetchCurrentSession();
    } catch (error: any) {
      toast.error("Erro ao abrir caixa: " + error.message);
    }
  };

  const handleCloseCashRegister = async () => {
    if (!currentSession || !closedBy || !closingBalance) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const expectedBalance = calculateExpectedBalance();
    const difference = parseFloat(closingBalance) - expectedBalance;

    try {
      const { error } = await supabase
        .from("cash_register_sessions")
        .update({
          closed_by: closedBy,
          closed_at: new Date().toISOString(),
          closing_balance: parseFloat(closingBalance),
          expected_balance: expectedBalance,
          difference: difference,
          status: "closed",
          notes: closeNotes
        })
        .eq("id", currentSession.id);

      if (error) throw error;
      
      toast.success("Caixa fechado com sucesso!");
      setClosedBy("");
      setClosingBalance("");
      setCloseNotes("");
      setCurrentSession(null);
      fetchCurrentSession();
      fetchClosedSessions();
    } catch (error: any) {
      toast.error("Erro ao fechar caixa: " + error.message);
    }
  };

  const handleAddMovement = async () => {
    if (!currentSession || !movementAmount || !movementDescription || !movementCreatedBy) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      const { error } = await supabase.from("cash_movements").insert({
        cash_session_id: currentSession.id,
        restaurant_id: restaurantId,
        movement_type: movementType,
        amount: parseFloat(movementAmount),
        description: movementDescription,
        category: movementCategory || null,
        payment_method: movementPaymentMethod,
        created_by: movementCreatedBy
      });

      if (error) throw error;
      
      toast.success("Movimentação registrada!");
      setMovementAmount("");
      setMovementDescription("");
      setMovementCategory("");
      setMovementCreatedBy("");
      fetchMovements();
    } catch (error: any) {
      toast.error("Erro ao registrar movimentação: " + error.message);
    }
  };

  const calculateExpectedBalance = () => {
    if (!currentSession) return 0;
    
    let balance = currentSession.opening_balance;
    
    movements.forEach(mov => {
      if (mov.movement_type === "entrada") {
        balance += mov.amount;
      } else {
        balance -= mov.amount;
      }
    });

    return balance;
  };

  const calculateTotalSales = () => {
    return movements
      .filter(m => m.movement_type === "entrada")
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const calculateTotalExpenses = () => {
    return movements
      .filter(m => m.movement_type === "saida")
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    switch (dateFilter) {
      case "today":
        startDate = startOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "7days":
        startDate = startOfDay(subDays(now, 6));
        break;
      case "thisMonth":
        startDate = startOfMonth(now);
        break;
      case "lastMonth":
        startDate = startOfMonth(subMonths(now, 1));
        endDate = endOfMonth(subMonths(now, 1));
        break;
      case "custom":
        if (customDateRange?.from) {
          startDate = startOfDay(customDateRange.from);
          endDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
        } else {
          startDate = startOfDay(now);
        }
        break;
      default:
        startDate = startOfDay(now);
    }

    return { startDate, endDate };
  };

  const filterSessionsByDate = (session: CashSession) => {
    const { startDate, endDate } = getDateRange();
    const sessionDate = new Date(session.closed_at || session.opened_at);
    return sessionDate >= startDate && sessionDate <= endDate;
  };

  const generateDRE = async () => {
    const filtered = closedSessions.filter(filterSessionsByDate);
    const { startDate, endDate } = getDateRange();

    const totalRevenue = filtered.reduce((sum, s) => {
      const sessionMovements = allMovements.filter(m => m.cash_session_id === s.id && m.movement_type === "entrada");
      return sum + sessionMovements.reduce((total, m) => total + m.amount, 0);
    }, 0);

    const operationalExpenses = filtered.reduce((sum, s) => {
      const sessionMovements = allMovements.filter(m => m.cash_session_id === s.id && m.movement_type === "saida");
      return sum + sessionMovements.reduce((total, m) => total + m.amount, 0);
    }, 0);

    // Calcular CMV (Custo de Mercadorias Vendidas) baseado nos ingredientes dos produtos vendidos
    let cmv = 0;
    try {
      // Buscar todos os pedidos aceitos no período
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          table_id,
          order_items (
            id,
            quantity,
            product_id,
            products (
              id,
              product_ingredients (
                quantity,
                stock_items (
                  price_per_unit
                )
              )
            )
          )
        `)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString())
        .eq("status", "accepted");

      if (ordersError) throw ordersError;

      // Calcular o custo total dos ingredientes
      orders?.forEach(order => {
        order.order_items?.forEach((item: any) => {
          const itemQuantity = item.quantity;
          const ingredients = item.products?.product_ingredients || [];
          
          ingredients.forEach((ingredient: any) => {
            const ingredientQty = ingredient.quantity;
            const pricePerUnit = ingredient.stock_items?.price_per_unit || 0;
            cmv += ingredientQty * pricePerUnit * itemQuantity;
          });
        });
      });
    } catch (error) {
      console.error("Erro ao calcular CMV:", error);
    }

    const totalExpenses = operationalExpenses + cmv;
    const grossProfit = totalRevenue - cmv;
    const netProfit = totalRevenue - totalExpenses;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return { 
      salesTotal: totalRevenue, 
      cmv,
      grossProfit,
      operationalExpenses, 
      totalExpenses,
      netProfit, 
      grossMargin,
      netMargin
    };
  };

  const [dreData, setDreData] = useState<{
    salesTotal: number;
    cmv: number;
    grossProfit: number;
    operationalExpenses: number;
    totalExpenses: number;
    netProfit: number;
    grossMargin: number;
    netMargin: number;
  }>({
    salesTotal: 0,
    cmv: 0,
    grossProfit: 0,
    operationalExpenses: 0,
    totalExpenses: 0,
    netProfit: 0,
    grossMargin: 0,
    netMargin: 0
  });

  useEffect(() => {
    const loadDRE = async () => {
      const data = await generateDRE();
      setDreData(data);
    };
    
    if (closedSessions.length > 0) {
      loadDRE();
    }
  }, [closedSessions, allMovements, dateFilter, customDateRange]);

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gestão de Caixa</h2>
          <p className="text-muted-foreground">Controle completo do fluxo de caixa</p>
        </div>
        
        {!currentSession ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Wallet className="h-5 w-5" />
                Abrir Caixa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Abrir Caixa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Responsável pela abertura</Label>
                  <Input
                    value={openedBy}
                    onChange={(e) => setOpenedBy(e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div>
                  <Label>Saldo inicial (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <Button onClick={handleOpenCashRegister} className="w-full">
                  Abrir Caixa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="lg" className="gap-2">
                <Wallet className="h-5 w-5" />
                Fechar Caixa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Fechar Caixa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>Saldo inicial:</span>
                    <span className="font-bold">R$ {currentSession.opening_balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Saldo esperado:</span>
                    <span className="font-bold">R$ {calculateExpectedBalance().toFixed(2)}</span>
                  </div>
                </div>
                <div>
                  <Label>Responsável pelo fechamento</Label>
                  <Input
                    value={closedBy}
                    onChange={(e) => setClosedBy(e.target.value)}
                    placeholder="Nome do responsável"
                  />
                </div>
                <div>
                  <Label>Saldo real no caixa (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={closingBalance}
                    onChange={(e) => setClosingBalance(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                {closingBalance && (
                  <div className={`p-3 rounded-lg ${
                    parseFloat(closingBalance) - calculateExpectedBalance() >= 0 
                      ? "bg-green-100 text-green-800" 
                      : "bg-red-100 text-red-800"
                  }`}>
                    Diferença: R$ {(parseFloat(closingBalance) - calculateExpectedBalance()).toFixed(2)}
                  </div>
                )}
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    value={closeNotes}
                    onChange={(e) => setCloseNotes(e.target.value)}
                    placeholder="Observações sobre o fechamento..."
                  />
                </div>
                <Button onClick={handleCloseCashRegister} className="w-full">
                  Confirmar Fechamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {currentSession && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Caixa Atual
            </CardTitle>
            <CardDescription>
              Aberto por {currentSession.opened_by} em {format(new Date(currentSession.opened_at), "dd/MM/yyyy 'às' HH:mm")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Saldo Inicial</p>
                <p className="text-2xl font-bold">R$ {currentSession.opening_balance.toFixed(2)}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Entradas</p>
                <p className="text-2xl font-bold text-green-600">R$ {calculateTotalSales().toFixed(2)}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Saídas</p>
                <p className="text-2xl font-bold text-red-600">R$ {calculateTotalExpenses().toFixed(2)}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Saldo Esperado</p>
                <p className="text-2xl font-bold text-purple-600">R$ {calculateExpectedBalance().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="movements" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="space-y-4">
          {currentSession && (
            <Card>
              <CardHeader>
                <CardTitle>Registrar Movimentação</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Tipo de Movimentação</Label>
                    <Select value={movementType} onValueChange={setMovementType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="entrada">Entrada</SelectItem>
                        <SelectItem value="saida">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Valor (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={movementAmount}
                      onChange={(e) => setMovementAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={movementDescription}
                      onChange={(e) => setMovementDescription(e.target.value)}
                      placeholder="Descrição da movimentação"
                    />
                  </div>
                  <div>
                    <Label>Categoria (opcional)</Label>
                    <Input
                      value={movementCategory}
                      onChange={(e) => setMovementCategory(e.target.value)}
                      placeholder="Ex: Alimentação, Limpeza..."
                    />
                  </div>
                  <div>
                    <Label>Forma de Pagamento</Label>
                    <Select value={movementPaymentMethod} onValueChange={setMovementPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
                        <SelectItem value="credito">Crédito</SelectItem>
                        <SelectItem value="debito">Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Responsável</Label>
                    <Input
                      value={movementCreatedBy}
                      onChange={(e) => setMovementCreatedBy(e.target.value)}
                      placeholder="Nome do responsável"
                    />
                  </div>
                </div>
                <Button onClick={handleAddMovement} className="w-full mt-4">
                  {movementType === "entrada" ? (
                    <PlusCircle className="h-4 w-4 mr-2" />
                  ) : (
                    <MinusCircle className="h-4 w-4 mr-2" />
                  )}
                  Registrar Movimentação
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Histórico de Movimentações</CardTitle>
              <CardDescription>
                {currentSession 
                  ? `${movements.length} movimentações registradas nesta sessão`
                  : "Abra o caixa para ver as movimentações"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {movements.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma movimentação registrada
                  </p>
                ) : (
                  movements.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        {mov.movement_type === "entrada" ? (
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <p className="font-medium">{mov.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {mov.movement_type} • {mov.payment_method} • {mov.created_by}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(mov.created_at), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className={`text-lg font-bold ${
                        mov.movement_type === "entrada"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {mov.movement_type === "entrada" ? "+" : "-"}
                        R$ {mov.amount.toFixed(2)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={dateFilter === "today" ? "default" : "outline"}
                  onClick={() => setDateFilter("today")}
                >
                  Hoje
                </Button>
                <Button
                  variant={dateFilter === "yesterday" ? "default" : "outline"}
                  onClick={() => setDateFilter("yesterday")}
                >
                  Ontem
                </Button>
                <Button
                  variant={dateFilter === "7days" ? "default" : "outline"}
                  onClick={() => setDateFilter("7days")}
                >
                  Últimos 7 Dias
                </Button>
                <Button
                  variant={dateFilter === "thisMonth" ? "default" : "outline"}
                  onClick={() => setDateFilter("thisMonth")}
                >
                  Este Mês
                </Button>
                <Button
                  variant={dateFilter === "lastMonth" ? "default" : "outline"}
                  onClick={() => setDateFilter("lastMonth")}
                >
                  Mês Passado
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === "custom" ? "default" : "outline"}
                      className={cn("justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter === "custom" && customDateRange?.from
                        ? customDateRange.to
                          ? `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                          : format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        : "Personalizado"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={customDateRange}
                      onSelect={(range) => {
                        setCustomDateRange(range);
                        if (range?.from) {
                          setDateFilter("custom");
                        }
                      }}
                      locale={ptBR}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Receitas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-green-50 rounded-lg">
                    <span className="font-medium">Total de Receitas</span>
                    <span className="text-2xl font-bold text-green-600">
                      R$ {closedSessions
                        .filter(filterSessionsByDate)
                        .reduce((total, session) => {
                          const sessionEntries = allMovements.filter(m => 
                            m.cash_session_id === session.id && m.movement_type === "entrada"
                          );
                          return total + sessionEntries.reduce((sum, m) => sum + m.amount, 0);
                        }, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Por tipo de entrada:</p>
                    {Array.from(new Set(
                      allMovements
                        .filter(m => m.movement_type === "entrada")
                        .map(m => m.category || "Sem categoria")
                    )).map(category => {
                      const total = closedSessions
                        .filter(filterSessionsByDate)
                        .reduce((sum, session) => {
                          const categoryMovements = allMovements.filter(m => 
                            m.cash_session_id === session.id && 
                            m.movement_type === "entrada" && 
                            (m.category || "Sem categoria") === category
                          );
                          return sum + categoryMovements.reduce((t, m) => t + m.amount, 0);
                        }, 0);
                      
                      if (total === 0) return null;
                      
                      return (
                        <div key={category} className="flex justify-between p-2 border-l-2 border-green-500 pl-4">
                          <span>{category}</span>
                          <span className="font-medium">R$ {total.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Despesas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-red-50 rounded-lg">
                    <span className="font-medium">Total de Despesas</span>
                    <span className="text-2xl font-bold text-red-600">
                      R$ {closedSessions
                        .filter(filterSessionsByDate)
                        .reduce((total, session) => {
                          const sessionExits = allMovements.filter(m => 
                            m.cash_session_id === session.id && m.movement_type === "saida"
                          );
                          return total + sessionExits.reduce((sum, m) => sum + m.amount, 0);
                        }, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Por tipo de despesa:</p>
                    {Array.from(new Set(
                      allMovements
                        .filter(m => m.movement_type === "saida")
                        .map(m => m.category || "Sem categoria")
                    )).map(category => {
                      const total = closedSessions
                        .filter(filterSessionsByDate)
                        .reduce((sum, session) => {
                          const categoryMovements = allMovements.filter(m => 
                            m.cash_session_id === session.id && 
                            m.movement_type === "saida" && 
                            (m.category || "Sem categoria") === category
                          );
                          return sum + categoryMovements.reduce((t, m) => t + m.amount, 0);
                        }, 0);
                      
                      if (total === 0) return null;
                      
                      return (
                        <div key={category} className="flex justify-between p-2 border-l-2 border-red-500 pl-4">
                          <span>{category}</span>
                          <span className="font-medium">R$ {total.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={dateFilter === "today" ? "default" : "outline"}
                  onClick={() => setDateFilter("today")}
                >
                  Hoje
                </Button>
                <Button
                  variant={dateFilter === "yesterday" ? "default" : "outline"}
                  onClick={() => setDateFilter("yesterday")}
                >
                  Ontem
                </Button>
                <Button
                  variant={dateFilter === "7days" ? "default" : "outline"}
                  onClick={() => setDateFilter("7days")}
                >
                  Últimos 7 Dias
                </Button>
                <Button
                  variant={dateFilter === "thisMonth" ? "default" : "outline"}
                  onClick={() => setDateFilter("thisMonth")}
                >
                  Este Mês
                </Button>
                <Button
                  variant={dateFilter === "lastMonth" ? "default" : "outline"}
                  onClick={() => setDateFilter("lastMonth")}
                >
                  Mês Passado
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === "custom" ? "default" : "outline"}
                      className={cn("justify-start text-left font-normal")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFilter === "custom" && customDateRange?.from
                        ? customDateRange.to
                          ? `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                          : format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        : "Personalizado"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="range"
                      selected={customDateRange}
                      onSelect={(range) => {
                        setCustomDateRange(range);
                        if (range?.from) {
                          setDateFilter("custom");
                        }
                      }}
                      locale={ptBR}
                      numberOfMonths={2}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Demonstração do Resultado do Exercício (DRE)
              </CardTitle>
              <CardDescription>
                {(() => {
                  const { startDate, endDate } = getDateRange();
                  return `Período: ${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Receitas */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-lg border-l-4 border-green-500">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">RECEITA BRUTA</p>
                      <p className="text-xs text-muted-foreground">Todas as entradas do período</p>
                    </div>
                    <span className="font-bold text-2xl text-green-600">R$ {dreData.salesTotal.toFixed(2)}</span>
                  </div>
                </div>

                {/* CMV */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border-l-4 border-orange-500">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">(-) CMV - CUSTO DE MERCADORIAS VENDIDAS</p>
                      <p className="text-xs text-muted-foreground">Custo dos insumos utilizados nos produtos vendidos</p>
                    </div>
                    <span className="font-bold text-xl text-orange-600">R$ {dreData.cmv.toFixed(2)}</span>
                  </div>
                </div>

                {/* Lucro Bruto */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border-l-4 border-blue-500">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">(=) LUCRO BRUTO</p>
                      <p className="text-xs text-muted-foreground">Receita - CMV | Margem: {dreData.grossMargin.toFixed(1)}%</p>
                    </div>
                    <span className="font-bold text-2xl text-blue-600">R$ {dreData.grossProfit.toFixed(2)}</span>
                  </div>
                </div>

                {/* Despesas Operacionais */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-gradient-to-r from-red-50 to-red-100 rounded-lg border-l-4 border-red-500">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">(-) DESPESAS OPERACIONAIS</p>
                      <p className="text-xs text-muted-foreground">Todas as saídas registradas no caixa</p>
                    </div>
                    <span className="font-bold text-xl text-red-600">R$ {dreData.operationalExpenses.toFixed(2)}</span>
                  </div>
                </div>

                {/* Separador */}
                <div className="border-t-2 border-dashed"></div>

                {/* Despesas Totais */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <div>
                      <p className="text-sm font-medium">TOTAL DE DESPESAS</p>
                      <p className="text-xs text-muted-foreground">CMV + Despesas Operacionais</p>
                    </div>
                    <span className="font-bold text-lg">R$ {dreData.totalExpenses.toFixed(2)}</span>
                  </div>
                </div>

                {/* Separador Final */}
                <div className="border-t-4 border-primary"></div>

                {/* Lucro Líquido */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-5 bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg border-l-4 border-purple-500 shadow-md">
                    <div>
                      <p className="text-base font-bold text-purple-900">(=) LUCRO LÍQUIDO</p>
                      <p className="text-xs text-muted-foreground">Receita Bruta - Total de Despesas</p>
                    </div>
                    <span className="font-bold text-3xl text-purple-600">R$ {dreData.netProfit.toFixed(2)}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <span className="text-xs text-muted-foreground">Margem Bruta</span>
                      <span className="font-bold text-xl text-blue-600">{dreData.grossMargin.toFixed(1)}%</span>
                    </div>
                    <div className="flex flex-col p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <span className="text-xs text-muted-foreground">Margem Líquida</span>
                      <span className="font-bold text-xl text-purple-600">{dreData.netMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}