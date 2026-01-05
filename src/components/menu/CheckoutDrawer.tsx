import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { CartStep } from "./checkout/CartStep";
import { AddressStep } from "./checkout/AddressStep";
import { PaymentStep } from "./checkout/PaymentStep";
import { SummaryStep } from "./checkout/SummaryStep";
import { DeliveryTypeStep } from "./checkout/DeliveryTypeStep";
import { CartItem } from "@/types/menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CheckoutStep = "cart" | "delivery-type" | "address" | "payment" | "summary";

interface DeliveryZone {
  id: string;
  zone_name: string;
  delivery_fee: number;
  min_order_value: number;
  estimated_time_minutes: number;
}

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

interface CheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  restaurant: any;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  mode: "delivery" | "local";
  restaurantSlug?: string;
  onAddRewardItem?: (item: CartItem) => void;
  customerCPF?: string;
}

const primaryColorFromRestaurant = (restaurant: any) => restaurant?.primary_color || "#fe9516";

export const CheckoutDrawer = ({
  open,
  onClose,
  cart,
  restaurant,
  onUpdateQuantity,
  onClearCart,
  mode,
  restaurantSlug,
  onAddRewardItem,
  customerCPF: customerCPFProp,
}: CheckoutDrawerProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>("cart");
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">("delivery");
  const [coupon, setCoupon] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [addressData, setAddressData] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone | null>(null);

  useEffect(() => {
    if (open) {
      setStep("cart");
    }
  }, [open]);

  const getProgressValue = () => {
    const steps = { cart: 20, "delivery-type": 40, address: 60, payment: 80, summary: 100 };
    return steps[step];
  };

  // Calcular subtotal (reward items don't count - they're free)
  const subtotal = cart.reduce((sum, item) => {
    if (item.isRewardItem) return sum;
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const effectivePrice = item.product.promotional_price ?? item.product.price;
    return sum + (effectivePrice + extrasTotal) * item.quantity;
  }, 0);

  // Usar taxa de entrega da zona encontrada ou do restaurante como fallback
  const getDeliveryFee = () => {
    if (deliveryType === "pickup") return 0;
    if (deliveryZone) return deliveryZone.delivery_fee || 0;
    return restaurant.delivery_fee || 0;
  };

  // Verificar pedido mínimo
  const getMinOrderValue = () => {
    if (deliveryType === "pickup") return 0;
    if (deliveryZone) return deliveryZone.min_order_value || 0;
    return restaurant.min_order_value || 0;
  };

  const handleFinishOrder = async () => {
    if (submitting) return;
    
    setSubmitting(true);
    try {
      const couponDiscount = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
      const loyaltyDiscount = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
      const deliveryFee = getDeliveryFee();
      const serviceFee = restaurant.service_fee_enabled 
        ? (subtotal * restaurant.service_fee_percentage / 100) 
        : 0;

      // PRIORIDADE: Buscar telefone do cadastro do cliente (fonte da verdade para WhatsApp)
      let phoneToUse = customerData.phone;
      const { data: customerRecord } = await supabase
        .from("customers")
        .select("phone")
        .eq("cpf", customerData.cpf)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();
      
      if (customerRecord?.phone) {
        phoneToUse = customerRecord.phone;
        console.log("[WhatsApp] Usando telefone do cadastro:", phoneToUse);
      } else {
        console.log("[WhatsApp] Usando telefone informado no pedido:", phoneToUse);
      }

      const orderData: any = {
        table_id: null,
        restaurant_id: restaurant.id,
        customer_name: customerData.name,
        customer_cpf: customerData.cpf,
        order_type: "delivery",
        delivery_type: deliveryType,
        delivery_address: deliveryType === "delivery" ? formatAddress(addressData?.address) : null,
        delivery_phone: phoneToUse,
        delivery_neighborhood: deliveryType === "delivery" ? addressData?.address?.neighborhood : null,
        delivery_city: deliveryType === "delivery" ? addressData?.address?.city : null,
        payment_type: paymentData.method,
        coupon_code: coupon?.code,
        coupon_discount: couponDiscount,
        delivery_fee: deliveryFee,
        loyalty_points_used: loyaltyPointsUsed,
        loyalty_points_earned: Math.floor(subtotal * (restaurant.loyalty_points_per_real || 1)),
        status: "pending",
        notes: paymentData.changeFor ? `Troco para: R$ ${paymentData.changeFor}` : null,
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderData)
        .select()
        .single();

      if (orderError) {
        console.error("Erro ao criar pedido:", orderError);
        throw orderError;
      }

      // Insert order items
      for (const item of cart) {
        // For reward items, price_at_order should be 0
        const priceAtOrder = item.isRewardItem 
          ? 0 
          : (item.product.promotional_price ?? item.product.price);

        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_order: priceAtOrder,
            notes: item.notes,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // For reward items with extras, price should also be 0
        for (const extra of item.extras) {
          await supabase.from("order_item_extras").insert({
            order_item_id: orderItem.id,
            product_extra_id: extra.id,
            price_at_order: item.isRewardItem ? 0 : extra.price,
          });
        }
      }

      // Record loyalty reward redemptions for reward items
      const rewardItems = cart.filter(item => item.isRewardItem && item.rewardId);
      if (rewardItems.length > 0) {
        // Get active program
        const { data: activeProgram } = await supabase
          .from("loyalty_programs")
          .select("id")
          .eq("restaurant_id", restaurant.id)
          .eq("is_active", true)
          .single();

        if (activeProgram) {
          for (const rewardItem of rewardItems) {
            // Get the reward's trigger_value
            const { data: reward } = await supabase
              .from("loyalty_program_rewards")
              .select("trigger_value")
              .eq("id", rewardItem.rewardId)
              .single();

            await supabase.from("loyalty_reward_redemptions").insert({
              restaurant_id: restaurant.id,
              customer_cpf: customerData.cpf,
              program_id: activeProgram.id,
              reward_id: rewardItem.rewardId,
              order_id: order.id,
              trigger_value: reward?.trigger_value || 0,
              redeemed_at: new Date().toISOString(),
            });
          }
        }
      }

      if (coupon) {
        await supabase
          .from("coupons")
          .update({ used_count: coupon.used_count + 1 })
          .eq("id", coupon.id);
      }

      if (restaurant.loyalty_enabled && customerData.cpf) {
        if (loyaltyPointsUsed > 0) {
          await updateLoyaltyPoints(
            customerData.cpf,
            restaurant.id,
            -loyaltyPointsUsed,
            order.id,
            "redeem"
          );
        }

        const pointsToEarn = Math.floor(subtotal * (restaurant.loyalty_points_per_real || 1));
        if (pointsToEarn > 0) {
          await updateLoyaltyPoints(
            customerData.cpf,
            restaurant.id,
            pointsToEarn,
            order.id,
            "earn"
          );
        }
      }

      if (deliveryType === "delivery" && addressData?.saveForLater) {
        await supabase.from("customer_addresses").insert({
          customer_cpf: customerData.cpf,
          customer_name: customerData.name,
          customer_phone: customerData.phone,
          ...addressData.address,
          is_default: addressData.isFirstAddress,
        });
      }

      localStorage.removeItem(`delivery-cart-${restaurantSlug}`);
      onClearCart();

      navigate(`/delivery/${restaurantSlug}/pedido/${order.id}`);
      toast.success("Pedido realizado com sucesso! 🎉");
    } catch (error: any) {
      console.error("Erro ao finalizar pedido:", error);
      const errorMessage = error?.message 
        ? `Erro: ${error.message}` 
        : "Erro ao finalizar pedido. Tente novamente.";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const updateLoyaltyPoints = async (
    cpf: string,
    restaurantId: string,
    points: number,
    orderId: string,
    type: "earn" | "redeem"
  ) => {
    const { data: existing } = await supabase
      .from("loyalty_points")
      .select("*")
      .eq("customer_cpf", cpf)
      .eq("restaurant_id", restaurantId)
      .single();

    if (existing) {
      const newBalance = existing.points_balance + points;
      const newEarned = type === "earn" ? existing.total_earned + points : existing.total_earned;
      const newRedeemed = type === "redeem" ? existing.total_redeemed + Math.abs(points) : existing.total_redeemed;

      await supabase
        .from("loyalty_points")
        .update({
          points_balance: newBalance,
          total_earned: newEarned,
          total_redeemed: newRedeemed,
          last_updated: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("loyalty_points").insert({
        customer_cpf: cpf,
        restaurant_id: restaurantId,
        points_balance: points > 0 ? points : 0,
        total_earned: points > 0 ? points : 0,
        total_redeemed: points < 0 ? Math.abs(points) : 0,
      });
    }

    await supabase.from("loyalty_transactions").insert({
      customer_cpf: cpf,
      restaurant_id: restaurantId,
      order_id: orderId,
      points,
      type,
    });
  };

  const calculateCouponDiscount = (subtotal: number, coupon: any) => {
    if (coupon.discount_type === "percentage") {
      const discount = subtotal * (coupon.discount_value / 100);
      return coupon.max_discount ? Math.min(discount, coupon.max_discount) : discount;
    }
    return coupon.discount_value;
  };

  const formatAddress = (address: any) => {
    return `${address.street}, ${address.number}${address.complement ? `, ${address.complement}` : ""} - ${address.neighborhood}, ${address.city}/${address.state} - CEP: ${address.zip_code}`;
  };

  const handleAddRewardItem = async (reward: Reward) => {
    if (!reward.product || !onAddRewardItem) return;

    // Check if this reward is already in the cart
    const existingRewardItem = cart.find(item => item.rewardId === reward.id);
    if (existingRewardItem) {
      toast.error("Esta recompensa já está na sacola");
      return;
    }

    // Build extras array if there's a specific extra for this reward
    const extras: Array<{ id: string; name: string; price: number }> = [];
    if (reward.extra) {
      extras.push({
        id: reward.extra.id,
        name: reward.extra.name,
        price: 0, // Free because it's part of the reward
      });
    }

    const rewardCartItem: CartItem = {
      id: `reward-${reward.id}-${Date.now()}`,
      product: {
        id: reward.product.id,
        name: reward.product.name,
        description: null,
        price: 0, // FREE
        promotional_price: null,
        available: true,
        image_url: reward.product.image_url,
      },
      quantity: 1,
      extras,
      notes: "Recompensa do programa de fidelidade",
      isRewardItem: true,
      rewardId: reward.id,
    };

    onAddRewardItem(rewardCartItem);
    toast.success(`${reward.product.name} adicionado como recompensa!`);
  };

  // Get customer CPF from prop or sessionStorage
  const getCustomerCPF = () => {
    return customerCPFProp || sessionStorage.getItem("customer_cpf") || "";
  };

  const renderStep = () => {
    switch (step) {
      case "cart":
        return (
          <CartStep
            cart={cart}
            restaurant={restaurant}
            onUpdateQuantity={onUpdateQuantity}
            onClearCart={onClearCart}
            coupon={coupon}
            onApplyCoupon={setCoupon}
            loyaltyPoints={loyaltyPoints}
            loyaltyPointsUsed={loyaltyPointsUsed}
            onRedeemPoints={setLoyaltyPointsUsed}
            onContinue={() => setStep("delivery-type")}
            minOrderValue={getMinOrderValue()}
            deliveryType={deliveryType}
            customerCPF={getCustomerCPF()}
            onAddRewardItem={onAddRewardItem ? handleAddRewardItem : undefined}
          />
        );
      case "delivery-type":
        return (
          <DeliveryTypeStep
            selected={deliveryType}
            onSelect={setDeliveryType}
            onBack={() => setStep("cart")}
            onContinue={() => {
              if (deliveryType === "delivery") {
                setStep("address");
              } else {
                setStep("payment");
              }
            }}
            storeAddress={restaurant.store_address}
            restaurantId={restaurant.id}
          />
        );
      case "address":
        return (
          <AddressStep
            onBack={() => setStep("delivery-type")}
            onContinue={(data) => {
              setCustomerData({ name: data.customerName, cpf: data.customerCPF, phone: data.customerPhone });
              setAddressData(data);
              
              // Salvar zona de entrega encontrada
              if (data.deliveryZone) {
                setDeliveryZone(data.deliveryZone);
              }
              
              setStep("payment");
              
              if (restaurant.loyalty_enabled && data.customerCPF) {
                fetchLoyaltyPoints(data.customerCPF);
              }
            }}
            restaurantSlug={restaurantSlug}
            restaurantId={restaurant.id}
            primaryColor={primaryColorFromRestaurant(restaurant)}
          />
        );
      case "payment":
        const couponDiscount = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
        const loyaltyDiscount = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
        const deliveryFee = getDeliveryFee();
        const serviceFee = restaurant.service_fee_enabled 
          ? (subtotal * restaurant.service_fee_percentage / 100) 
          : 0;
        
        const orderTotal = subtotal + serviceFee + deliveryFee - couponDiscount - loyaltyDiscount;

        return (
          <PaymentStep
            onBack={() => deliveryType === "delivery" ? setStep("address") : setStep("delivery-type")}
            requireCustomerInfo={deliveryType === "pickup"}
            orderTotal={orderTotal}
            restaurantId={restaurant.id}
            primaryColor={primaryColorFromRestaurant(restaurant)}
            onContinue={(data) => {
              setPaymentData(data);
              
              if (deliveryType === "pickup") {
                const cpf = sessionStorage.getItem("customer_cpf") || "";
                const name = sessionStorage.getItem("customer_name") || "";
                const phone = sessionStorage.getItem("customer_phone") || "";
                setCustomerData({ name, cpf, phone });
                
                if (restaurant.loyalty_enabled && cpf) {
                  fetchLoyaltyPoints(cpf);
                }
              }
              
              setStep("summary");
            }}
          />
        );
      case "summary":
        return (
          <SummaryStep
            cart={cart}
            restaurant={restaurant}
            customerData={customerData}
            addressData={addressData}
            paymentData={paymentData}
            coupon={coupon}
            loyaltyPointsUsed={loyaltyPointsUsed}
            deliveryType={deliveryType}
            onBack={() => setStep("payment")}
            onConfirm={handleFinishOrder}
            submitting={submitting}
            deliveryZone={deliveryZone}
          />
        );
    }
  };

  const fetchLoyaltyPoints = async (cpf: string) => {
    const { data } = await supabase
      .from("loyalty_points")
      .select("points_balance")
      .eq("customer_cpf", cpf)
      .eq("restaurant_id", restaurant.id)
      .single();

    setLoyaltyPoints(data?.points_balance || 0);
  };

  if (mode === "local") {
    return null;
  }

  return (
    <Drawer open={open} onOpenChange={onClose}>
      <DrawerContent className="max-h-[95vh]">
        <DrawerHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={onClose} className="text-muted-foreground">
              ✕
            </button>
            <DrawerTitle className="text-lg font-bold">
              {step === "cart" && "Sacola"}
              {step === "delivery-type" && "Tipo de Entrega"}
              {step === "address" && "Endereço de Entrega"}
              {step === "payment" && "Forma de Pagamento"}
              {step === "summary" && "Confirmar Pedido"}
            </DrawerTitle>
            <div className="w-6" />
          </div>
          <Progress value={getProgressValue()} className="h-1" />
        </DrawerHeader>

        <div className="overflow-y-auto flex-1">
          {renderStep()}
        </div>
      </DrawerContent>
    </Drawer>
  );
};