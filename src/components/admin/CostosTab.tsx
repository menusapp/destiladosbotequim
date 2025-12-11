import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Building2, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CostosTabProps {
  restaurantId: string;
}

interface FixedCost {
  id: string;
  name: string;
  description: string | null;
  amount: number;
}

interface VariableCost {
  id: string;
  name: string;
  description: string | null;
  amount: number | null;
  percentage: number | null;
  type: 'fixed' | 'percentage';
}

interface LaborCost {
  id: string;
  employee_name: string;
  role: string | null;
  salary: number;
}

export default function CostosTab({ restaurantId }: CostosTabProps) {
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCost[]>([]);

  // Dialog states
  const [fixedDialogOpen, setFixedDialogOpen] = useState(false);
  const [variableDialogOpen, setVariableDialogOpen] = useState(false);
  const [laborDialogOpen, setLaborDialogOpen] = useState(false);

  // Form states
  const [newFixedCost, setNewFixedCost] = useState({ name: '', description: '', amount: '' });
  const [newVariableCost, setNewVariableCost] = useState({ name: '', description: '', value: '', type: 'fixed' as 'fixed' | 'percentage' });
  const [newLaborCost, setNewLaborCost] = useState({ employee_name: '', role: '', salary: '' });

  useEffect(() => {
    fetchAllCosts();
  }, [restaurantId]);

  const fetchAllCosts = async () => {
    await Promise.all([
      fetchFixedCosts(),
      fetchVariableCosts(),
      fetchLaborCosts()
    ]);
  };

  const fetchFixedCosts = async () => {
    const { data, error } = await supabase
      .from('fixed_costs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching fixed costs:', error);
      return;
    }
    setFixedCosts(data || []);
  };

  const fetchVariableCosts = async () => {
    const { data, error } = await supabase
      .from('variable_costs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching variable costs:', error);
      return;
    }
    setVariableCosts((data || []) as VariableCost[]);
  };

  const fetchLaborCosts = async () => {
    const { data, error } = await supabase
      .from('labor_costs')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching labor costs:', error);
      return;
    }
    setLaborCosts(data || []);
  };

  const handleAddFixedCost = async () => {
    if (!newFixedCost.name || !newFixedCost.amount) {
      toast.error('Preencha nome e valor');
      return;
    }

    const { error } = await supabase
      .from('fixed_costs')
      .insert({
        restaurant_id: restaurantId,
        name: newFixedCost.name,
        description: newFixedCost.description || null,
        amount: parseFloat(newFixedCost.amount)
      });

    if (error) {
      toast.error('Erro ao adicionar custo fixo');
      console.error(error);
      return;
    }

    toast.success('Custo fixo adicionado!');
    setNewFixedCost({ name: '', description: '', amount: '' });
    setFixedDialogOpen(false);
    fetchFixedCosts();
  };

  const handleDeleteFixedCost = async (id: string) => {
    const { error } = await supabase
      .from('fixed_costs')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir custo');
      return;
    }

    toast.success('Custo excluído!');
    fetchFixedCosts();
  };

  const handleAddVariableCost = async () => {
    if (!newVariableCost.name || !newVariableCost.value) {
      toast.error('Preencha nome e valor');
      return;
    }

    const insertData: any = {
      restaurant_id: restaurantId,
      name: newVariableCost.name,
      description: newVariableCost.description || null,
      type: newVariableCost.type
    };

    if (newVariableCost.type === 'fixed') {
      insertData.amount = parseFloat(newVariableCost.value);
      insertData.percentage = null;
    } else {
      insertData.percentage = parseFloat(newVariableCost.value);
      insertData.amount = null;
    }

    const { error } = await supabase
      .from('variable_costs')
      .insert(insertData);

    if (error) {
      toast.error('Erro ao adicionar custo variável');
      console.error(error);
      return;
    }

    toast.success('Custo variável adicionado!');
    setNewVariableCost({ name: '', description: '', value: '', type: 'fixed' });
    setVariableDialogOpen(false);
    fetchVariableCosts();
  };

  const handleDeleteVariableCost = async (id: string) => {
    const { error } = await supabase
      .from('variable_costs')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir custo');
      return;
    }

    toast.success('Custo excluído!');
    fetchVariableCosts();
  };

  const handleAddLaborCost = async () => {
    if (!newLaborCost.employee_name || !newLaborCost.salary) {
      toast.error('Preencha nome e salário');
      return;
    }

    const { error } = await supabase
      .from('labor_costs')
      .insert({
        restaurant_id: restaurantId,
        employee_name: newLaborCost.employee_name,
        role: newLaborCost.role || null,
        salary: parseFloat(newLaborCost.salary)
      });

    if (error) {
      toast.error('Erro ao adicionar funcionário');
      console.error(error);
      return;
    }

    toast.success('Funcionário adicionado!');
    setNewLaborCost({ employee_name: '', role: '', salary: '' });
    setLaborDialogOpen(false);
    fetchLaborCosts();
  };

  const handleDeleteLaborCost = async (id: string) => {
    const { error } = await supabase
      .from('labor_costs')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir funcionário');
      return;
    }

    toast.success('Funcionário excluído!');
    fetchLaborCosts();
  };

  // Calculate totals
  const fixedTotal = fixedCosts.reduce((sum, cost) => sum + cost.amount, 0);
  const variableFixedTotal = variableCosts
    .filter(c => c.type === 'fixed')
    .reduce((sum, cost) => sum + (cost.amount || 0), 0);
  const laborTotal = laborCosts.reduce((sum, cost) => sum + cost.salary, 0);
  const totalMensal = fixedTotal + variableFixedTotal + laborTotal;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Gestão de Custos</h2>
        <p className="text-muted-foreground">Gerencie todos os custos operacionais do seu restaurante</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Custos Operacionais Mensais</CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Custos Fixos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Custos Fixos</span>
                <span className="text-xs text-muted-foreground">(Aluguel, internet, etc.)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-orange-600">
                  R$ {fixedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <Dialog open={fixedDialogOpen} onOpenChange={setFixedDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Custo Fixo</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nome do Custo *</Label>
                        <Input
                          placeholder="Ex: Aluguel"
                          value={newFixedCost.name}
                          onChange={(e) => setNewFixedCost({ ...newFixedCost, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input
                          placeholder="Detalhes adicionais"
                          value={newFixedCost.description}
                          onChange={(e) => setNewFixedCost({ ...newFixedCost, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Valor Mensal (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={newFixedCost.amount}
                          onChange={(e) => setNewFixedCost({ ...newFixedCost, amount: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddFixedCost} className="w-full">
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {fixedCosts.length > 0 && (
              <div className="rounded-lg border bg-muted/30 divide-y divide-border">
                {fixedCosts.map((cost) => (
                  <div key={cost.id} className="flex items-center justify-between px-3 py-2 group hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cost.name}</p>
                      {cost.description && (
                        <p className="text-xs text-muted-foreground truncate">{cost.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        R$ {cost.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteFixedCost(cost.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Custos Variáveis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Custos Variáveis</span>
                <span className="text-xs text-muted-foreground">(Valores fixos ou % sobre vendas)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-orange-600">
                  R$ {variableFixedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {variableCosts.some(c => c.type === 'percentage') && ' + %'}
                </span>
                <Dialog open={variableDialogOpen} onOpenChange={setVariableDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Custo Variável</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nome do Custo *</Label>
                        <Input
                          placeholder="Ex: Energia"
                          value={newVariableCost.name}
                          onChange={(e) => setNewVariableCost({ ...newVariableCost, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Descrição (opcional)</Label>
                        <Input
                          placeholder="Detalhes adicionais"
                          value={newVariableCost.description}
                          onChange={(e) => setNewVariableCost({ ...newVariableCost, description: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Tipo de Custo</Label>
                        <Select
                          value={newVariableCost.type}
                          onValueChange={(value: 'fixed' | 'percentage') => setNewVariableCost({ ...newVariableCost, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Valor Mensal Fixo (R$)</SelectItem>
                            <SelectItem value="percentage">Percentual sobre Vendas (%)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{newVariableCost.type === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={newVariableCost.value}
                          onChange={(e) => setNewVariableCost({ ...newVariableCost, value: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddVariableCost} className="w-full">
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {variableCosts.length > 0 && (
              <div className="rounded-lg border bg-muted/30 divide-y divide-border">
                {variableCosts.map((cost) => (
                  <div key={cost.id} className="flex items-center justify-between px-3 py-2 group hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cost.name}</p>
                      {cost.description && (
                        <p className="text-xs text-muted-foreground truncate">{cost.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        {cost.type === 'percentage' 
                          ? `${cost.percentage}%` 
                          : `R$ ${cost.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        }
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteVariableCost(cost.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* CMO - Mão de Obra */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Mão de Obra (CMO)</span>
                <span className="text-xs text-muted-foreground">(Salários mensais)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-orange-600">
                  R$ {laborTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <Dialog open={laborDialogOpen} onOpenChange={setLaborDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-7 px-2">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Funcionário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label>Nome do Funcionário *</Label>
                        <Input
                          placeholder="Ex: João Silva"
                          value={newLaborCost.employee_name}
                          onChange={(e) => setNewLaborCost({ ...newLaborCost, employee_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Função (opcional)</Label>
                        <Input
                          placeholder="Ex: Cozinheiro"
                          value={newLaborCost.role}
                          onChange={(e) => setNewLaborCost({ ...newLaborCost, role: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Salário Mensal (R$) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0,00"
                          value={newLaborCost.salary}
                          onChange={(e) => setNewLaborCost({ ...newLaborCost, salary: e.target.value })}
                        />
                      </div>
                      <Button onClick={handleAddLaborCost} className="w-full">
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {laborCosts.length > 0 && (
              <div className="rounded-lg border bg-muted/30 divide-y divide-border">
                {laborCosts.map((cost) => (
                  <div key={cost.id} className="flex items-center justify-between px-3 py-2 group hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{cost.employee_name}</p>
                      {cost.role && (
                        <p className="text-xs text-muted-foreground truncate">{cost.role}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-sm font-medium whitespace-nowrap">
                        R$ {cost.salary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteLaborCost(cost.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="bg-orange-50 dark:bg-orange-950/20 border-t mt-4">
          <div className="w-full flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Mensal Fixo</p>
              <p className="text-xs text-muted-foreground">
                (Custos variáveis em % são calculados sobre vendas no DRE)
              </p>
            </div>
            <p className="text-2xl font-bold text-orange-600">
              R$ {totalMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
