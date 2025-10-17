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
import { toast } from "sonner";
import { DollarSign, TrendingUp, TrendingDown, Wallet, FileText, Calendar, PlusCircle, MinusCircle } from "lucide-react";
import { format } from "date-fns";

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
  movement_type: string;
  amount: number;
  description: string;
  category: string | null;
  payment_method: string | null;
  created_by: string;
  created_at: string;
}

export default function CashRegisterTab({ restaurantId }: CashRegisterTabProps) {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [allMovements, setAllMovements] = useState<CashMovement[]>([]);
  const [bills, setBills] = useState<any[]>([]);
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
  const [startDate, setStartDate] = useState(format(new Date(new Date().setDate(1)), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  useEffect(() => {
    fetchCurrentSession();
    fetchAllMovements();
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

  const fetchAllMovements = async () => {
    try {
      // Buscar apenas movimentações de sessões fechadas
      const { data: closedSessions, error: sessionsError } = await supabase
        .from("cash_register_sessions")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("status", "closed");

      if (sessionsError) throw sessionsError;

      if (!closedSessions || closedSessions.length === 0) {
        setAllMovements([]);
        return;
      }

      const sessionIds = closedSessions.map(s => s.id);

      const { data, error } = await supabase
        .from("cash_movements")
        .select("*")
        .in("cash_session_id", sessionIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAllMovements(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar movimentações de sessões fechadas:", error);
    }
  };

  const fetchBills = async () => {
    try {
      const { data, error } = await supabase
        .from("bills")
        .select(`
          *,
          tables:tables(table_number),
          orders:orders(
            customer_name,
            order_items:order_items(
              quantity,
              price_at_order,
              order_item_extras:order_item_extras(price_at_order)
            )
          )
        `)
        .eq("tables.restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBills(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar contas:", error);
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
      fetchAllMovements();
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
      if (mov.movement_type === "entrada" || mov.movement_type === "venda" || mov.movement_type === "suprimento") {
        balance += mov.amount;
      } else {
        balance -= mov.amount;
      }
    });

    return balance;
  };

  const calculateTotalSales = () => {
    return movements
      .filter(m => m.category === "venda")
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const calculateTotalExpenses = () => {
    return movements
      .filter(m => m.movement_type === "saida" || m.movement_type === "despesa" || m.movement_type === "sangria")
      .reduce((sum, m) => sum + m.amount, 0);
  };

  const generateDRE = () => {
    const salesTotal = allMovements
      .filter(m => {
        const movDate = new Date(m.created_at);
        return movDate >= new Date(startDate) && movDate <= new Date(endDate) && m.category === "venda";
      })
      .reduce((sum, m) => sum + m.amount, 0);

    const expenses = allMovements
      .filter(m => {
        const movDate = new Date(m.created_at);
        return movDate >= new Date(startDate) && movDate <= new Date(endDate) && 
               (m.movement_type === "despesa" || m.movement_type === "saida");
      })
      .reduce((sum, m) => sum + m.amount, 0);

    const profit = salesTotal - expenses;
    const margin = salesTotal > 0 ? (profit / salesTotal) * 100 : 0;

    return { salesTotal, expenses, profit, margin };
  };

  const dre = generateDRE();

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
                        <SelectItem value="venda">Venda</SelectItem>
                        <SelectItem value="sangria">Sangria</SelectItem>
                        <SelectItem value="suprimento">Suprimento</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
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
                  {movementType === "entrada" || movementType === "venda" || movementType === "suprimento" ? (
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
                        {mov.movement_type === "entrada" || mov.movement_type === "venda" || mov.movement_type === "suprimento" ? (
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
                        mov.movement_type === "entrada" || mov.movement_type === "venda" || mov.movement_type === "suprimento"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}>
                        {mov.movement_type === "entrada" || mov.movement_type === "venda" || mov.movement_type === "suprimento" ? "+" : "-"}
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
                <Calendar className="h-5 w-5" />
                Período de Análise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
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
                    <span className="font-medium">Total de Vendas</span>
                    <span className="text-2xl font-bold text-green-600">
                      R$ {allMovements
                        .filter(m => {
                          const movDate = new Date(m.created_at);
                          return movDate >= new Date(startDate) && movDate <= new Date(endDate) && m.category === "venda";
                        })
                        .reduce((sum, m) => sum + m.amount, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Por forma de pagamento:</p>
                    {Array.from(new Set(
                      allMovements
                        .filter(m => {
                          const d = new Date(m.created_at);
                          return d >= new Date(startDate) && d <= new Date(endDate) && m.category === "venda" && m.payment_method;
                        })
                        .map(m => m.payment_method as string)
                    )).map(method => {
                      const total = allMovements
                        .filter(m => {
                          const d = new Date(m.created_at);
                          return d >= new Date(startDate) && d <= new Date(endDate) && m.category === "venda" && m.payment_method === method;
                        })
                        .reduce((sum, m) => sum + m.amount, 0);
                      
                      if (total === 0) return null;
                      
                      return (
                        <div key={method} className="flex justify-between p-2 border-l-2 border-green-500 pl-4">
                          <span className="capitalize">{method}</span>
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
                      R$ {allMovements
                        .filter(m => {
                          const movDate = new Date(m.created_at);
                          return movDate >= new Date(startDate) && 
                                 movDate <= new Date(endDate) && 
                                 (m.movement_type === "despesa" || m.movement_type === "saida");
                        })
                        .reduce((sum, m) => sum + m.amount, 0)
                        .toFixed(2)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Por categoria:</p>
                    {Array.from(new Set(
                      allMovements
                        .filter(m => {
                          const movDate = new Date(m.created_at);
                          return movDate >= new Date(startDate) && 
                                 movDate <= new Date(endDate) && 
                                 (m.movement_type === "despesa" || m.movement_type === "saida") &&
                                 m.category;
                        })
                        .map(m => m.category)
                    )).map(category => {
                      const total = allMovements
                        .filter(m => {
                          const movDate = new Date(m.created_at);
                          return movDate >= new Date(startDate) && 
                                 movDate <= new Date(endDate) && 
                                 (m.movement_type === "despesa" || m.movement_type === "saida") &&
                                 m.category === category;
                        })
                        .reduce((sum, m) => sum + m.amount, 0);
                      
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
                <FileText className="h-5 w-5" />
                Demonstração do Resultado do Exercício (DRE)
              </CardTitle>
              <CardDescription>
                Período: {format(new Date(startDate), "dd/MM/yyyy")} a {format(new Date(endDate), "dd/MM/yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between p-4 bg-blue-50 rounded-lg">
                    <span className="font-bold text-lg">Receita Bruta</span>
                    <span className="font-bold text-lg text-blue-600">R$ {dre.salesTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-2 pl-4 border-l-4 border-gray-300">
                  <div className="flex justify-between p-3">
                    <span className="text-red-600">(-) Despesas Operacionais</span>
                    <span className="text-red-600 font-medium">R$ {dre.expenses.toFixed(2)}</span>
                  </div>
                </div>

                <div className="h-px bg-gray-300" />

                <div className={`flex justify-between p-4 rounded-lg ${
                  dre.profit >= 0 ? "bg-green-50" : "bg-red-50"
                }`}>
                  <span className="font-bold text-xl">Lucro Líquido</span>
                  <span className={`font-bold text-xl ${
                    dre.profit >= 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    R$ {dre.profit.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between p-4 bg-purple-50 rounded-lg">
                  <span className="font-bold">Margem de Lucro</span>
                  <span className="font-bold text-purple-600">{dre.margin.toFixed(2)}%</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Total de Vendas</p>
                        <p className="text-2xl font-bold">
                          {allMovements.filter(m => {
                            const d = new Date(m.created_at);
                            return d >= new Date(startDate) && d <= new Date(endDate) && m.category === "venda";
                          }).length}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Ticket Médio</p>
                        <p className="text-2xl font-bold">
                          R$ {(dre.salesTotal / Math.max(allMovements.filter(m => {
                            const d = new Date(m.created_at);
                            return d >= new Date(startDate) && d <= new Date(endDate) && m.category === "venda";
                          }).length, 1)).toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">Taxa de Conversão</p>
                        <p className="text-2xl font-bold">
                          {((allMovements.filter(m => {
                            const d = new Date(m.created_at);
                            return d >= new Date(startDate) && d <= new Date(endDate) && m.category === "venda";
                          }).length / Math.max(allMovements.filter(m => {
                            const d = new Date(m.created_at);
                            return d >= new Date(startDate) && d <= new Date(endDate);
                          }).length, 1)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}