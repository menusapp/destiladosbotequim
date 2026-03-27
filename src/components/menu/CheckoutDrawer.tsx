import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Progress } from "@/components/ui/progress";
import { CartStep } from "./checkout/CartStep";
import { AddressStep } from "./checkout/AddressStep";
import { PaymentStep } from "./checkout/PaymentStep";
import { SummaryStep } from "./checkout/SummaryStep";
import { OnlinePaymentStep } from "./checkout/OnlinePaymentStep";
import { DeliveryTypeStep } from "./checkout/DeliveryTypeStep";
import { CartItem } from "@/types/menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { DiscountReward } from "./checkout/LoyaltyRewardNotification";

type CheckoutStep = "cart" | "delivery-type" | "address" | "payment" | "online-payment" | "summary";

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
  onSuggestionClick?: (product: any) => void;
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
  onSuggestionClick,
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
  const [activeRewardDiscount, setActiveRewardDiscount] = useState<DiscountReward | null>(null);

  useEffect(() => {
    if (open) {
      setStep("cart");
    }
  }, [open]);

  const getProgressValue = () => {
    const steps: Record<CheckoutStep, number> = { 
      cart: 16, "delivery-type": 32, address: 48, payment: 64, "online-payment": 80, summary: 100 
    };
    return steps[step];
  };

  // Calcular subtotal (reward items and coupon free items don't count - they're free)
  const subtotal = cart.reduce((sum, item) => {
    if (item.isRewardItem || item.isCouponFreeItem) return sum;
    const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
    const effectivePrice = item.product.promotional_price ?? item.product.price;
    return sum + (effectivePrice + extrasTotal) * item.quantity;
  }, 0);

  // Usar taxa de entrega da zona encontrada ou do restaurante como fallback
  const getDeliveryFee = () => {
    if (deliveryType === "pickup") return 0;
    // If free delivery reward is active, return 0
    if (activeRewardDiscount?.type === "free_delivery") return 0;
    if (deliveryZone) return deliveryZone.delivery_fee || 0;
    return restaurant.delivery_fee || 0;
  };

  // Verificar pedido mínimo
  const getMinOrderValue = () => {
    if (deliveryType === "pickup") return 0;
    if (deliveryZone) return deliveryZone.min_order_value || 0;
    return restaurant.min_order_value || 0;
  };

  // Calculate reward discount
  const calculateRewardDiscount = (subtotal: number): number => {
    if (!activeRewardDiscount) return 0;
    
    switch (activeRewardDiscount.type) {
      case "discount_percentage":
        return subtotal * (activeRewardDiscount.value / 100);
      case "discount_fixed":
        return Math.min(activeRewardDiscount.value, subtotal);
      case "free_delivery":
        return 0; // Handled in getDeliveryFee
      default:
        return 0;
    }
  };

  const handleFinishOrder = async (onlinePaymentId?: string) => {
    if (submitting) return;
    
    setSubmitting(true);
    try {
      const couponDiscount = Math.round((coupon ? calculateCouponDiscount(subtotal, coupon) : 0) * 100) / 100;
      const loyaltyDiscount = Math.round((loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01)) * 100) / 100;
      const rewardDiscount = Math.round(calculateRewardDiscount(subtotal) * 100) / 100;
      const deliveryFee = Math.round(getDeliveryFee() * 100) / 100;
      const serviceFee = Math.round((restaurant.service_fee_enabled 
        ? (subtotal * restaurant.service_fee_percentage / 100) 
        : 0) * 100) / 100;

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
        payment_type: paymentData?.method || (onlinePaymentId ? "online" : "pending"),
        payment_brand: paymentData?.payment_brand || null,
        coupon_code: coupon?.code,
        coupon_discount: couponDiscount,
        delivery_fee: deliveryFee,
        loyalty_points_used: loyaltyPointsUsed,
        loyalty_points_earned: Math.floor(subtotal * (restaurant.loyalty_points_per_real || 1)),
        status: "pending",
        payment_status: onlinePaymentId ? "paid" : "pending",
        notes: paymentData?.changeFor ? `Troco para: R$ ${paymentData.changeFor}` : null,
        online_payment_id: onlinePaymentId || paymentData?.onlinePaymentId || null,
        reward_discount: rewardDiscount,
        reward_id: activeRewardDiscount?.id || null,
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
        // For reward items or coupon free items, price_at_order should be 0
        const priceAtOrder = (item.isRewardItem || item.isCouponFreeItem) 
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

        // For reward/coupon items with extras, price should also be 0
        for (const extra of item.extras) {
          await supabase.from("order_item_extras").insert({
            order_item_id: orderItem.id,
            product_extra_id: (extra as any).is_complement ? null : extra.id,
            price_at_order: (item.isRewardItem || item.isCouponFreeItem) ? 0 : extra.price,
          });
        }
      }

      // Record loyalty reward redemptions for reward items (free_item type)
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
            // Security: check if reward was already redeemed
            const { data: existingRedemption } = await supabase
              .from("loyalty_reward_redemptions")
              .select("id")
              .eq("restaurant_id", restaurant.id)
              .eq("customer_cpf", customerData.cpf)
              .eq("program_id", activeProgram.id)
              .eq("reward_id", rewardItem.rewardId)
              .maybeSingle();

            if (existingRedemption) {
              console.warn("Reward already redeemed, skipping:", rewardItem.rewardId);
              continue;
            }

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

      // Record redemption for discount rewards
      if (activeRewardDiscount) {
        // Security: check if discount reward was already redeemed
        const { data: existingDiscountRedemption } = await supabase
          .from("loyalty_reward_redemptions")
          .select("id")
          .eq("restaurant_id", restaurant.id)
          .eq("customer_cpf", customerData.cpf)
          .eq("reward_id", activeRewardDiscount.id)
          .maybeSingle();

        if (!existingDiscountRedemption) {
          await supabase.from("loyalty_reward_redemptions").insert({
            restaurant_id: restaurant.id,
            customer_cpf: customerData.cpf,
            program_id: activeRewardDiscount.programId,
            reward_id: activeRewardDiscount.id,
            order_id: order.id,
            trigger_value: activeRewardDiscount.triggerValue,
            redeemed_at: new Date().toISOString(),
          });
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
      onClose();

      navigate(`/${restaurantSlug}/pedido/${order.id}`);
      toast.success("Pedido realizado com sucesso! 🎉");
    } catch (error: any) {
      console.error("Erro ao finalizar pedido:", error);
      const errorMessage = error?.message 
        ? `Erro: ${error.message}` 
        : "Erro ao finalizar pedido. Tente novamente.";
      toast.error(errorMessage);
      // Reset to payment step so user isn't stuck on loading screen
      setStep("payment");
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
    // Free product coupons don't apply a monetary discount
    if (coupon.coupon_type === "free_product") {
      return 0;
    }
    if (coupon.coupon_type === "free_delivery") {
      return 0; // Handled in getDeliveryFee
    }
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

  const handleRedeemDiscount = (discount: DiscountReward) => {
    setActiveRewardDiscount(discount);
    toast.success("Desconto de fidelidade aplicado!");
  };

  const handleClearRewardDiscount = () => {
    setActiveRewardDiscount(null);
  };

  // Handle coupon application with free product logic
  const handleApplyCoupon = (couponData: any) => {
    // If removing coupon, also remove free item from cart
    if (!couponData && coupon?.coupon_type === "free_product" && onAddRewardItem) {
      // Note: We can't remove items directly, the free item stays but that's ok
      // since it's already marked as free
    }
    
    // If applying a free product coupon, add the item to cart
    if (couponData?.coupon_type === "free_product" && couponData.freeProduct && onAddRewardItem) {
      // Check if this coupon's free item is already in the cart
      const existingFreeItem = cart.find(item => item.couponId === couponData.id);
      if (!existingFreeItem) {
        // Build extras array if there's a specific extra for this coupon
        const extras: Array<{ id: string; name: string; price: number }> = [];
        if (couponData.freeProductExtra) {
          extras.push({
            id: couponData.freeProductExtra.id,
            name: couponData.freeProductExtra.name,
            price: 0, // Free because it's part of the coupon
          });
        }

        const freeCartItem: CartItem = {
          id: `coupon-free-${couponData.id}-${Date.now()}`,
          product: {
            id: couponData.freeProduct.id,
            name: couponData.freeProduct.name,
            description: null,
            price: 0, // FREE
            promotional_price: null,
            available: true,
            image_url: couponData.freeProduct.image_url,
          },
          quantity: 1,
          extras,
          notes: `Cupom ${couponData.code}`,
          isCouponFreeItem: true,
          couponId: couponData.id,
        };

        onAddRewardItem(freeCartItem);
      }
    }
    
    setCoupon(couponData);
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
            onApplyCoupon={handleApplyCoupon}
            loyaltyPoints={loyaltyPoints}
            loyaltyPointsUsed={loyaltyPointsUsed}
            onRedeemPoints={setLoyaltyPointsUsed}
            onContinue={() => setStep("delivery-type")}
            minOrderValue={getMinOrderValue()}
            deliveryType={deliveryType}
            customerCPF={getCustomerCPF()}
            onAddRewardItem={onAddRewardItem ? handleAddRewardItem : undefined}
            onRedeemDiscount={handleRedeemDiscount}
            activeRewardDiscount={activeRewardDiscount}
            onClearRewardDiscount={handleClearRewardDiscount}
            onSuggestionClick={onSuggestionClick}
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
        const rewardDiscount = calculateRewardDiscount(subtotal);
        const deliveryFee = getDeliveryFee();
        const serviceFee = restaurant.service_fee_enabled 
          ? (subtotal * restaurant.service_fee_percentage / 100) 
          : 0;
        
        const orderTotal = Math.max(0, Math.round((subtotal + serviceFee + deliveryFee - couponDiscount - loyaltyDiscount - rewardDiscount) * 100) / 100);

        return (
          <PaymentStep
            onBack={() => deliveryType === "delivery" ? setStep("address") : setStep("delivery-type")}
            requireCustomerInfo={deliveryType === "pickup"}
            orderTotal={orderTotal}
            restaurantId={restaurant.id}
            primaryColor={primaryColorFromRestaurant(restaurant)}
            customerCPF={customerData?.cpf || getCustomerCPF() || sessionStorage.getItem(`delivery-cpf-${restaurantSlug}`) || ""}
            customerName={customerData?.name || sessionStorage.getItem("customer_name") || sessionStorage.getItem(`delivery-customer-${restaurantSlug}`) || ""}
            customerPhone={customerData?.phone || sessionStorage.getItem("customer_phone") || sessionStorage.getItem(`delivery-phone-${restaurantSlug}`) || ""}
            customerEmail={sessionStorage.getItem("customer_email") || ""}
            onContinue={(data) => {
              setPaymentData(data);
              
              if (deliveryType === "pickup") {
                const cpf = sessionStorage.getItem("customer_cpf") || sessionStorage.getItem(`delivery-cpf-${restaurantSlug}`) || "";
                const name = sessionStorage.getItem("customer_name") || sessionStorage.getItem(`delivery-customer-${restaurantSlug}`) || "";
                const phone = sessionStorage.getItem("customer_phone") || sessionStorage.getItem(`delivery-phone-${restaurantSlug}`) || "";
                setCustomerData({ name, cpf, phone });
                
                if (restaurant.loyalty_enabled && cpf) {
                  fetchLoyaltyPoints(cpf);
                }
              }
              
              // If online payment, go to online-payment step
              if (data.isOnlinePayment) {
                // Recalculate total to check if payment is actually needed
                const cd2 = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
                const ld2 = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
                const rd2 = calculateRewardDiscount(subtotal);
                const df2 = getDeliveryFee();
                const sf2 = restaurant.service_fee_enabled ? (subtotal * restaurant.service_fee_percentage / 100) : 0;
                const finalTotal = Math.max(0, Math.round((subtotal + sf2 + df2 - cd2 - ld2 - rd2) * 100) / 100);
                
                if (finalTotal < 1) {
                  toast.success("Desconto aplicado! Pedido sem custo adicional.");
                  setStep("summary");
                } else {
                  setStep("online-payment");
                }
              } else {
                setStep("summary");
              }
            }}
          />
        );
      case "online-payment":
        const onlineTotal = (() => {
          const cd = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
          const ld = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
          const rd = calculateRewardDiscount(subtotal);
          const df = getDeliveryFee();
          const sf = restaurant.service_fee_enabled ? (subtotal * restaurant.service_fee_percentage / 100) : 0;
          const raw = subtotal + sf + df - cd - ld - rd;
          return Math.max(0, Math.round(raw * 100) / 100);
        })();

        return (
          <OnlinePaymentStep
            onBack={() => setStep("payment")}
            onConfirm={(onlinePaymentId) => {
              // Online payment confirmed — skip summary, submit order directly
              setPaymentData((prev: any) => ({ 
                ...prev, 
                onlinePaymentId,
                confirmed: true,
                isOnlinePayment: true,
              }));
              handleFinishOrder(onlinePaymentId);
            }}
            method={paymentData?.onlineMethod || "pix"}
            amount={onlineTotal}
            restaurantId={restaurant.id}
            orderId={undefined}
            customerName={customerData?.name || sessionStorage.getItem("customer_name") || ""}
            customerCPF={customerData?.cpf || sessionStorage.getItem("customer_cpf") || ""}
            customerPhone={customerData?.phone || sessionStorage.getItem("customer_phone") || ""}
            customerEmail={paymentData?.customerEmail || sessionStorage.getItem("customer_email") || ""}
            primaryColor={primaryColorFromRestaurant(restaurant)}
            cartItems={cart.filter(i => !i.isRewardItem && !i.isCouponFreeItem).map(i => ({
              id: i.product.id,
              name: i.product.name,
              quantity: i.quantity,
              unit_price: i.product.promotional_price ?? i.product.price,
            }))}
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
            onConfirm={() => handleFinishOrder()}
            submitting={submitting}
            deliveryZone={deliveryZone}
            activeRewardDiscount={activeRewardDiscount}
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
              {step === "online-payment" && "Pagamento Online"}
              {step === "summary" && "Confirmar Pedido"}
            </DrawerTitle>
            <div className="w-6" />
          </div>
          <Progress value={getProgressValue()} className="h-1" />
        </DrawerHeader>

        <div className="overflow-y-auto flex-1" data-vaul-no-drag>
          {renderStep()}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
