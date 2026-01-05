import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { MapPin, Plus, Trash2, User, Gift, Check, Circle } from "lucide-react";
import { toast } from "sonner";

interface ProfileViewProps {
  customerName: string;
  customerCPF: string;
  restaurantId: string;
  onNameUpdate: (name: string) => void;
}

interface LoyaltyProgram {
  id: string;
  name: string;
  type: string;
  activated_at: string | null;
  rewards: {
    id: string;
    trigger_value: number;
    reward_type: string;
    reward_value: number | null;
    reward_product_id: string | null;
    description: string | null;
    productName?: string;
  }[];
}

interface CustomerProgress {
  purchase_count: number;
  total_spent: number;
}

export const ProfileView = ({
  customerName,
  customerCPF,
  restaurantId,
  onNameUpdate,
}: ProfileViewProps) => {
  const [name, setName] = useState(customerName);
  const [phone, setPhone] = useState("");
  const [addresses, setAddresses] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [loyaltyProgram, setLoyaltyProgram] = useState<LoyaltyProgram | null>(null);
  const [customerProgress, setCustomerProgress] = useState<CustomerProgress>({ purchase_count: 0, total_spent: 0 });
  const [newAddress, setNewAddress] = useState({
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    fetchAddresses();
    fetchCoupons();
    fetchLoyaltyProgram();
  }, [customerCPF, restaurantId]);

  const fetchAddresses = async () => {
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_cpf", customerCPF)
      .order("is_default", { ascending: false });
    
    setAddresses(data || []);
    if (data && data.length > 0) {
      setPhone(data[0].customer_phone || "");
    }
  };

  const fetchCoupons = async () => {
    // Buscar mensagens de marketing enviadas para este CPF que têm cupom
    const { data: messages } = await supabase
      .from("marketing_scheduled_messages")
      .select("coupon_code")
      .eq("restaurant_id", restaurantId)
      .eq("customer_cpf", customerCPF)
      .eq("status", "sent")
      .not("coupon_code", "is", null);

    if (!messages || messages.length === 0) {
      setCoupons([]);
      return;
    }

    // Pegar os códigos únicos dos cupons
    const couponCodes = [...new Set(messages.map(m => m.coupon_code).filter(Boolean))];

    if (couponCodes.length === 0) {
      setCoupons([]);
      return;
    }

    // Buscar detalhes dos cupons válidos
    const now = new Date().toISOString();
    const { data: validCoupons } = await supabase
      .from("coupons")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("is_active", true)
      .in("code", couponCodes)
      .or(`valid_until.is.null,valid_until.gte.${now}`);

    setCoupons(validCoupons || []);
  };

  const fetchLoyaltyProgram = async () => {
    try {
      // Fetch active program
      const { data: program, error: programError } = await supabase
        .from("loyalty_programs")
        .select(`
          *,
          loyalty_program_rewards(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle();

      if (programError) throw programError;

      if (!program) {
        setLoyaltyProgram(null);
        return;
      }

      // Find the last redemption to get the baseline
      const { data: lastRedemption } = await supabase
        .from("loyalty_reward_redemptions")
        .select("redeemed_at")
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .eq("program_id", program.id)
        .order("redeemed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Baseline: the later of program activation or last redemption
      const programActivatedAt = program.activated_at ? new Date(program.activated_at) : new Date(0);
      const lastRedeemedAt = lastRedemption?.redeemed_at ? new Date(lastRedemption.redeemed_at) : new Date(0);
      const baselineAt = programActivatedAt > lastRedeemedAt ? programActivatedAt : lastRedeemedAt;

      // Fetch products for free_item rewards
      const rewards = program.loyalty_program_rewards || [];
      const freeItemRewards = rewards.filter((r: any) => r.reward_type === "free_item" && r.reward_product_id);
      const productIds = freeItemRewards.map((r: any) => r.reward_product_id);

      let productsMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        
        products?.forEach(p => {
          productsMap[p.id] = p.name;
        });
      }

      const programData: LoyaltyProgram = {
        id: program.id,
        name: program.name,
        type: program.type,
        activated_at: program.activated_at,
        rewards: rewards.map((r: any) => ({
          id: r.id,
          trigger_value: r.trigger_value,
          reward_type: r.reward_type,
          reward_value: r.reward_value,
          reward_product_id: r.reward_product_id,
          description: r.description,
          productName: r.reward_product_id ? productsMap[r.reward_product_id] : undefined,
        })),
      };
      setLoyaltyProgram(programData);

      // Fetch customer's orders AFTER baseline (reset logic)
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id, created_at,
          order_items(price_at_order, quantity, order_item_extras(price_at_order))
        `)
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .in("status", ["delivered", "picked_up", "completed"])
        .gte("created_at", baselineAt.toISOString());

      if (ordersError) throw ordersError;

      // Calculate progress from baseline
      let purchase_count = 0;
      let total_spent = 0;

      ordersData?.forEach(order => {
        purchase_count += 1;
        order.order_items?.forEach((item: any) => {
          total_spent += item.price_at_order * item.quantity;
          item.order_item_extras?.forEach((extra: any) => {
            total_spent += extra.price_at_order;
          });
        });
      });

      setCustomerProgress({ purchase_count, total_spent });
    } catch (error) {
      console.error("Error fetching loyalty program:", error);
    }
  };

  const handleSaveName = () => {
    onNameUpdate(name);
    toast.success("Nome atualizado!");
  };

  const handleAddAddress = async () => {
    try {
      await supabase.from("customer_addresses").insert({
        customer_cpf: customerCPF,
        customer_name: name,
        customer_phone: phone,
        ...newAddress,
        is_default: addresses.length === 0,
      });

      setNewAddress({
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
      });
      setShowAddAddress(false);
      fetchAddresses();
      toast.success("Endereço adicionado!");
    } catch (error) {
      toast.error("Erro ao adicionar endereço");
    }
  };

  const handleDeleteAddress = async (id: string) => {
    try {
      await supabase.from("customer_addresses").delete().eq("id", id);
      fetchAddresses();
      toast.success("Endereço removido!");
    } catch (error) {
      toast.error("Erro ao remover endereço");
    }
  };

  const getRewardDescription = (reward: any) => {
    switch (reward.reward_type) {
      case "discount_percentage":
        return `${reward.reward_value}% de desconto`;
      case "discount_fixed":
        return `R$ ${reward.reward_value} de desconto`;
      case "free_item":
        return reward.productName ? `${reward.productName} grátis` : "Item grátis";
      case "free_delivery":
        return "Entrega grátis";
      default:
        return reward.description || "Recompensa";
    }
  };

  const renderLoyaltyProgram = () => {
    if (!loyaltyProgram) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Programa de Fidelidade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4 text-muted-foreground">
              <Gift className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Nenhum programa de fidelidade ativo no momento.</p>
              <p className="text-sm mt-1">Continue fazendo pedidos!</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    const currentValue = loyaltyProgram.type === "purchases" 
      ? customerProgress.purchase_count 
      : customerProgress.total_spent;

    const sortedRewards = [...loyaltyProgram.rewards].sort((a, b) => a.trigger_value - b.trigger_value);
    
    // Find the highest reward achieved in current cycle
    const earnedReward = sortedRewards.filter(r => r.trigger_value <= currentValue).pop();
    const hasRewardToRedeem = !!earnedReward;

    if (loyaltyProgram.type === "spending") {
      // Spending type - show progress bar
      const nextReward = sortedRewards.find(r => r.trigger_value > currentValue);
      const targetValue = nextReward?.trigger_value || sortedRewards[sortedRewards.length - 1]?.trigger_value || 100;
      const progress = Math.min((currentValue / targetValue) * 100, 100);
      const reachedGoal = currentValue >= targetValue;

      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Programa de Fidelidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium text-center">{loyaltyProgram.name}</p>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Seu progresso:</span>
                <span className="font-medium">
                  R$ {currentValue.toFixed(2)} de R$ {targetValue.toFixed(2)}
                </span>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-center text-sm text-muted-foreground">
                {progress.toFixed(0)}%
              </p>
            </div>

            {hasRewardToRedeem ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <Gift className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-700">Você tem uma recompensa disponível!</p>
                <p className="text-sm mt-1 text-green-600">
                  <strong>{getRewardDescription(earnedReward)}</strong>
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Resgate na sacola ao fazer seu pedido
                </p>
              </div>
            ) : reachedGoal ? (
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <Check className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="font-medium text-primary">Você já atingiu a meta!</p>
                {nextReward && (
                  <p className="text-sm mt-1">
                    Na sua próxima compra você ganha: <strong>{getRewardDescription(nextReward)}</strong>
                  </p>
                )}
              </div>
            ) : nextReward && (
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Faltam <strong>R$ {(targetValue - currentValue).toFixed(2)}</strong> para ganhar:
                </p>
                <p className="font-medium mt-1">{getRewardDescription(nextReward)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      );
    } else {
      // Purchases type - show steps
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Programa de Fidelidade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-medium text-center">{loyaltyProgram.name}</p>
            
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">Você fez:</p>
              <p className="text-3xl font-bold text-primary">{customerProgress.purchase_count}</p>
              <p className="text-sm text-muted-foreground">compras</p>
            </div>

            {/* Steps visualization */}
            <div className="space-y-3">
              {sortedRewards.map((reward, index) => {
                const isCompleted = customerProgress.purchase_count >= reward.trigger_value;
                const isNext = !isCompleted && (index === 0 || customerProgress.purchase_count >= sortedRewards[index - 1].trigger_value);
                
                return (
                  <div
                    key={index}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      isCompleted 
                        ? "bg-primary/10 border border-primary/20" 
                        : isNext 
                          ? "bg-accent border border-accent-foreground/20" 
                          : "bg-muted"
                    }`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? "bg-primary text-primary-foreground" 
                        : isNext 
                          ? "bg-accent-foreground/20 text-accent-foreground" 
                          : "bg-muted-foreground/20 text-muted-foreground"
                    }`}>
                      {isCompleted ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isCompleted ? "text-primary" : ""}`}>
                        {reward.trigger_value}ª compra
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getRewardDescription(reward)}
                      </p>
                    </div>
                    {isNext && (
                      <Badge variant="secondary" className="text-xs">
                        Próxima
                      </Badge>
                    )}
                    {isCompleted && (
                      <Badge variant="default" className="text-xs">
                        ✓
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {hasRewardToRedeem ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <Gift className="w-8 h-8 mx-auto mb-2 text-green-600" />
                <p className="font-medium text-green-700">Você tem uma recompensa disponível!</p>
                <p className="text-sm mt-1 text-green-600">
                  <strong>{getRewardDescription(earnedReward)}</strong>
                </p>
                <p className="text-xs text-green-600 mt-2">
                  Resgate na sacola ao fazer seu pedido
                </p>
              </div>
            ) : customerProgress.purchase_count === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Faça sua primeira compra e comece a ganhar recompensas!
              </p>
            )}
          </CardContent>
        </Card>
      );
    }
  };

  return (
    <ScrollArea className="h-[calc(100vh-120px)]">
      <div className="space-y-4 p-4 pb-20">
        {/* Informações Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                disabled
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label>CPF</Label>
              <Input value={customerCPF} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>

        {/* Programa de Fidelidade */}
        {renderLoyaltyProgram()}

        {/* Endereços Salvos */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Endereços Salvos
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddAddress(!showAddAddress)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {showAddAddress && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label htmlFor="street">Rua</Label>
                      <Input
                        id="street"
                        value={newAddress.street}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, street: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="number">Número</Label>
                      <Input
                        id="number"
                        value={newAddress.number}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, number: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="complement">Complemento</Label>
                      <Input
                        id="complement"
                        value={newAddress.complement}
                        onChange={(e) =>
                          setNewAddress({
                            ...newAddress,
                            complement: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input
                        id="neighborhood"
                        value={newAddress.neighborhood}
                        onChange={(e) =>
                          setNewAddress({
                            ...newAddress,
                            neighborhood: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Cidade</Label>
                      <Input
                        id="city"
                        value={newAddress.city}
                        onChange={(e) =>
                          setNewAddress({ ...newAddress, city: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddAddress} className="flex-1">
                      Adicionar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowAddAddress(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {addresses.map((address) => (
              <Card key={address.id}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">
                          {address.street}, {address.number}
                        </p>
                        {address.is_default && (
                          <Badge variant="secondary" className="text-xs">
                            Padrão
                          </Badge>
                        )}
                      </div>
                      {address.complement && (
                        <p className="text-sm text-muted-foreground">
                          {address.complement}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {address.neighborhood}, {address.city} - {address.state}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteAddress(address.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}

            {addresses.length === 0 && !showAddAddress && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum endereço salvo
              </p>
            )}
          </CardContent>
        </Card>

        {/* Seus Descontos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Seus Cupons
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {coupons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum cupom disponível no momento
              </p>
            ) : (
              coupons.map((coupon) => (
                <Card key={coupon.id} className="bg-gradient-to-r from-primary/10 to-primary/5">
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-lg">{coupon.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {coupon.discount_type === "percentage"
                            ? `${coupon.discount_value}% de desconto`
                            : `R$ ${Number(coupon.discount_value).toFixed(2)} de desconto`}
                        </p>
                        {coupon.valid_until && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Válido até {new Date(coupon.valid_until).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary">Disponível</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
};