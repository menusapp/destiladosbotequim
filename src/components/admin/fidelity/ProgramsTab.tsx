import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Gift, ShoppingCart, DollarSign, Pencil } from "lucide-react";

interface LoyaltyProgram {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  rewards?: LoyaltyReward[];
}

interface LoyaltyReward {
  id: string;
  trigger_value: number;
  reward_type: string;
  reward_value: number | null;
  reward_product_id: string | null;
  description: string | null;
}

interface Product {
  id: string;
  name: string;
}

interface ProgramsTabProps {
  restaurantId: string;
}

export default function ProgramsTab({ restaurantId }: ProgramsTabProps) {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<LoyaltyProgram | null>(null);
  
  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>("purchases");
  const [rewards, setRewards] = useState<Omit<LoyaltyReward, "id">[]>([]);

  useEffect(() => {
    fetchPrograms();
    fetchProducts();
  }, [restaurantId]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from("loyalty_programs")
        .select(`
          *,
          loyalty_program_rewards(*)
        `)
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPrograms(data?.map(p => ({ ...p, rewards: p.loyalty_program_rewards })) || []);
    } catch (error) {
      console.error("Error fetching programs:", error);
      toast.error("Erro ao carregar programas");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name")
      .eq("available", true)
      .order("name");
    setProducts(data || []);
  };

  const handleOpenDialog = (program?: LoyaltyProgram) => {
    if (program) {
      setEditingProgram(program);
      setFormName(program.name);
      setFormType(program.type);
      setRewards(program.rewards?.map(r => ({
        trigger_value: r.trigger_value,
        reward_type: r.reward_type,
        reward_value: r.reward_value,
        reward_product_id: r.reward_product_id,
        description: r.description,
      })) || []);
    } else {
      setEditingProgram(null);
      setFormName("");
      setFormType("purchases");
      setRewards([{ trigger_value: 1, reward_type: "discount_percentage", reward_value: 10, reward_product_id: null, description: "Primeira compra" }]);
    }
    setDialogOpen(true);
  };

  const addReward = () => {
    const lastTrigger = rewards.length > 0 ? rewards[rewards.length - 1].trigger_value : 0;
    setRewards([...rewards, {
      trigger_value: formType === "purchases" ? lastTrigger + 5 : lastTrigger + 100,
      reward_type: "discount_percentage",
      reward_value: 10,
      reward_product_id: null,
      description: "",
    }]);
  };

  const removeReward = (index: number) => {
    setRewards(rewards.filter((_, i) => i !== index));
  };

  const updateReward = (index: number, field: string, value: any) => {
    const updated = [...rewards];
    (updated[index] as any)[field] = value;
    setRewards(updated);
  };

  const handleSaveProgram = async () => {
    if (!formName.trim()) {
      toast.error("Informe o nome do programa");
      return;
    }
    if (rewards.length === 0) {
      toast.error("Adicione pelo menos uma recompensa");
      return;
    }

    try {
      if (editingProgram) {
        // Update program
        const { error: programError } = await supabase
          .from("loyalty_programs")
          .update({ name: formName, type: formType, updated_at: new Date().toISOString() })
          .eq("id", editingProgram.id);
        if (programError) throw programError;

        // Delete old rewards and insert new ones
        await supabase.from("loyalty_program_rewards").delete().eq("program_id", editingProgram.id);
        const { error: rewardsError } = await supabase
          .from("loyalty_program_rewards")
          .insert(rewards.map(r => ({ ...r, program_id: editingProgram.id })));
        if (rewardsError) throw rewardsError;

        toast.success("Programa atualizado!");
      } else {
        // Create new program
        const { data: newProgram, error: programError } = await supabase
          .from("loyalty_programs")
          .insert({ restaurant_id: restaurantId, name: formName, type: formType, is_active: false })
          .select()
          .single();
        if (programError) throw programError;

        // Insert rewards
        const { error: rewardsError } = await supabase
          .from("loyalty_program_rewards")
          .insert(rewards.map(r => ({ ...r, program_id: newProgram.id })));
        if (rewardsError) throw rewardsError;

        toast.success("Programa criado!");
      }

      setDialogOpen(false);
      fetchPrograms();
    } catch (error) {
      console.error("Error saving program:", error);
      toast.error("Erro ao salvar programa");
    }
  };

  const handleToggleActive = async (programId: string, activate: boolean) => {
    try {
      // If activating, first deactivate all others
      if (activate) {
        await supabase
          .from("loyalty_programs")
          .update({ is_active: false })
          .eq("restaurant_id", restaurantId);
      }

      const { error } = await supabase
        .from("loyalty_programs")
        .update({ is_active: activate })
        .eq("id", programId);

      if (error) throw error;
      
      toast.success(activate ? "Programa ativado! Os demais foram desativados." : "Programa desativado!");
      fetchPrograms();
    } catch (error) {
      console.error("Error toggling program:", error);
      toast.error("Erro ao atualizar programa");
    }
  };

  const handleDeleteProgram = async (programId: string) => {
    try {
      const { error } = await supabase
        .from("loyalty_programs")
        .delete()
        .eq("id", programId);
      if (error) throw error;
      toast.success("Programa excluído!");
      fetchPrograms();
    } catch (error) {
      console.error("Error deleting program:", error);
      toast.error("Erro ao excluir programa");
    }
  };

  const getRewardTypeLabel = (type: string) => {
    switch (type) {
      case "discount_percentage": return "% Desconto";
      case "discount_fixed": return "R$ Desconto";
      case "free_item": return "Item Grátis";
      case "free_delivery": return "Entrega Grátis";
      default: return type;
    }
  };

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Programas de Fidelidade</h2>
          <p className="text-sm text-muted-foreground">
            Crie diferentes programas e ative apenas um por vez
          </p>
        </div>
        <Button onClick={() => handleOpenDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Programa
        </Button>
      </div>

      {programs.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum programa criado</h3>
            <p className="text-muted-foreground mb-4">
              Crie seu primeiro programa de fidelidade para recompensar clientes
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Programa
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {programs.map((program) => (
            <Card key={program.id} className={program.is_active ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {program.type === "purchases" ? (
                        <ShoppingCart className="w-5 h-5" />
                      ) : (
                        <DollarSign className="w-5 h-5" />
                      )}
                      {program.name}
                      {program.is_active && (
                        <Badge variant="default">Ativo</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {program.type === "purchases" 
                        ? "Por número de compras" 
                        : "Por valor gasto (R$)"}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={program.is_active}
                      onCheckedChange={(checked) => handleToggleActive(program.id, checked)}
                    />
                    <Button variant="outline" size="icon" onClick={() => handleOpenDialog(program)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="icon" disabled={program.is_active}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir programa?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O programa e suas recompensas serão excluídos.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteProgram(program.id)}>
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recompensas:</h4>
                  <div className="grid gap-2">
                    {program.rewards?.sort((a, b) => a.trigger_value - b.trigger_value).map((reward, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm bg-muted p-2 rounded">
                        <Badge variant="outline">
                          {program.type === "purchases" 
                            ? `${reward.trigger_value}ª compra`
                            : `R$ ${reward.trigger_value}`}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <span>
                          {reward.reward_type === "discount_percentage" && `${reward.reward_value}% de desconto`}
                          {reward.reward_type === "discount_fixed" && `R$ ${reward.reward_value} de desconto`}
                          {reward.reward_type === "free_item" && "Item grátis"}
                          {reward.reward_type === "free_delivery" && "Entrega grátis"}
                        </span>
                        {reward.description && (
                          <span className="text-muted-foreground">- {reward.description}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog for creating/editing programs */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProgram ? "Editar Programa" : "Novo Programa de Fidelidade"}</DialogTitle>
            <DialogDescription>
              Configure as regras de recompensa para seus clientes fiéis
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nome do Programa</Label>
              <Input 
                value={formName} 
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Programa VIP, Fidelidade Ouro"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Programa</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchases">Por Número de Compras</SelectItem>
                  <SelectItem value="spending">Por Valor Gasto (R$)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {formType === "purchases" 
                  ? "Cliente ganha recompensa ao atingir X compras" 
                  : "Cliente ganha recompensa ao gastar R$ X"}
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Recompensas</Label>
                <Button variant="outline" size="sm" onClick={addReward}>
                  <Plus className="w-4 h-4 mr-1" />
                  Adicionar
                </Button>
              </div>

              {rewards.map((reward, index) => (
                <Card key={index}>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Recompensa #{index + 1}</span>
                      <Button variant="ghost" size="icon" onClick={() => removeReward(index)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{formType === "purchases" ? "Nº da Compra" : "Valor Gasto (R$)"}</Label>
                        <Input
                          type="number"
                          value={reward.trigger_value}
                          onChange={(e) => updateReward(index, "trigger_value", parseFloat(e.target.value) || 0)}
                          placeholder={formType === "purchases" ? "Ex: 5" : "Ex: 200"}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Tipo de Recompensa</Label>
                        <Select 
                          value={reward.reward_type} 
                          onValueChange={(v) => updateReward(index, "reward_type", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discount_percentage">% de Desconto</SelectItem>
                            <SelectItem value="discount_fixed">R$ de Desconto</SelectItem>
                            <SelectItem value="free_item">Item Grátis</SelectItem>
                            <SelectItem value="free_delivery">Entrega Grátis</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {(reward.reward_type === "discount_percentage" || reward.reward_type === "discount_fixed") && (
                      <div className="space-y-2">
                        <Label>
                          {reward.reward_type === "discount_percentage" ? "Percentual (%)" : "Valor (R$)"}
                        </Label>
                        <Input
                          type="number"
                          value={reward.reward_value || ""}
                          onChange={(e) => updateReward(index, "reward_value", parseFloat(e.target.value) || 0)}
                          placeholder={reward.reward_type === "discount_percentage" ? "Ex: 10" : "Ex: 20"}
                        />
                      </div>
                    )}

                    {reward.reward_type === "free_item" && (
                      <div className="space-y-2">
                        <Label>Produto Grátis</Label>
                        <Select 
                          value={reward.reward_product_id || ""} 
                          onValueChange={(v) => updateReward(index, "reward_product_id", v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Descrição (opcional)</Label>
                      <Input
                        value={reward.description || ""}
                        onChange={(e) => updateReward(index, "description", e.target.value)}
                        placeholder="Ex: Desconto de boas-vindas"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="flex-1">
                Cancelar
              </Button>
              <Button onClick={handleSaveProgram} className="flex-1">
                {editingProgram ? "Salvar Alterações" : "Criar Programa"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
