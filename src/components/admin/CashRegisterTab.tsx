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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gestão de Caixa</h2>
          <p className="text-muted-foreground">Controle completo do fluxo de caixa</p>
        </div>
        
        {!currentSession ? (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 bg-orange-500 hover:bg-orange-600">
                <Wallet className="h-5 w-5" />
                Abrir Caixa
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Wallet className="h-5 w-5 text-orange-600" />
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
                
                {/* Contagem de cédulas/moedas - sempre visível */}
                <div className="border rounded-lg overflow-hidden border-orange-200">
                  <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-orange-600" />
                      <span className="font-medium text-orange-900">Contagem de Cédulas e Moedas</span>
                    </div>
                  </div>
                  <div className="p-4 space-y-4 bg-orange-50/30">
                    {/* Cédulas */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Banknote className="h-4 w-4 text-orange-500" />
                        <Label className="text-sm font-medium text-orange-800">Cédulas</Label>
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
                            <p className="text-xs text-orange-600 mt-1 font-medium">
                              {((billCounts[bill.key as keyof typeof billCounts] || 0) * bill.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Moedas */}
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Coins className="h-4 w-4 text-amber-500" />
                        <Label className="text-sm font-medium text-amber-800">Moedas</Label>
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
                            <p className="text-xs text-amber-600 mt-1 font-medium">
                              {((coinCounts[coin.key as keyof typeof coinCounts] || 0) * coin.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Total da contagem = Valor de abertura */}
                    <div className="bg-orange-200 p-4 rounded-lg border border-orange-300">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-orange-800">Valor de Abertura:</span>
                        <span className="text-2xl font-bold text-orange-700">
                          {calculateCashCountTotal().toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button onClick={handleOpenCashRegister} className="w-full bg-orange-500 hover:bg-orange-600">
                  <Wallet className="h-4 w-4 mr-2" />
                  Abrir Caixa
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" size="lg" className="gap-2 bg-orange-600 hover:bg-orange-700">
                <Wallet className="h-5 w-5" />
                Fechar Caixa
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <Wallet className="h-5 w-5 text-orange-600" />
                  </div>
                  Fechar Caixa
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="bg-orange-50 p-4 rounded-lg space-y-2 border border-orange-200">
                  <div className="flex justify-between">
                    <span className="text-orange-800">Saldo inicial:</span>
                    <span className="font-bold text-orange-900">R$ {currentSession.opening_balance.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-800">Saldo esperado:</span>
                    <span className="font-bold text-orange-900">R$ {calculateExpectedBalance().toFixed(2)}</span>
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
                      ? "bg-orange-100 text-orange-800 border border-orange-200" 
                      : "bg-red-100 text-red-800 border border-red-200"
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
                <Button onClick={handleCloseCashRegister} className="w-full bg-orange-500 hover:bg-orange-600">
                  Confirmar Fechamento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Cards de resumo do caixa atual */}
      {currentSession && (
        <Card className="border-orange-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <DollarSign className="h-5 w-5 text-orange-500" />
              Caixa Atual
            </CardTitle>
            <CardDescription>
              Aberto por {currentSession.opened_by} em {format(new Date(currentSession.opened_at), "dd/MM/yyyy 'às' HH:mm")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-orange-100 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-700">Saldo Inicial</p>
                <p className="text-2xl font-bold text-orange-800">R$ {currentSession.opening_balance.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-600">Entradas</p>
                <p className="text-2xl font-bold text-orange-600">R$ {calculateTotalSales().toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700">Saídas</p>
                <p className="text-2xl font-bold text-orange-800">R$ {calculateTotalExpenses().toFixed(2)}</p>
              </div>
              <div className="bg-orange-200 p-4 rounded-lg border border-orange-300">
                <p className="text-sm text-orange-700">Saldo Esperado</p>
                <p className="text-2xl font-bold text-orange-800">R$ {calculateExpectedBalance().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Último caixa fechado */}
      {!currentSession && lastClosedSession && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <FileText className="h-5 w-5 text-orange-500" />
              Último Caixa Fechado
            </CardTitle>
            <CardDescription>
              Fechado em {format(new Date(lastClosedSession.closed_at!), "dd/MM/yyyy 'às' HH:mm")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-orange-100 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-700">Saldo Inicial</p>
                <p className="text-2xl font-bold text-orange-800">R$ {lastClosedSession.opening_balance.toFixed(2)}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-600">Saldo Esperado</p>
                <p className="text-2xl font-bold text-orange-700">R$ {(lastClosedSession.expected_balance || 0).toFixed(2)}</p>
              </div>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-700">Saldo Final</p>
                <p className="text-2xl font-bold text-orange-700">R$ {(lastClosedSession.closing_balance || 0).toFixed(2)}</p>
              </div>
              <div className="bg-orange-100 p-4 rounded-lg border border-orange-200">
                <p className="text-sm text-orange-700">Diferença</p>
                <p className={`text-2xl font-bold ${(lastClosedSession.difference || 0) >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  R$ {(lastClosedSession.difference || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="movements" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-orange-100">
          <TabsTrigger value="movements" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            Movimentações
          </TabsTrigger>
          <TabsTrigger value="reports" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="dre" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
            DRE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movements" className="space-y-4 mt-4">
          {!currentSession && !lastClosedSession && (
            <Card className="border-orange-200">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 text-orange-300" />
                Nenhum caixa aberto. Abra um caixa para registrar movimentações.
              </CardContent>
            </Card>
          )}
          
          {/* Registrar Movimentação - Collapsible (inicia fechada) */}
          {currentSession && (
            <Collapsible defaultOpen={false} className="border rounded-lg overflow-hidden border-orange-200">
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between px-6 py-4 bg-orange-50 hover:bg-orange-100 transition-colors group">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-orange-100 group-hover:bg-orange-200 transition-colors">
                      <Receipt className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-orange-900">Registrar Movimentação</h3>
                      <p className="text-sm text-orange-600">Adicionar entrada ou saída</p>
                    </div>
                  </div>
                  <ChevronDown className="h-5 w-5 text-orange-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="px-6 pb-6 pt-4 border-t border-orange-200 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-orange-800">Tipo</Label>
                      <Select value={movementType} onValueChange={setMovementType}>
                        <SelectTrigger className="border-orange-200 focus:ring-orange-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="entrada">
                            <span className="flex items-center gap-2">
                              <TrendingUp className="h-4 w-4 text-orange-500" />
                              Entrada
                            </span>
                          </SelectItem>
                          <SelectItem value="saida">
                            <span className="flex items-center gap-2">
                              <TrendingDown className="h-4 w-4 text-orange-700" />
                              Saída
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-orange-800">Valor (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={movementAmount}
                        onChange={(e) => setMovementAmount(e.target.value)}
                        placeholder="0.00"
                        className="border-orange-200 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <Label className="text-orange-800">Forma de Pagamento</Label>
                      <Select value={movementPaymentMethod} onValueChange={setMovementPaymentMethod}>
                        <SelectTrigger className="border-orange-200 focus:ring-orange-500">
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
                      <Label className="text-orange-800">Descrição</Label>
                      <Input
                        value={movementDescription}
                        onChange={(e) => setMovementDescription(e.target.value)}
                        placeholder="Descrição da movimentação"
                        className="border-orange-200 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <Label className="text-orange-800">Categoria (opcional)</Label>
                      <Input
                        value={movementCategory}
                        onChange={(e) => setMovementCategory(e.target.value)}
                        placeholder="Ex: Alimentação, Limpeza..."
                        className="border-orange-200 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <Label className="text-orange-800">Responsável</Label>
                      <Input
                        value={movementCreatedBy}
                        onChange={(e) => setMovementCreatedBy(e.target.value)}
                        placeholder="Nome do responsável"
                        className="border-orange-200 focus:ring-orange-500"
                      />
                    </div>
                  </div>
                  <Button onClick={handleAddMovement} className="w-full mt-4 bg-orange-500 hover:bg-orange-600">
                    {movementType === "entrada" ? (
                      <PlusCircle className="h-4 w-4 mr-2" />
                    ) : (
                      <MinusCircle className="h-4 w-4 mr-2" />
                    )}
                    Registrar Movimentação
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Histórico de Movimentações */}
          <Card className="border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-800">Histórico de Movimentações</CardTitle>
              <CardDescription>
                {currentSession 
                  ? `${movements.length} movimentações registradas nesta sessão`
                  : lastClosedSession 
                    ? `${movements.length} movimentações do último caixa`
                    : "Nenhuma movimentação"
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {movements.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma movimentação registrada
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {movements.map((mov) => (
                    <div
                      key={mov.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border",
                        mov.movement_type === "entrada" 
                          ? "bg-orange-50 border-orange-200" 
                          : "bg-amber-50 border-amber-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {mov.movement_type === "entrada" ? (
                          <TrendingUp className="h-5 w-5 text-orange-500" />
                        ) : (
                          <TrendingDown className="h-5 w-5 text-orange-700" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{mov.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {mov.category && `${mov.category} • `}
                            {mov.payment_method} • {mov.created_by} • {format(new Date(mov.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                      <span className={cn(
                        "font-bold",
                        mov.movement_type === "entrada" ? "text-orange-600" : "text-orange-800"
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
          <Card className="border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <CalendarIcon className="h-5 w-5 text-orange-500" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["today", "yesterday", "7days", "thisMonth", "lastMonth"].map((filter) => (
                  <Button
                    key={filter}
                    variant={dateFilter === filter ? "default" : "outline"}
                    onClick={() => setDateFilter(filter)}
                    className={dateFilter === filter ? "bg-orange-500 hover:bg-orange-600" : "border-orange-200 text-orange-700 hover:bg-orange-50"}
                  >
                    {filter === "today" && "Hoje"}
                    {filter === "yesterday" && "Ontem"}
                    {filter === "7days" && "Últimos 7 Dias"}
                    {filter === "thisMonth" && "Este Mês"}
                    {filter === "lastMonth" && "Mês Passado"}
                  </Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === "custom" ? "default" : "outline"}
                      className={cn(
                        "justify-start text-left font-normal",
                        dateFilter === "custom" ? "bg-orange-500 hover:bg-orange-600" : "border-orange-200 text-orange-700 hover:bg-orange-50"
                      )}
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

          {/* Cards de Receitas e Despesas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                  Receitas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <span className="font-medium text-orange-800">Total de Receitas</span>
                    <span className="text-2xl font-bold text-orange-600">
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
                    <p className="text-sm font-medium text-orange-700">Por tipo de entrada:</p>
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
                        <div key={category} className="flex justify-between p-2 border-l-2 border-orange-400 pl-4 bg-orange-50/50">
                          <span className="text-orange-800">{category}</span>
                          <span className="font-medium text-orange-600">R$ {total.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <TrendingDown className="h-5 w-5 text-amber-600" />
                  Despesas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="font-medium text-amber-800">Total de Despesas</span>
                    <span className="text-2xl font-bold text-orange-700">
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
                    <p className="text-sm font-medium text-amber-700">Por tipo de despesa:</p>
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
                        <div key={category} className="flex justify-between p-2 border-l-2 border-amber-500 pl-4 bg-amber-50/50">
                          <span className="text-amber-800">{category}</span>
                          <span className="font-medium text-orange-700">R$ {total.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dre" className="space-y-4 mt-4">
          {/* Filtro de data DRE */}
          <Card className="border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <CalendarIcon className="h-5 w-5 text-orange-500" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {["today", "yesterday", "7days", "thisMonth", "lastMonth"].map((filter) => (
                  <Button
                    key={filter}
                    variant={dateFilter === filter ? "default" : "outline"}
                    onClick={() => setDateFilter(filter)}
                    className={dateFilter === filter ? "bg-orange-500 hover:bg-orange-600" : "border-orange-200 text-orange-700 hover:bg-orange-50"}
                  >
                    {filter === "today" && "Hoje"}
                    {filter === "yesterday" && "Ontem"}
                    {filter === "7days" && "Últimos 7 Dias"}
                    {filter === "thisMonth" && "Este Mês"}
                    {filter === "lastMonth" && "Mês Passado"}
                  </Button>
                ))}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={dateFilter === "custom" ? "default" : "outline"}
                      className={cn(
                        "justify-start text-left font-normal",
                        dateFilter === "custom" ? "bg-orange-500 hover:bg-orange-600" : "border-orange-200 text-orange-700 hover:bg-orange-50"
                      )}
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

          {/* DRE */}
          <Card className="border-orange-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <FileText className="h-5 w-5 text-orange-500" />
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
              <div className="space-y-4">
                {/* Receitas */}
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg border-l-4 border-orange-500">
                  <div>
                    <p className="text-sm text-orange-700 font-medium">RECEITA BRUTA</p>
                    <p className="text-xs text-orange-600">Todas as entradas do período</p>
                  </div>
                  <span className="font-bold text-2xl text-orange-600">R$ {dreData.salesTotal.toFixed(2)}</span>
                </div>

                {/* CMV */}
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-lg border-l-4 border-amber-500">
                  <div>
                    <p className="text-sm text-amber-700 font-medium">(-) CMV - CUSTO DE MERCADORIAS VENDIDAS</p>
                    <p className="text-xs text-amber-600">Custo dos insumos utilizados</p>
                  </div>
                  <span className="font-bold text-xl text-orange-700">R$ {dreData.cmv.toFixed(2)}</span>
                </div>

                {/* Lucro Bruto */}
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-orange-100 to-orange-200 rounded-lg border-l-4 border-orange-400">
                  <div>
                    <p className="text-sm text-orange-800 font-medium">(=) LUCRO BRUTO</p>
                    <p className="text-xs text-orange-600">Receita - CMV | Margem: {dreData.grossMargin.toFixed(1)}%</p>
                  </div>
                  <span className="font-bold text-2xl text-orange-700">R$ {dreData.grossProfit.toFixed(2)}</span>
                </div>

                {/* Despesas Operacionais */}
                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-amber-100 to-amber-200 rounded-lg border-l-4 border-amber-600">
                  <div>
                    <p className="text-sm text-amber-800 font-medium">(-) DESPESAS OPERACIONAIS</p>
                    <p className="text-xs text-amber-600">Todas as saídas registradas</p>
                  </div>
                  <span className="font-bold text-xl text-orange-800">R$ {dreData.operationalExpenses.toFixed(2)}</span>
                </div>

                {/* Separador */}
                <div className="border-t-2 border-dashed border-orange-300"></div>

                {/* Despesas Totais */}
                <div className="flex justify-between items-center p-3 bg-orange-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-orange-800">TOTAL DE DESPESAS</p>
                    <p className="text-xs text-orange-600">CMV + Despesas Operacionais</p>
                  </div>
                  <span className="font-bold text-lg text-orange-700">R$ {dreData.totalExpenses.toFixed(2)}</span>
                </div>

                {/* Separador Final */}
                <div className="border-t-4 border-orange-500"></div>

                {/* Lucro Líquido */}
                <div className={cn(
                  "flex justify-between items-center p-5 rounded-lg border-l-4 shadow-md",
                  dreData.netProfit >= 0 
                    ? "bg-gradient-to-r from-orange-100 to-orange-200 border-orange-500" 
                    : "bg-gradient-to-r from-red-50 to-red-100 border-red-500"
                )}>
                  <div>
                    <p className={cn(
                      "text-base font-bold",
                      dreData.netProfit >= 0 ? "text-orange-900" : "text-red-900"
                    )}>(=) LUCRO LÍQUIDO</p>
                    <p className={cn(
                      "text-xs",
                      dreData.netProfit >= 0 ? "text-orange-600" : "text-red-600"
                    )}>Receita Bruta - Total de Despesas</p>
                  </div>
                  <span className={cn(
                    "font-bold text-3xl",
                    dreData.netProfit >= 0 ? "text-orange-600" : "text-red-600"
                  )}>R$ {dreData.netProfit.toFixed(2)}</span>
                </div>
                
                {/* Margens */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <span className="text-xs text-orange-600">Margem Bruta</span>
                    <span className="font-bold text-xl text-orange-700">{dreData.grossMargin.toFixed(1)}%</span>
                  </div>
                  <div className={cn(
                    "flex flex-col p-3 rounded-lg border",
                    dreData.netMargin >= 0 
                      ? "bg-orange-100 border-orange-200" 
                      : "bg-red-50 border-red-200"
                  )}>
                    <span className={cn(
                      "text-xs",
                      dreData.netMargin >= 0 ? "text-orange-600" : "text-red-600"
                    )}>Margem Líquida</span>
                    <span className={cn(
                      "font-bold text-xl",
                      dreData.netMargin >= 0 ? "text-orange-700" : "text-red-600"
                    )}>{dreData.netMargin.toFixed(1)}%</span>
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
