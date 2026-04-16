import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Plus, Trash2, Banknote, Smartphone, Receipt, Pencil } from "lucide-react";

interface PaymentMethod {
  id: string;
  method_type: string;
  name: string;
  is_active: boolean;
  accepted_brands: string[];
}

const METHOD_TYPES = [
  { value: "cash", label: "Dinheiro", icon: Banknote },
  { value: "credit", label: "Cartão de Crédito", icon: CreditCard },
  { value: "debit", label: "Cartão de Débito", icon: CreditCard },
  { value: "pix", label: "PIX", icon: Smartphone },
  { value: "meal_voucher", label: "Vale Refeição", icon: Receipt },
];

// Bandeiras de cartão de crédito/débito
const CARD_BRANDS = [
  { code: "visa", name: "Visa", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Visa_Inc._logo.svg/200px-Visa_Inc._logo.svg.png" },
  { code: "mastercard", name: "Mastercard", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/200px-Mastercard-logo.svg.png" },
  { code: "elo", name: "Elo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/ELO_logo.svg/200px-ELO_logo.svg.png" },
  { code: "amex", name: "American Express", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/200px-American_Express_logo_%282018%29.svg.png" },
  { code: "hipercard", name: "Hipercard", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Hipercard_logo.svg/200px-Hipercard_logo.svg.png" },
  { code: "diners", name: "Diners Club", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a6/Diners_Club_Logo3.svg/200px-Diners_Club_Logo3.svg.png" },
];

// Bandeiras de vale-refeição
const MEAL_VOUCHER_BRANDS = [
  { code: "alelo", name: "Alelo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Alelo_logo.svg/200px-Alelo_logo.svg.png" },
  { code: "sodexo", name: "Sodexo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Sodexo_logo.svg/200px-Sodexo_logo.svg.png" },
  { code: "ticket", name: "Ticket", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Edenred_logo.svg/200px-Edenred_logo.svg.png" },
  { code: "vr", name: "VR", logo: "https://www.vr.com.br/assets/img/logo.svg" },
  { code: "pluxee", name: "Pluxee", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/Sodexo_logo.svg/200px-Sodexo_logo.svg.png" },
  { code: "ifood", name: "iFood Benefícios", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/IFood_logo.svg/200px-IFood_logo.svg.png" },
];

const PaymentMethodsSettings = ({ restaurantId }: { restaurantId: string }) => {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [editBrandsOpen, setEditBrandsOpen] = useState(false);
  const [editBrands, setEditBrands] = useState<string[]>([]);
  
  // Form state
  const [methodType, setMethodType] = useState("");
  const [methodName, setMethodName] = useState("");
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

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
    setSelectedBrands([]);
  };

  const toggleBrand = (brandCode: string, checked: boolean) => {
    if (checked) {
      setSelectedBrands(prev => [...prev, brandCode]);
    } else {
      setSelectedBrands(prev => prev.filter(b => b !== brandCode));
    }
  };

  const getBrandsForType = (type: string) => {
    if (type === "credit" || type === "debit") {
      return CARD_BRANDS;
    }
    if (type === "meal_voucher") {
      return MEAL_VOUCHER_BRANDS;
    }
    return [];
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
          accepted_brands: selectedBrands,
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

  const handleOpenEditBrands = (method: PaymentMethod) => {
    setEditingMethod(method);
    setEditBrands(method.accepted_brands || []);
    setEditBrandsOpen(true);
  };

  const toggleEditBrand = (brandCode: string, checked: boolean) => {
    if (checked) {
      setEditBrands(prev => [...prev, brandCode]);
    } else {
      setEditBrands(prev => prev.filter(b => b !== brandCode));
    }
  };

  const handleSaveEditBrands = async () => {
    if (!editingMethod) return;
    try {
      const { error } = await supabase
        .from("payment_methods")
        .update({ accepted_brands: editBrands })
        .eq("id", editingMethod.id);

      if (error) throw error;
      toast.success("Bandeiras atualizadas!");
      setEditBrandsOpen(false);
      setEditingMethod(null);
      await fetchMethods();
    } catch (error) {
      toast.error("Erro ao atualizar bandeiras");
      console.error(error);
    }
  };

  const hasBrands = (type: string) => ["credit", "debit", "meal_voucher"].includes(type);

  const getMethodIcon = (type: string) => {
    const found = METHOD_TYPES.find(m => m.value === type);
    if (found) {
      const Icon = found.icon;
      return <Icon className="h-5 w-5" />;
    }
    return <CreditCard className="h-5 w-5" />;
  };

  const getBrandInfo = (brandCode: string, methodType: string) => {
    const allBrands = [...CARD_BRANDS, ...MEAL_VOUCHER_BRANDS];
    return allBrands.find(b => b.code === brandCode);
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
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nova Forma de Pagamento</DialogTitle>
              <DialogDescription>
                Adicione uma forma de pagamento aceita pelo seu restaurante
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="method-type">Tipo</Label>
                <Select value={methodType} onValueChange={(value) => { setMethodType(value); setSelectedBrands([]); }}>
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

              {/* Seleção de bandeiras para cartões e vale-refeição */}
              {(methodType === "credit" || methodType === "debit" || methodType === "meal_voucher") && (
                <div className="space-y-3">
                  <Label>Bandeiras Aceitas</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {getBrandsForType(methodType).map((brand) => (
                      <div 
                        key={brand.code} 
                        className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedBrands.includes(brand.code) 
                            ? "border-primary bg-primary/5" 
                            : "hover:border-muted-foreground/50"
                        }`}
                        onClick={() => toggleBrand(brand.code, !selectedBrands.includes(brand.code))}
                      >
                        <Checkbox 
                          checked={selectedBrands.includes(brand.code)}
                          onCheckedChange={(checked) => toggleBrand(brand.code, !!checked)}
                        />
                        <img 
                          src={brand.logo} 
                          alt={brand.name} 
                          className="h-6 w-auto object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                        <span className="text-sm font-medium">{brand.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
                  className={`p-4 ${
                    !method.is_active ? "opacity-60 bg-muted/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
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
                      {hasBrands(method.method_type) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEditBrands(method)}
                          title="Editar bandeiras"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
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
                  
                  {/* Mostrar bandeiras aceitas */}
                  {method.accepted_brands && method.accepted_brands.length > 0 && (
                    <div className="mt-3 ml-12 flex flex-wrap gap-2">
                      {method.accepted_brands.map((brandCode) => {
                        const brand = getBrandInfo(brandCode, method.method_type);
                        if (!brand) return null;
                        return (
                          <div 
                            key={brandCode} 
                            className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-md"
                          >
                            <img 
                              src={brand.logo} 
                              alt={brand.name} 
                              className="h-4 w-auto object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <span className="text-xs font-medium">{brand.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
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