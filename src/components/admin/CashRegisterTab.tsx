import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Smartphone, Banknote, Plus, DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePaymentFormat } from "@/hooks/usePaymentFormat";

interface CashSession {
  id: string;
  opened_at: string;
  closed_at: string | null;
  opened_by: string;
  closed_by: string | null;
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
  payment_method: string | null;
  category: string | null;
  description: string;
  created_by: string;
  created_at: string;
  bill_id: string | null;
}

const CashRegisterTab = ({ restaurantId }: { restaurantId: string }) => {
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [movementType, setMovementType] = useState<"income" | "expense">("income");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementPaymentMethod, setMovementPaymentMethod] = useState<string>("cash");
  const [movementCategory, setMovementCategory] = useState("");
  const [movementDescription, setMovementDescription] = useState("");
  const { getPaymentIcon, getPaymentLabel } = usePaymentFormat();

  useEffect(() => {
    fetchCurrentSession();
  }, [restaurantId]);

  const fetchCurrentSession = async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase
        .from("cash_register_sessions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setCurrentSession(session);

      if (session) {
        fetchMovements(session.id);
      }
    } catch (error) {
      console.error("Erro ao buscar sessão de caixa:", error);
      toast.error("Erro ao carregar caixa");
    } finally {
      setLoading(false);
    }
  };

  const fetchMovements = async (sessionId: string) => {
    try {
      const { data } = await supabase
        .from("cash_movements")
        .select("*")
        .eq("cash_session_id", sessionId)
        .order("created_at", { ascending: false });

      setMovements(data || []);
    } catch (error) {
      console.error("Erro ao buscar movimentações:", error);
    }
  };

  const handleOpenCashRegister = async () => {
    const username = sessionStorage.getItem("username") || "Usuário";
    
    try {
      const { data, error } = await supabase
        .from("cash_register_sessions")
        .insert({
          restaurant_id: restaurantId,
          opened_by: username,
          opening_balance: parseFloat(openingBalance) || 0,
          notes: openingNotes,
          status: "open",
        })
        .select()
        .single();

      if (error) throw error;

      setCurrentSession(data);
      setIsOpenDialogOpen(false);
      setOpeningBalance("0");
      setOpeningNotes("");
      toast.success("Caixa aberto com sucesso!");
    } catch (error) {
      console.error("Erro ao abrir caixa:", error);
      toast.error("Erro ao abrir caixa");
    }
  };

  const handleCloseCashRegister = async () => {
    if (!currentSession) return;

    const username = sessionStorage.getItem("username") || "Usuário";
    const totalMovements = movements.reduce((sum, mov) => {
      return sum + (mov.movement_type === "income" ? mov.amount : -mov.amount);
    }, 0);
    const expectedBalance = currentSession.opening_balance + totalMovements;

    try {
      const { error } = await supabase
        .from("cash_register_sessions")
        .update({
          status: "closed",
          closed_at: new Date().toISOString(),
          closed_by: username,
          expected_balance: expectedBalance,
          notes: closingNotes || currentSession.notes,
        })
        .eq("id", currentSession.id);

      if (error) throw error;

      setCurrentSession(null);
      setMovements([]);
      setClosingNotes("");
      toast.success("Caixa fechado com sucesso!");
    } catch (error) {
      console.error("Erro ao fechar caixa:", error);
      toast.error("Erro ao fechar caixa");
    }
  };

  const handleAddMovement = async () => {
    if (!currentSession) return;

    const username = sessionStorage.getItem("username") || "Usuário";

    try {
      const { error } = await supabase
        .from("cash_movements")
        .insert({
          cash_session_id: currentSession.id,
          restaurant_id: restaurantId,
          movement_type: movementType,
          amount: parseFloat(movementAmount),
          payment_method: movementPaymentMethod,
          category: movementCategory || null,
          description: movementDescription,
          created_by: username,
        });

      if (error) throw error;

      fetchMovements(currentSession.id);
      setIsMovementDialogOpen(false);
      setMovementAmount("");
      setMovementCategory("");
      setMovementDescription("");
      toast.success("Movimentação adicionada!");
    } catch (error) {
      console.error("Erro ao adicionar movimentação:", error);
      toast.error("Erro ao adicionar movimentação");
    }
  };

  const getTotalBalance = () => {
    if (!currentSession) return 0;
    const movementsTotal = movements.reduce((sum, mov) => {
      return sum + (mov.movement_type === "income" ? mov.amount : -mov.amount);
    }, 0);
    return currentSession.opening_balance + movementsTotal;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando caixa...</p>
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Caixa Fechado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">Nenhum caixa aberto no momento.</p>
            <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
              <DialogTrigger asChild>
                <Button>Abrir Caixa</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abrir Caixa</DialogTitle>
                  <DialogDescription>Informe o saldo inicial e observações para abrir o caixa.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="opening-balance">Saldo Inicial (R$)</Label>
                    <Input
                      id="opening-balance"
                      type="number"
                      step="0.01"
                      value={openingBalance}
                      onChange={(e) => setOpeningBalance(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="opening-notes">Observações</Label>
                    <Textarea
                      id="opening-notes"
                      value={openingNotes}
                      onChange={(e) => setOpeningNotes(e.target.value)}
                      placeholder="Observações sobre a abertura do caixa..."
                    />
                  </div>
                  <Button onClick={handleOpenCashRegister} className="w-full">
                    Confirmar Abertura
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Inicial</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ {currentSession.opening_balance.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Atual</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">R$ {getTotalBalance().toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimentações</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movements.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Movimentações</CardTitle>
          <div className="flex gap-2">
            <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Movimentação
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Nova Movimentação</DialogTitle>
                  <DialogDescription>Cadastre uma entrada ou saída do caixa do dia.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Tipo</Label>
                    <Select value={movementType} onValueChange={(v: any) => setMovementType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Entrada</SelectItem>
                        <SelectItem value="expense">Saída</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Método de Pagamento</Label>
                    <Select value={movementPaymentMethod} onValueChange={setMovementPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="card">Cartão</SelectItem>
                        <SelectItem value="pix">PIX</SelectItem>
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
                    <Label>Categoria</Label>
                    <Input
                      value={movementCategory}
                      onChange={(e) => setMovementCategory(e.target.value)}
                      placeholder="Ex: Fornecedor, Taxa, etc"
                    />
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Textarea
                      value={movementDescription}
                      onChange={(e) => setMovementDescription(e.target.value)}
                      placeholder="Descrição da movimentação..."
                    />
                  </div>
                  <Button onClick={handleAddMovement} className="w-full">
                    Adicionar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="destructive" onClick={handleCloseCashRegister}>
              Fechar Caixa
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => {
                const PaymentIcon = getPaymentIcon(movement.payment_method || "");
                return (
                  <TableRow key={movement.id}>
                    <TableCell className="text-sm">
                      {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={movement.movement_type === "income" ? "default" : "destructive"}>
                        {movement.movement_type === "income" ? "Entrada" : "Saída"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {PaymentIcon && <PaymentIcon className="h-4 w-4" />}
                        {getPaymentLabel(movement.payment_method || "")}
                      </div>
                    </TableCell>
                    <TableCell>{movement.category || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate">{movement.description}</TableCell>
                    <TableCell className={`text-right font-semibold ${
                      movement.movement_type === "income" ? "text-primary" : "text-destructive"
                    }`}>
                      {movement.movement_type === "income" ? "+" : "-"}R$ {movement.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {movements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma movimentação registrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CashRegisterTab;