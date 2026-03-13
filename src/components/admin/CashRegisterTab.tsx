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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  DollarSign, TrendingUp, TrendingDown, Wallet, FileText, 
  Calendar as CalendarIcon, PlusCircle, MinusCircle, 
  ChevronDown, Receipt, Banknote, Coins
} from "lucide-react";
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
  const [lastClosedSession, setLastClosedSession] = useState<CashSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Estados para abrir caixa
  const [openingBalance, setOpeningBalance] = useState("");
  const [openedBy, setOpenedBy] = useState("");
  const [billCounts, setBillCounts] = useState({
    bill200: 0, bill100: 0, bill50: 0, bill20: 0, bill10: 0, bill5: 0, bill2: 0
  });
  const [coinCounts, setCoinCounts] = useState({
    coin100: 0, coin50: 0, coin25: 0, coin10: 0, coin05: 0
  });

  // Calcular total da contagem de cédulas e moedas
  const calculateCashCountTotal = () => {
    const billsTotal = 
      billCounts.bill200 * 200 + 
      billCounts.bill100 * 100 + 
      billCounts.bill50 * 50 +
      billCounts.bill20 * 20 + 
      billCounts.bill10 * 10 + 
      billCounts.bill5 * 5 + 
      billCounts.bill2 * 2;
    
    const coinsTotal = 
      coinCounts.coin100 * 1 + 
      coinCounts.coin50 * 0.5 + 
      coinCounts.coin25 * 0.25 +
      coinCounts.coin10 * 0.1 + 
      coinCounts.coin05 * 0.05;
    
    return billsTotal + coinsTotal;
  };

  // Atualizar saldo inicial quando contagem mudar
  useEffect(() => {
    const total = calculateCashCountTotal();
    if (total > 0) {
      setOpeningBalance(total.toFixed(2));
    }
  }, [billCounts, coinCounts]);

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

      if (!data) {
        const { data: lastClosed, error: lastError } = await supabase
          .from("cash_register_sessions")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .eq("status", "closed")
          .order("closed_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastError) throw lastError;
        setLastClosedSession(lastClosed);

        if (lastClosed) {
          const { data: lastMovements, error: movError } = await supabase
            .from("cash_movements")
            .select("*")
            .eq("cash_session_id", lastClosed.id)
            .order("created_at", { ascending: false });

          if (movError) throw movError;
          setMovements(lastMovements || []);
        }
      } else {
        setLastClosedSession(null);
      }
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
      setBillCounts({ bill200: 0, bill100: 0, bill50: 0, bill20: 0, bill10: 0, bill5: 0, bill2: 0 });
      setCoinCounts({ coin100: 0, coin50: 0, coin25: 0, coin10: 0, coin05: 0 });
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
    const { startDate, endDate } = getDateRange();

    const sessionsInRange: CashSession[] = [
      ...closedSessions.filter(filterSessionsByDate),
      ...(currentSession && filterSessionsByDate(currentSession) ? [currentSession] : []),
    ];

    const sessionIds = sessionsInRange.map((s) => s.id);

    const movementsInRange: CashMovement[] = [
      ...allMovements.filter((m) => sessionIds.includes(m.cash_session_id)),
      ...(currentSession && sessionIds.includes(currentSession.id) ? movements : []),
    ];

    const totalRevenue = movementsInRange
      .filter((m) => m.movement_type === "entrada")
      .reduce((sum, m) => sum + m.amount, 0);

    const operationalExpenses = movementsInRange
      .filter((m) => m.movement_type === "saida")
      .reduce((sum, m) => sum + m.amount, 0);

    let cmv = 0;
    try {
      const cashMovementsOrders = movementsInRange.filter(
        (m) => m.movement_type === "entrada" && m.category === "Pedido"
      );

      const orderIds: string[] = [];
      cashMovementsOrders.forEach((movement) => {
        const match = movement.description.match(/Pedido #([a-f0-9-]+)/);
        if (match && match[1]) orderIds.push(match[1]);
      });

      if (orderIds.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from("order_items")
          .select(`
            id,
            quantity,
            order_id,
            products (
              id,
              product_ingredients (
                quantity,
                stock_items ( price_per_unit )
              )
            )
          `)
          .in("order_id", orderIds);

        if (itemsError) throw itemsError;

        items?.forEach((item: any) => {
          const itemQty = item.quantity;
          const ingredients = item.products?.product_ingredients || [];
          ingredients.forEach((ing: any) => {
            const ingQty = ing.quantity || 0;
            const pricePerUnit = ing.stock_items?.price_per_unit || 0;
            cmv += ingQty * pricePerUnit * itemQty;
          });
        });
      }

      if (cmv === 0) {
        const { data: stockMoves } = await supabase
          .from("stock_movements")
          .select("stock_item_id, quantity, movement_type, created_at, reason")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());

        const saleMoves = (stockMoves || []).filter((m: any) => m.movement_type === 'out' && m.reason && m.reason.startsWith('Venda - Pedido'));
        const stockIds = Array.from(new Set(saleMoves.map((m: any) => m.stock_item_id)));
        if (stockIds.length > 0) {
          const { data: stockItems } = await supabase
            .from("stock_items")
            .select("id, price_per_unit")
            .in("id", stockIds);
          const priceMap = new Map<string, number>();
          (stockItems || []).forEach((s: any) => priceMap.set(s.id, Number(s.price_per_unit) || 0));
          saleMoves.forEach((m: any) => {
            cmv += Number(m.quantity) * (priceMap.get(m.stock_item_id) || 0);
          });
        }
      }
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
      netMargin,
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

    loadDRE();
  }, [closedSessions, allMovements, currentSession, movements, dateFilter, customDateRange]);

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  const billDenominations = [
    { key: 'bill200', label: 'R$ 200', value: 200 },
    { key: 'bill100', label: 'R$ 100', value: 100 },
    { key: 'bill50', label: 'R$ 50', value: 50 },
    { key: 'bill20', label: 'R$ 20', value: 20 },
    { key: 'bill10', label: 'R$ 10', value: 10 },
    { key: 'bill5', label: 'R$ 5', value: 5 },
    { key: 'bill2', label: 'R$ 2', value: 2 },
  ];

  const coinDenominations = [
    { key: 'coin100', label: 'R$ 1,00', value: 1 },
    { key: 'coin50', label: 'R$ 0,50', value: 0.5 },
    { key: 'coin25', label: 'R$ 0,25', value: 0.25 },
    { key: 'coin10', label: 'R$ 0,10', value: 0.1 },
    { key: 'coin05', label: 'R$ 0,05', value: 0.05 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">Caixa</h2>
          <p className="text-sm text-muted-foreground font-light">Controle completo do fluxo de caixa</p>
        </div>
        
        {!currentSession ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="default" className="gap-2">
                <Wallet className="h-4 w-4" />
                Abrir Caixa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  Abrir Caixa
                </DialogTitle>
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
                
                {/* Contagem de cédulas/moedas */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="px-4 py-3 bg-muted/50 border-b">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Contagem de Cédulas e Moedas</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Banknote className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Cédulas</Label>
                      </div>
                      <div className="grid grid-cols-7 gap-2">
                        {billDenominations.map((bill) => (
                          <div key={bill.key} className="text-center">
                            <Label className="text-xs text-muted-foreground block mb-1">{bill.label}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={billCounts[bill.key as keyof typeof billCounts] || ''}
                              onChange={(e) => setBillCounts(prev => ({
                                ...prev,
                                [bill.key]: parseInt(e.target.value) || 0
                              }))}
                              placeholder="0"
                              className="text-center h-9 text-sm"
                            />
                            <p className="text-xs text-primary mt-1 font-medium">
                              {((billCounts[bill.key as keyof typeof billCounts] || 0) * bill.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Coins className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-sm font-medium">Moedas</Label>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {coinDenominations.map((coin) => (
                          <div key={coin.key} className="text-center">
                            <Label className="text-xs text-muted-foreground block mb-1">{coin.label}</Label>
                            <Input
                              type="number"
                              min="0"
                              value={coinCounts[coin.key as keyof typeof coinCounts] || ''}
                              onChange={(e) => setCoinCounts(prev => ({
                                ...prev,
                                [coin.key]: parseInt(e.target.value) || 0
                              }))}
                              placeholder="0"
                              className="text-center h-9 text-sm"
                            />
                            <p className="text-xs text-primary mt-1 font-medium">
                              {((coinCounts[coin.key as keyof typeof coinCounts] || 0) * coin.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-sm">Valor de Abertura:</span>
                        <span className="text-2xl font-bold text-primary">
                          {calculateCashCountTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={handleOpenCashRegister} className="w-full">
                  <Wallet className="h-4 w-4 mr-2" />
                  Abrir Caixa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="default" className="gap-2">
                <Wallet className="h-4 w-4" />
                Fechar Caixa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <Wallet className="h-5 w-5 text-destructive" />
                  </div>
                  Fechar Caixa
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-muted/50 p-4 rounded-lg space-y-2 border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo inicial:</span>
                    <span className="font-bold">R$ {currentSession.opening_balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Saldo esperado:</span>
                    <span className="font-bold">R$ {calculateExpectedBalance().toFixed(2)}</span>
                  </div>
                </div>
                <div>
                  <Label>Responsável pelo fechamento</Label>
                  <Input value={closedBy} onChange={(e) => setClosedBy(e.target.value)} placeholder="Nome do responsável" />
                </div>
                <div>
                  <Label>Saldo real no caixa (R$)</Label>
                  <Input type="number" step="0.01" value={closingBalance} onChange={(e) => setClosingBalance(e.target.value)} placeholder="0.00" />
                </div>
                {closingBalance && (
                  <div className={cn("p-3 rounded-lg text-sm font-medium",
                    parseFloat(closingBalance) - calculateExpectedBalance() >= 0
                      ? "bg-primary/10 text-primary border border-primary/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  )}>
                    Diferença: R$ {(parseFloat(closingBalance) - calculateExpectedBalance()).toFixed(2)}
                  </div>
                )}
                <div>
                  <Label>Observações</Label>
                  <Textarea value={closeNotes} onChange={(e) => setCloseNotes(e.target.value)} placeholder="Observações sobre o fechamento..." />
                </div>
                <Button onClick={handleCloseCashRegister} variant="destructive" className="w-full">
                  Confirmar Fechamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Cards de resumo do caixa atual */}
      {currentSession && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground">Saldo Inicial</p>
            <p className="text-lg font-bold mt-1 tabular-nums">R$ {currentSession.opening_balance.toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-lg font-bold mt-1 tabular-nums">R$ {calculateTotalSales().toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="text-lg font-bold mt-1 tabular-nums">R$ {calculateTotalExpenses().toFixed(2)}</p>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <p className="text-xs text-muted-foreground">Saldo Esperado</p>
            <p className="text-lg font-bold mt-1 tabular-nums">R$ {calculateExpectedBalance().toFixed(2)}</p>
          </div>
          <p className="col-span-full text-xs text-muted-foreground">
            Aberto por {currentSession.opened_by} em {format(new Date(currentSession.opened_at), "dd/MM/yyyy 'às' HH:mm")}
          </p>
        </div>
      )}

      {/* Último caixa fechado */}
      {!currentSession && lastClosedSession && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Último caixa fechado — {format(new Date(lastClosedSession.closed_at!), "dd/MM/yyyy 'às' HH:mm")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Saldo Inicial</p>
              <p className="text-lg font-bold mt-1 tabular-nums">R$ {lastClosedSession.opening_balance.toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Saldo Esperado</p>
              <p className="text-lg font-bold mt-1 tabular-nums">R$ {(lastClosedSession.expected_balance || 0).toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Saldo Final</p>
              <p className="text-lg font-bold mt-1 tabular-nums">R$ {(lastClosedSession.closing_balance || 0).toFixed(2)}</p>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">Diferença</p>
              <p className={cn("text-lg font-bold mt-1 tabular-nums", (lastClosedSession.difference || 0) >= 0 ? 'text-foreground' : 'text-destructive')}>
                R$ {(lastClosedSession.difference || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="movements" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="movements">Movimentações</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="space-y-4 mt-4">
          {!currentSession && !lastClosedSession && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-sm">Nenhum caixa aberto. Abra um caixa para registrar movimentações.</p>
              </CardContent>
            </Card>
          )}
          
          {/* Registrar Movimentação */}
          {currentSession && (
            <Collapsible defaultOpen={false} className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Receipt className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-medium text-sm">Registrar Movimentação</h3>
                      <p className="text-xs text-muted-foreground">Adicionar entrada ou saída</p>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-4 pb-4 pt-3 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={movementType} onValueChange={setMovementType}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">
                            <span className="flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-primary" /> Entrada</span>
                          </SelectItem>
                          <SelectItem value="saida">
                            <span className="flex items-center gap-2"><TrendingDown className="h-3.5 w-3.5 text-destructive" /> Saída</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input type="number" step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} placeholder="0.00" className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Forma de Pagamento</Label>
                      <Select value={movementPaymentMethod} onValueChange={setMovementPaymentMethod}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="credito">Crédito</SelectItem>
                          <SelectItem value="debito">Débito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Descrição</Label>
                      <Input value={movementDescription} onChange={(e) => setMovementDescription(e.target.value)} placeholder="Descrição da movimentação" className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Categoria (opcional)</Label>
                      <Input value={movementCategory} onChange={(e) => setMovementCategory(e.target.value)} placeholder="Ex: Alimentação, Limpeza..." className="h-9" />
                    </div>
                    <div>
                      <Label className="text-xs">Responsável</Label>
                      <Input value={movementCreatedBy} onChange={(e) => setMovementCreatedBy(e.target.value)} placeholder="Nome do responsável" className="h-9" />
                    </div>
                  </div>
                  <Button onClick={handleAddMovement} className="w-full mt-3" size="sm">
                    {movementType === "entrada" ? <PlusCircle className="h-3.5 w-3.5 mr-2" /> : <MinusCircle className="h-3.5 w-3.5 mr-2" />}
                    Registrar Movimentação
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Histórico de Movimentações */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Movimentações</CardTitle>
              <CardDescription className="text-xs">
                {currentSession
                  ? `${movements.length} movimentações nesta sessão`
                  : lastClosedSession
                    ? `${movements.length} movimentações do último caixa`
                    : "Nenhuma movimentação"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma movimentação registrada</p>
              ) : (
                <div className="border rounded-lg overflow-hidden divide-y max-h-[400px] overflow-y-auto">
                  {movements.map((mov) => (
                    <div key={mov.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                          mov.movement_type === "entrada" ? "bg-muted" : "bg-muted"
                        )}>
                          {mov.movement_type === "entrada" ? (
                            <TrendingUp className="h-3.5 w-3.5 text-foreground" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{mov.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {mov.category && `${mov.category} · `}
                            {mov.payment_method} · {mov.created_by} · {format(new Date(mov.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                      <span className={cn("font-semibold text-sm tabular-nums shrink-0 ml-3",
                        mov.movement_type === "entrada" ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {mov.movement_type === "entrada" ? "+" : "-"}R$ {mov.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4 mt-4">
          {/* Filtro de data */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "today", label: "Hoje" },
              { key: "yesterday", label: "Ontem" },
              { key: "7days", label: "7 Dias" },
              { key: "thisMonth", label: "Este Mês" },
              { key: "lastMonth", label: "Mês Passado" },
            ].map((f) => (
              <Button
                key={f.key}
                variant={dateFilter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={dateFilter === "custom" ? "default" : "outline"} size="sm" className="justify-start text-left font-normal">
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
                  onSelect={(range) => { setCustomDateRange(range); if (range?.from) setDateFilter("custom"); }}
                  locale={ptBR}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Cards de Receitas e Despesas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Receitas</CardTitle>
                  <span className="text-lg font-bold tabular-nums">
                    R$ {closedSessions
                      .filter(filterSessionsByDate)
                      .reduce((total, session) => {
                        const sessionEntries = allMovements.filter(m => m.cash_session_id === session.id && m.movement_type === "entrada");
                        return total + sessionEntries.reduce((sum, m) => sum + m.amount, 0);
                      }, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden divide-y">
                  {Array.from(new Set(
                    allMovements.filter(m => m.movement_type === "entrada").map(m => m.category || "Sem categoria")
                  )).map(category => {
                    const total = closedSessions
                      .filter(filterSessionsByDate)
                      .reduce((sum, session) => {
                        const categoryMovements = allMovements.filter(m => m.cash_session_id === session.id && m.movement_type === "entrada" && (m.category || "Sem categoria") === category);
                        return sum + categoryMovements.reduce((t, m) => t + m.amount, 0);
                      }, 0);
                    if (total === 0) return null;
                    return (
                      <div key={category} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium tabular-nums">R$ {total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Despesas</CardTitle>
                  <span className="text-lg font-bold tabular-nums">
                    R$ {closedSessions
                      .filter(filterSessionsByDate)
                      .reduce((total, session) => {
                        const sessionExits = allMovements.filter(m => m.cash_session_id === session.id && m.movement_type === "saida");
                        return total + sessionExits.reduce((sum, m) => sum + m.amount, 0);
                      }, 0)
                      .toFixed(2)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden divide-y">
                  {Array.from(new Set(
                    allMovements.filter(m => m.movement_type === "saida").map(m => m.category || "Sem categoria")
                  )).map(category => {
                    const total = closedSessions
                      .filter(filterSessionsByDate)
                      .reduce((sum, session) => {
                        const categoryMovements = allMovements.filter(m => m.cash_session_id === session.id && m.movement_type === "saida" && (m.category || "Sem categoria") === category);
                        return sum + categoryMovements.reduce((t, m) => t + m.amount, 0);
                      }, 0);
                    if (total === 0) return null;
                    return (
                      <div key={category} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-muted-foreground">{category}</span>
                        <span className="font-medium tabular-nums">R$ {total.toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="space-y-4 mt-4">
          {/* Filtro de data DRE */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { key: "today", label: "Hoje" },
              { key: "yesterday", label: "Ontem" },
              { key: "7days", label: "7 Dias" },
              { key: "thisMonth", label: "Este Mês" },
              { key: "lastMonth", label: "Mês Passado" },
            ].map((f) => (
              <Button
                key={f.key}
                variant={dateFilter === f.key ? "default" : "outline"}
                size="sm"
                onClick={() => setDateFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={dateFilter === "custom" ? "default" : "outline"} size="sm" className="justify-start text-left font-normal">
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
                  onSelect={(range) => { setCustomDateRange(range); if (range?.from) setDateFilter("custom"); }}
                  locale={ptBR}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* DRE */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">DRE - Demonstração de Resultados</CardTitle>
                  <CardDescription className="text-xs">
                    {(() => {
                      const { startDate, endDate } = getDateRange();
                      return `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;
                    })()}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                {/* Receita Bruta */}
                <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-b font-semibold">
                  <span>Receita Bruta</span>
                  <span className="text-primary tabular-nums">R$ {dreData.salesTotal.toFixed(2)}</span>
                </div>

                {/* CMV */}
                <div className="flex justify-between items-center px-4 py-2.5 border-b text-sm pl-8">
                  <span className="text-muted-foreground">(-) CMV</span>
                  <span className="tabular-nums">R$ {dreData.cmv.toFixed(2)}</span>
                </div>

                {/* Lucro Bruto */}
                <div className="flex justify-between items-center px-4 py-2.5 border-b bg-muted/20 font-medium text-sm">
                  <div className="flex items-center gap-2">
                    <span>(=) Lucro Bruto</span>
                    <span className="text-xs text-muted-foreground">Margem: {dreData.grossMargin.toFixed(1)}%</span>
                  </div>
                  <span className="text-primary tabular-nums">R$ {dreData.grossProfit.toFixed(2)}</span>
                </div>

                {/* Despesas */}
                <div className="flex justify-between items-center px-4 py-2.5 border-b text-sm pl-8">
                  <span className="text-muted-foreground">(-) Despesas Operacionais</span>
                  <span className="tabular-nums">R$ {dreData.operationalExpenses.toFixed(2)}</span>
                </div>

                {/* Total Despesas */}
                <div className="flex justify-between items-center px-4 py-2.5 border-b bg-muted/20 text-sm font-medium">
                  <span>Total de Despesas</span>
                  <span className="tabular-nums">R$ {dreData.totalExpenses.toFixed(2)}</span>
                </div>

                {/* Lucro Líquido */}
                <div className={cn(
                  "flex justify-between items-center px-4 py-4 font-bold text-lg",
                  dreData.netProfit >= 0 ? "bg-primary/5" : "bg-destructive/5"
                )}>
                  <span>Lucro Líquido</span>
                  <span className={cn("tabular-nums", dreData.netProfit >= 0 ? "text-primary" : "text-destructive")}>
                    R$ {dreData.netProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Margens */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="flex flex-col p-3 bg-muted/30 rounded-lg border">
                  <span className="text-xs text-muted-foreground">Margem Bruta</span>
                  <span className="font-bold text-lg tabular-nums">{dreData.grossMargin.toFixed(1)}%</span>
                </div>
                <div className={cn("flex flex-col p-3 rounded-lg border",
                  dreData.netMargin >= 0 ? "bg-primary/5 border-primary/10" : "bg-destructive/5 border-destructive/10"
                )}>
                  <span className="text-xs text-muted-foreground">Margem Líquida</span>
                  <span className={cn("font-bold text-lg tabular-nums", dreData.netMargin >= 0 ? "text-primary" : "text-destructive")}>
                    {dreData.netMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
