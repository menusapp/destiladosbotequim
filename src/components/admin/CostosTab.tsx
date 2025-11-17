import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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


  return (
    <div className="space-y-6">
      {/* Custos Fixos */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Custos Fixos Mensais</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Custos mensais fixos (aluguel, internet, etc.)
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 transition-transform" />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Nome do Custo</Label>
                  <Input
                    placeholder="Ex: Aluguel"
                    value={newFixedCost.name}
                    onChange={(e) => setNewFixedCost({ ...newFixedCost, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Detalhes"
                    value={newFixedCost.description}
                    onChange={(e) => setNewFixedCost({ ...newFixedCost, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Valor Mensal (R$)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newFixedCost.amount}
                      onChange={(e) => setNewFixedCost({ ...newFixedCost, amount: e.target.value })}
                    />
                    <Button onClick={handleAddFixedCost}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {fixedCosts.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                  {fixedCosts.map((cost) => (
                    <div key={cost.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{cost.name}</p>
                        {cost.description && <p className="text-sm text-muted-foreground">{cost.description}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">R$ {cost.amount.toFixed(2)}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteFixedCost(cost.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Custos Variáveis */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Custos Variáveis</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Valores mensais fixos ou % sobre vendas
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 transition-transform" />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label>Nome do Custo</Label>
                  <Input
                    placeholder="Ex: Energia"
                    value={newVariableCost.name}
                    onChange={(e) => setNewVariableCost({ ...newVariableCost, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Input
                    placeholder="Detalhes"
                    value={newVariableCost.description}
                    onChange={(e) => setNewVariableCost({ ...newVariableCost, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select
                    value={newVariableCost.type}
                    onValueChange={(value: 'fixed' | 'percentage') => setNewVariableCost({ ...newVariableCost, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Valor Mensal (R$)</SelectItem>
                      <SelectItem value="percentage">% sobre Vendas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{newVariableCost.type === 'percentage' ? 'Percentual (%)' : 'Valor Mensal (R$)'}</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder={newVariableCost.type === 'percentage' ? '0.00' : '0.00'}
                      value={newVariableCost.value}
                      onChange={(e) => setNewVariableCost({ ...newVariableCost, value: e.target.value })}
                    />
                    <Button onClick={handleAddVariableCost}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {variableCosts.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                  {variableCosts.map((cost) => (
                    <div key={cost.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{cost.name}</p>
                        {cost.description && <p className="text-sm text-muted-foreground">{cost.description}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">
                          {cost.type === 'percentage' ? `${cost.percentage}%` : `R$ ${cost.amount?.toFixed(2)}`}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteVariableCost(cost.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* CMO - Custo de Mão de Obra */}
      <Collapsible defaultOpen={false}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>CMO - Custo de Mão de Obra Mensal</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Salários mensais dos funcionários
                  </p>
                </div>
                <ChevronDown className="h-5 w-5 transition-transform" />
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>Nome do Funcionário</Label>
                  <Input
                    placeholder="Ex: João Silva"
                    value={newLaborCost.employee_name}
                    onChange={(e) => setNewLaborCost({ ...newLaborCost, employee_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Função (opcional)</Label>
                  <Input
                    placeholder="Ex: Cozinheiro"
                    value={newLaborCost.role}
                    onChange={(e) => setNewLaborCost({ ...newLaborCost, role: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Salário Mensal (R$)</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newLaborCost.salary}
                      onChange={(e) => setNewLaborCost({ ...newLaborCost, salary: e.target.value })}
                    />
                    <Button onClick={handleAddLaborCost}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {laborCosts.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
                  {laborCosts.map((cost) => (
                    <div key={cost.id} className="flex items-center justify-between p-3 bg-secondary/30 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{cost.employee_name}</p>
                        {cost.role && <p className="text-sm text-muted-foreground">{cost.role}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold">R$ {cost.salary.toFixed(2)}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteLaborCost(cost.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

    </div>
  );
}
