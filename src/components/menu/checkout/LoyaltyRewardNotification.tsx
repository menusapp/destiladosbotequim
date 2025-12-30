import { useState, useEffect } from "react";
import { Gift, ChevronRight, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Reward {
  id: string;
  trigger_value: number;
  reward_type: string;
  reward_value: number | null;
  reward_product_id: string | null;
  description: string | null;
  product?: {
    id: string;
    name: string;
    image_url: string | null;
    price: number;
  };
}

interface LoyaltyRewardNotificationProps {
  restaurantId: string;
  customerCPF: string;
  primaryColor: string;
  onRedeemReward: (reward: Reward) => void;
}

export const LoyaltyRewardNotification = ({
  restaurantId,
  customerCPF,
  primaryColor,
  onRedeemReward,
}: LoyaltyRewardNotificationProps) => {
  const [availableRewards, setAvailableRewards] = useState<Reward[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  useEffect(() => {
    if (customerCPF && restaurantId) {
      checkAvailableRewards();
    }
  }, [customerCPF, restaurantId]);

  const checkAvailableRewards = async () => {
    setLoading(true);
    try {
      // Fetch active program
      const { data: program } = await supabase
        .from("loyalty_programs")
        .select(`
          *,
          loyalty_program_rewards(*, reward_product:products(id, name, image_url, price))
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle();

      if (!program) {
        setAvailableRewards([]);
        return;
      }

      // Fetch customer orders after activation
      let ordersQuery = supabase
        .from("orders")
        .select(`
          id, created_at,
          order_items(price_at_order, quantity, order_item_extras(price_at_order))
        `)
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .in("status", ["delivered", "picked_up", "completed"]);

      if (program.activated_at) {
        ordersQuery = ordersQuery.gte("created_at", program.activated_at);
      }

      const { data: ordersData } = await ordersQuery;

      // Calculate progress
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

      const currentValue = program.type === "purchases" ? purchase_count : total_spent;

      // Fetch already redeemed rewards
      const { data: redemptions } = await supabase
        .from("loyalty_reward_redemptions")
        .select("trigger_value")
        .eq("restaurant_id", restaurantId)
        .eq("customer_cpf", customerCPF)
        .eq("program_id", program.id);

      const redeemedTriggers = new Set(redemptions?.map(r => r.trigger_value) || []);

      // Find rewards that are earned but not redeemed
      const rewards = (program.loyalty_program_rewards || [])
        .filter((r: any) => 
          r.trigger_value <= currentValue && !redeemedTriggers.has(r.trigger_value)
        )
        .map((r: any) => ({
          id: r.id,
          trigger_value: r.trigger_value,
          reward_type: r.reward_type,
          reward_value: r.reward_value,
          reward_product_id: r.reward_product_id,
          description: r.description,
          product: r.reward_product,
        }));

      setAvailableRewards(rewards);
    } catch (error) {
      console.error("Error checking rewards:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (reward: Reward) => {
    setRedeeming(reward.id);
    try {
      // Record redemption
      const { data: program } = await supabase
        .from("loyalty_programs")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .single();

      if (program) {
        await supabase.from("loyalty_reward_redemptions").insert({
          restaurant_id: restaurantId,
          customer_cpf: customerCPF,
          program_id: program.id,
          reward_id: reward.id,
          trigger_value: reward.trigger_value,
        });
      }

      onRedeemReward(reward);
      setDrawerOpen(false);
      
      // Remove from list
      setAvailableRewards(prev => prev.filter(r => r.id !== reward.id));
    } catch (error) {
      console.error("Error redeeming reward:", error);
    } finally {
      setRedeeming(null);
    }
  };

  const getRewardDescription = (reward: Reward) => {
    switch (reward.reward_type) {
      case "discount_percentage":
        return `${reward.reward_value}% de desconto`;
      case "discount_fixed":
        return `R$ ${reward.reward_value?.toFixed(2)} de desconto`;
      case "free_item":
        return reward.product ? `${reward.product.name} grátis` : "Item grátis";
      case "free_delivery":
        return "Entrega grátis";
      default:
        return reward.description || "Recompensa";
    }
  };

  if (loading || availableRewards.length === 0) {
    return null;
  }

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
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {availableRewards.length}
          </span>
        </div>
        <div className="flex-1 text-left">
          <p className="font-medium text-sm" style={{ color: primaryColor }}>
            Você tem recompensas!
          </p>
          <p className="text-xs text-muted-foreground">
            Clique para resgatar
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>

      {/* Drawer with rewards */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" style={{ color: primaryColor }} />
                Suas Recompensas
              </DrawerTitle>
              <button onClick={() => setDrawerOpen(false)}>
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </DrawerHeader>

          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
            {availableRewards.map((reward) => (
              <Card key={reward.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 p-3">
                    {reward.product?.image_url ? (
                      <img
                        src={reward.product.image_url}
                        alt={reward.product.name}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    ) : (
                      <div 
                        className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${primaryColor}20` }}
                      >
                        <Gift className="w-8 h-8" style={{ color: primaryColor }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">
                        {getRewardDescription(reward)}
                      </p>
                      {reward.product && (
                        <p className="text-xs text-muted-foreground line-through">
                          R$ {reward.product.price.toFixed(2)}
                        </p>
                      )}
                      <p className="text-xs font-medium mt-1" style={{ color: primaryColor }}>
                        GRÁTIS
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleRedeem(reward)}
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
        </DrawerContent>
      </Drawer>
    </>
  );
};
