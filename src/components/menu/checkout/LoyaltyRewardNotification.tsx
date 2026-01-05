import { useState, useEffect, useRef } from "react";
import { Gift, ChevronRight, X, Loader2, Lock, Check, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import useEmblaCarousel from "embla-carousel-react";

interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

interface Reward {
  id: string;
  trigger_value: number;
  reward_type: string;
  reward_value: number | null;
  reward_product_id: string | null;
  reward_extra_id: string | null;
  description: string | null;
  product?: {
    id: string;
    name: string;
    image_url: string | null;
    price: number;
  };
  extra?: ProductExtra;
}

export interface DiscountReward {
  id: string;
  type: 'discount_percentage' | 'discount_fixed' | 'free_delivery';
  value: number;
  programId: string;
  triggerValue: number;
}

interface CustomerCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  valid_until: string | null;
  min_order_value: number | null;
}

interface LoyaltyRewardNotificationProps {
  restaurantId: string;
  customerCPF: string;
  primaryColor: string;
  onRedeemReward: (reward: Reward) => void;
  onRedeemDiscount?: (discount: DiscountReward) => void;
  onUseCoupon?: (couponCode: string) => void;
}

export const LoyaltyRewardNotification = ({
  restaurantId,
  customerCPF,
  primaryColor,
  onRedeemReward,
  onRedeemDiscount,
  onUseCoupon,
}: LoyaltyRewardNotificationProps) => {
  const [earnedRewards, setEarnedRewards] = useState<Reward[]>([]);
  const [lockedRewards, setLockedRewards] = useState<{ reward: Reward; missing: number; unit: string }[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [currentValue, setCurrentValue] = useState(0);
  const [programType, setProgramType] = useState<"purchases" | "spending">("purchases");
  
  // Coupons state
  const [customerCoupons, setCustomerCoupons] = useState<CustomerCoupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  
  // Carousel for tabs
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [activeTab, setActiveTab] = useState(0);

  // Sync carousel with tab selection
  useEffect(() => {
    if (emblaApi) {
      emblaApi.on('select', () => {
        setActiveTab(emblaApi.selectedScrollSnap());
      });
    }
  }, [emblaApi]);

  const scrollToTab = (index: number) => {
    if (emblaApi) {
      emblaApi.scrollTo(index);
      setActiveTab(index);
    }
  };

  useEffect(() => {
    if (customerCPF && restaurantId) {
      checkAvailableRewards();
      fetchCustomerCoupons();
    }
  }, [customerCPF, restaurantId]);

  const fetchCustomerCoupons = async () => {
    setLoadingCoupons(true);
    try {
      // Fetch coupon codes from marketing messages sent to this customer
      const { data: messages } = await supabase
        .from("marketing_scheduled_messages")
        .select("coupon_code")
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .eq("status", "sent")
        .not("coupon_code", "is", null);

      const couponCodes = [...new Set(messages?.map(m => m.coupon_code).filter(Boolean) || [])];

      if (couponCodes.length === 0) {
        setCustomerCoupons([]);
        return;
      }

      // Fetch valid coupons
      const { data: coupons } = await supabase
        .from("coupons")
        .select("id, code, discount_type, discount_value, valid_until, min_order_value")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .in("code", couponCodes);

      // Filter out expired coupons
      const validCoupons = (coupons || []).filter(c => {
        if (!c.valid_until) return true;
        return new Date(c.valid_until) > new Date();
      });

      setCustomerCoupons(validCoupons);
    } catch (error) {
      console.error("Error fetching customer coupons:", error);
    } finally {
      setLoadingCoupons(false);
    }
  };

  const checkAvailableRewards = async () => {
    setLoading(true);
    try {
      // Fetch active program with rewards
      const { data: program } = await supabase
        .from("loyalty_programs")
        .select(`
          *,
          loyalty_program_rewards(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle();

      if (!program) {
        setEarnedRewards([]);
        setLockedRewards([]);
        return;
      }

      setProgramType(program.type as "purchases" | "spending");

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

      // Fetch customer orders AFTER the baseline
      const { data: ordersData } = await supabase
        .from("orders")
        .select(`
          id, created_at,
          order_items(price_at_order, quantity, order_item_extras(price_at_order))
        `)
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .in("status", ["delivered", "picked_up", "completed"])
        .gte("created_at", baselineAt.toISOString());

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

      // Para programas de compras, a compra atual também conta (+1)
      const currentVal = program.type === "purchases" ? purchase_count + 1 : total_spent;
      setCurrentValue(currentVal);

      // Fetch redemptions AFTER the baseline (current cycle only)
      const { data: cycleRedemptions } = await supabase
        .from("loyalty_reward_redemptions")
        .select("reward_id")
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .eq("program_id", program.id)
        .gt("redeemed_at", baselineAt.toISOString());

      const redeemedRewardIds = new Set(cycleRedemptions?.map(r => r.reward_id) || []);

      // All rewards for the program
      const allRewards = (program.loyalty_program_rewards || []) as any[];

      // Separate earned and locked rewards
      const earned = allRewards
        .filter((r: any) => r.trigger_value <= currentVal && !redeemedRewardIds.has(r.id))
        .sort((a: any, b: any) => b.trigger_value - a.trigger_value);

      const locked = allRewards
        .filter((r: any) => r.trigger_value > currentVal)
        .map((r: any) => ({
          reward: r,
          missing: r.trigger_value - currentVal,
          unit: program.type === "purchases" ? "compra(s)" : "R$",
        }))
        .sort((a: any, b: any) => a.missing - b.missing);

      // Fetch products for free_item rewards
      const allRewardsToEnrich = [...earned, ...locked.map(l => l.reward)];
      const freeItemRewards = allRewardsToEnrich.filter((r: any) => r.reward_type === "free_item" && r.reward_product_id);
      const productIds = freeItemRewards.map((r: any) => r.reward_product_id);

      let productsMap: Record<string, any> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name, image_url, price")
          .in("id", productIds);
        
        products?.forEach(p => {
          productsMap[p.id] = p;
        });
      }

      // Fetch extras for rewards that have reward_extra_id
      const extraIds = allRewardsToEnrich
        .filter((r: any) => r.reward_extra_id)
        .map((r: any) => r.reward_extra_id);

      let extrasMap: Record<string, ProductExtra> = {};
      if (extraIds.length > 0) {
        const { data: extras } = await supabase
          .from("product_extras")
          .select("id, name, price")
          .in("id", extraIds);
        
        extras?.forEach(e => {
          extrasMap[e.id] = e;
        });
      }

      // Build final earned rewards
      const earnedRewardsList: Reward[] = earned.map((r: any) => ({
        id: r.id,
        trigger_value: r.trigger_value,
        reward_type: r.reward_type,
        reward_value: r.reward_value,
        reward_product_id: r.reward_product_id,
        reward_extra_id: r.reward_extra_id,
        description: r.description,
        product: r.reward_product_id ? productsMap[r.reward_product_id] : undefined,
        extra: r.reward_extra_id ? extrasMap[r.reward_extra_id] : undefined,
      }));

      // Build final locked rewards
      const lockedRewardsList = locked.map((l: any) => ({
        reward: {
          id: l.reward.id,
          trigger_value: l.reward.trigger_value,
          reward_type: l.reward.reward_type,
          reward_value: l.reward.reward_value,
          reward_product_id: l.reward.reward_product_id,
          reward_extra_id: l.reward.reward_extra_id,
          description: l.reward.description,
          product: l.reward.reward_product_id ? productsMap[l.reward.reward_product_id] : undefined,
          extra: l.reward.reward_extra_id ? extrasMap[l.reward.reward_extra_id] : undefined,
        },
        missing: l.missing,
        unit: l.unit,
      }));

      setEarnedRewards(earnedRewardsList);
      setLockedRewards(lockedRewardsList);
    } catch (error) {
      console.error("Error checking rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (reward: Reward, programId: string) => {
    setRedeeming(reward.id);
    try {
      if (reward.reward_type === "free_item") {
        // For free_item, ensure product exists
        if (!reward.product) {
          toast.error("Produto da recompensa não encontrado");
          return;
        }
        onRedeemReward(reward);
      } else if (reward.reward_type === "discount_percentage" || reward.reward_type === "discount_fixed" || reward.reward_type === "free_delivery") {
        // For discount rewards
        if (onRedeemDiscount) {
          onRedeemDiscount({
            id: reward.id,
            type: reward.reward_type as 'discount_percentage' | 'discount_fixed' | 'free_delivery',
            value: reward.reward_type === "free_delivery" ? 100 : (reward.reward_value || 0),
            programId,
            triggerValue: reward.trigger_value,
          });
        }
      }

      setDrawerOpen(false);
      
      // Remove from earned list
      setEarnedRewards(prev => prev.filter(r => r.id !== reward.id));
      
      toast.success("Recompensa aplicada!");
    } catch (error) {
      console.error("Error redeeming reward:", error);
      toast.error("Erro ao resgatar recompensa");
    } finally {
      setRedeeming(null);
    }
  };

  const handleUseCoupon = (couponCode: string) => {
    if (onUseCoupon) {
      onUseCoupon(couponCode);
      setDrawerOpen(false);
      toast.success(`Cupom ${couponCode} selecionado!`);
    }
  };

  const getRewardDescription = (reward: Reward) => {
    switch (reward.reward_type) {
      case "discount_percentage":
        return `${reward.reward_value}% de desconto`;
      case "discount_fixed":
        return `R$ ${reward.reward_value?.toFixed(2)} de desconto`;
      case "free_item":
        let desc = reward.product ? reward.product.name : "Item";
        if (reward.extra) {
          desc += ` (${reward.extra.name})`;
        }
        return `${desc} grátis`;
      case "free_delivery":
        return "Entrega grátis";
      default:
        return reward.description || "Recompensa";
    }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case "discount_percentage":
      case "discount_fixed":
        return "%";
      case "free_delivery":
        return "🚚";
      default:
        return null;
    }
  };

  const formatCouponDiscount = (coupon: CustomerCoupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}% OFF`;
    }
    return `R$ ${coupon.discount_value.toFixed(2)} OFF`;
  };

  // Get program ID for redemption
  const [programId, setProgramId] = useState<string>("");

  useEffect(() => {
    const fetchProgramId = async () => {
      const { data } = await supabase
        .from("loyalty_programs")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle();
      if (data) setProgramId(data.id);
    };
    if (restaurantId) fetchProgramId();
  }, [restaurantId]);

  const hasRewards = earnedRewards.length > 0 || lockedRewards.length > 0;
  const hasCoupons = customerCoupons.length > 0;
  const hasContent = hasRewards || hasCoupons;

  if (loading || !hasContent) {
    return null;
  }

  const totalNotifications = earnedRewards.length + customerCoupons.length;

  return (
    <>
      {/* Notification Bar */}
      <button
        onClick={() => setDrawerOpen(true)}
        className="w-full p-3 rounded-lg border-2 flex items-center gap-3 transition-all hover:shadow-md"
        style={{ 
          borderColor: primaryColor,
          backgroundColor: `${primaryColor}10`,
        }}
      >
        <div 
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 relative"
          style={{ backgroundColor: primaryColor }}
        >
          <Gift className="w-5 h-5 text-white" />
          {totalNotifications > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
              {totalNotifications}
            </span>
          )}
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-sm" style={{ color: primaryColor }}>
            {totalNotifications > 0 ? "Você tem recompensas!" : "Programa de Fidelidade"}
          </p>
          <p className="text-xs text-muted-foreground">
            {totalNotifications > 0 
              ? "Clique para ver e resgatar" 
              : `${lockedRewards.length} recompensa(s) disponível(is)`}
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Drawer with rewards and coupons */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b pb-0">
            <div className="flex items-center justify-between mb-3">
              <DrawerTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" style={{ color: primaryColor }} />
                Suas Recompensas
              </DrawerTitle>
              <button onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            
            {/* Tab Headers */}
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => scrollToTab(0)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 0 
                    ? 'bg-background shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={activeTab === 0 ? { color: primaryColor } : {}}
              >
                <Gift className="w-4 h-4 inline mr-1" />
                Fidelidade
                {earnedRewards.length > 0 && (
                  <span 
                    className="ml-1 px-1.5 py-0.5 text-xs rounded-full text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {earnedRewards.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => scrollToTab(1)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 1 
                    ? 'bg-background shadow-sm' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                style={activeTab === 1 ? { color: primaryColor } : {}}
              >
                <Ticket className="w-4 h-4 inline mr-1" />
                Cupons
                {customerCoupons.length > 0 && (
                  <span 
                    className="ml-1 px-1.5 py-0.5 text-xs rounded-full text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {customerCoupons.length}
                  </span>
                )}
              </button>
            </div>
          </DrawerHeader>

          {/* Swipeable Content */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {/* Tab 1: Fidelidade */}
              <div className="flex-[0_0_100%] min-w-0">
                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                  {/* Current Progress */}
                  {hasRewards && (
                    <div className="text-center text-sm text-muted-foreground">
                      <p>
                        {programType === "purchases" 
                          ? `Você tem ${currentValue} compra(s) no ciclo atual` 
                          : `Você gastou R$ ${currentValue.toFixed(2)} no ciclo atual`}
                      </p>
                    </div>
                  )}

                  {/* Earned Rewards Section */}
                  {earnedRewards.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: primaryColor }}>
                        <Check className="w-4 h-4" />
                        Liberadas
                      </h3>
                      <div className="space-y-2">
                        {earnedRewards.map((reward) => (
                          <Card key={reward.id} className="overflow-hidden border-2" style={{ borderColor: `${primaryColor}40` }}>
                            <CardContent className="p-0">
                              <div className="flex items-center gap-3 p-3">
                                {reward.product?.image_url ? (
                                  <img
                                    src={reward.product.image_url}
                                    alt={reward.product.name}
                                    className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                                  />
                                ) : (
                                  <div 
                                    className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                                    style={{ backgroundColor: primaryColor }}
                                  >
                                    {getRewardIcon(reward.reward_type) || <Gift className="w-6 h-6" />}
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm">
                                    {getRewardDescription(reward)}
                                  </p>
                                  <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>
                                    ✓ LIBERADO
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleRedeem(reward, programId)}
                                  disabled={redeeming === reward.id}
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  {redeeming === reward.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    "Resgatar"
                                  )}
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Locked Rewards Section */}
                  {lockedRewards.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-muted-foreground">
                        <Lock className="w-4 h-4" />
                        Faltam liberar
                      </h3>
                      <div className="space-y-2">
                        {lockedRewards.map(({ reward, missing, unit }) => {
                          const progress = (currentValue / reward.trigger_value) * 100;
                          
                          return (
                            <Card key={reward.id} className="overflow-hidden opacity-70">
                              <CardContent className="p-0">
                                <div className="flex items-center gap-3 p-3">
                                  {reward.product?.image_url ? (
                                    <img
                                      src={reward.product.image_url}
                                      alt={reward.product.name}
                                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0 grayscale"
                                    />
                                  ) : (
                                    <div 
                                      className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground font-bold text-lg"
                                    >
                                      {getRewardIcon(reward.reward_type) || <Gift className="w-6 h-6" />}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-muted-foreground">
                                      {getRewardDescription(reward)}
                                    </p>
                                    <div className="mt-2">
                                      <Progress value={progress} className="h-1.5" />
                                      <p className="text-xs text-muted-foreground mt-1">
                                        🔒 Falta {unit === "R$" ? `R$ ${missing.toFixed(2)}` : `${missing} ${unit}`}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No rewards message */}
                  {!hasRewards && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhum programa de fidelidade ativo</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tab 2: Cupons */}
              <div className="flex-[0_0_100%] min-w-0">
                <div className="p-4 space-y-4 max-h-[50vh] overflow-y-auto">
                  {loadingCoupons ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : customerCoupons.length > 0 ? (
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3" style={{ color: primaryColor }}>
                        <Ticket className="w-4 h-4" />
                        Cupons Disponíveis
                      </h3>
                      <div className="space-y-2">
                        {customerCoupons.map((coupon) => (
                          <Card key={coupon.id} className="overflow-hidden border-2" style={{ borderColor: `${primaryColor}40` }}>
                            <CardContent className="p-0">
                              <div className="flex items-center gap-3 p-3">
                                <div 
                                  className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  <Ticket className="w-6 h-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-sm">{coupon.code}</p>
                                  <p className="text-xs font-medium" style={{ color: primaryColor }}>
                                    {formatCouponDiscount(coupon)}
                                  </p>
                                  {coupon.valid_until && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      Válido até {new Date(coupon.valid_until).toLocaleDateString('pt-BR')}
                                    </p>
                                  )}
                                  {coupon.min_order_value && coupon.min_order_value > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      Pedido mínimo: R$ {coupon.min_order_value.toFixed(2)}
                                    </p>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleUseCoupon(coupon.code)}
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  Usar
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Ticket className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">Nenhum cupom disponível</p>
                      <p className="text-xs mt-1">Cupons de campanhas aparecerão aqui</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Swipe indicator */}
          <div className="flex justify-center gap-1.5 pb-4">
            <div 
              className={`w-2 h-2 rounded-full transition-colors ${activeTab === 0 ? '' : 'bg-muted'}`}
              style={activeTab === 0 ? { backgroundColor: primaryColor } : {}}
            />
            <div 
              className={`w-2 h-2 rounded-full transition-colors ${activeTab === 1 ? '' : 'bg-muted'}`}
              style={activeTab === 1 ? { backgroundColor: primaryColor } : {}}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
