import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Trash2, Banknote, Smartphone, Receipt } from "lucide-react";

interface PaymentMethod {
  id: string;
  method_type: string;
  name: string;
  is_active: boolean;
}

const METHOD_TYPES = [
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "credit", label: "Cartão de Crédito", icon: CreditCard },
  { value: "debit", label: "Cartão de Débito", icon: CreditCard },
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "meal_voucher", label: "Vale Refeição", icon: Receipt },
];

const PaymentMethodsSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Form state
  const [methodType, setMethodType] = useState("");
  const [methodName, setMethodName] = useState("");

  useEffect(() => {
    fetchMethods();
  }, [restaurantId]);

  const fetchMethods = async () => {
    try {
      const { data, error } = await supabase
        .from("payment_methods")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");

      if (error) throw error;
      setMethods(data || []);
    } catch (error) {
      toast.error("Erro ao carregar formas de pagamento");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setMethodType("");
    setMethodName("");
  };

  const handleSave = async () => {
    if (!methodType || !methodName.trim()) {
      toast.error("Preencha todos os campos");
      return;
    }

    try {
      const { error } = await supabase
        .from("payment_methods")
        .insert({
          restaurant_id: restaurantId,
          method_type: methodType,
          name: methodName,
        });

      if (error) throw error;

      toast.success("Forma de pagamento adicionada!");
      setDialogOpen(false);
      resetForm();
      await fetchMethods();
    } catch (error) {
      toast.error("Erro ao adicionar forma de pagamento");
      console.error(error);
    }
  };

  const handleDelete = async (methodId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta forma de pagamento?")) return;

    try {
      const { error } = await supabase
        .from("payment_methods")
        .delete()
        .eq("id", methodId);

      if (error) throw error;
      toast.success("Forma de pagamento excluída!");
      await fetchMethods();
    } catch (error) {
      toast.error("Erro ao excluir forma de pagamento");
      console.error(error);
    }
  };

  const toggleActive = async (method: PaymentMethod) => {
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ is_active: !method.is_active })
        .eq("id", method.id);

      if (error) throw error;
      await fetchMethods();
    } catch (error) {
      toast.error("Erro ao atualizar forma de pagamento");
      console.error(error);
    }
  };

  const getMethodIcon = (type: string) => {
    const found = METHOD_TYPES.find(m => m.value === type);
    if (found) {
      const Icon = found.icon;
      return <Icon className="h-5 w-5" />;
    }
    return <CreditCard className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Carregando formas de pagamento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Formas de Pagamento</h2>
          <p className="text-muted-foreground">Configure as formas de pagamento aceitas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova Forma de Pagamento</DialogTitle>
              <DialogDescription>
                Adicione uma forma de pagamento aceita pelo seu restaurante
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="method-type">Tipo</Label>
                <Select value={methodType} onValueChange={setMethodType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="method-name">Nome de Exibição</Label>
                <Input
                  id="method-name"
                  placeholder="Ex: Dinheiro, Visa Crédito, PIX"
                  value={methodName}
                  onChange={(e) => setMethodName(e.target.value)}
                />
              </div>

              <Button onClick={handleSave} className="w-full">
                Adicionar Forma de Pagamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {methods.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma forma de pagamento cadastrada</h3>
            <p className="text-muted-foreground mb-4">
              Adicione as formas de pagamento aceitas pelo seu restaurante
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {methods.map((method) => (
                <div 
                  key={method.id} 
                  className={`flex items-center justify-between p-4 ${
                    !method.is_active ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      {getMethodIcon(method.method_type)}
                    </div>
                    <div>
                      <p className="font-medium">{method.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {METHOD_TYPES.find(t => t.value === method.method_type)?.label}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Switch
                      checked={method.is_active}
                      onCheckedChange={() => toggleActive(method)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PaymentMethodsSettings;
