import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CartStep } from "./checkout/CartStep";
import { AddressStep } from "./checkout/AddressStep";
import { PaymentStep } from "./checkout/PaymentStep";
import { SummaryStep } from "./checkout/SummaryStep";
import { CartItem } from "@/types/menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type CheckoutStep = "cart" | "address" | "payment" | "summary";

interface CheckoutDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  restaurant: any;
  onUpdateQuantity: (itemId: string, delta: number) => void;
  onClearCart: () => void;
  mode: "delivery" | "local";
  restaurantSlug?: string;
}

export const CheckoutDrawer = ({
  open,
  onClose,
  cart,
  restaurant,
  onUpdateQuantity,
  onClearCart,
  mode,
  restaurantSlug,
}: CheckoutDrawerProps) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<CheckoutStep>("cart");
  const [coupon, setCoupon] = useState<any>(null);
  const [customerData, setCustomerData] = useState<any>(null);
  const [addressData, setAddressData] = useState<any>(null);
  const [paymentData, setPaymentData] = useState<any>(null);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointsUsed, setLoyaltyPointsUsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("cart");
    }
  }, [open]);

  const getProgressValue = () => {
    const steps = { cart: 25, address: 50, payment: 75, summary: 100 };
    return steps[step];
  };

  const handleFinishOrder = async () => {
    if (submitting) return;
    
    setSubmitting(true);
    try {
      // 1. Calcular valores
      const subtotal = cart.reduce((sum, item) => {
        const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
        return sum + (item.product.price + extrasTotal) * item.quantity;
      }, 0);

      const couponDiscount = coupon ? calculateCouponDiscount(subtotal, coupon) : 0;
      const loyaltyDiscount = loyaltyPointsUsed * (restaurant.loyalty_real_per_point || 0.01);
      const deliveryFee = restaurant.delivery_fee || 0;
      const serviceFee = restaurant.service_fee_enabled 
        ? (subtotal * restaurant.service_fee_percentage / 100) 
        : 0;

      // 2. Criar pedido (delivery sem table_id)
      const orderData: any = {
        table_id: null,
        restaurant_id: restaurant.id,
        customer_name: customerData.name,
          customer_cpf: customerData.cpf,
          order_type: "delivery",
          delivery_address: formatAddress(addressData.address),
          delivery_phone: customerData.phone,
          delivery_neighborhood: addressData.address.neighborhood,
          delivery_city: addressData.address.city,
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

      // 4. Criar itens do pedido
      for (const item of cart) {
        const { data: orderItem, error: itemError } = await supabase
          .from("order_items")
          .insert({
            order_id: order.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price_at_order: item.product.price,
            notes: item.notes,
          })
          .select()
          .single();

        if (itemError) throw itemError;

        // 5. Criar extras dos itens
        for (const extra of item.extras) {
          await supabase.from("order_item_extras").insert({
            order_item_id: orderItem.id,
            product_extra_id: extra.id,
            price_at_order: extra.price,
          });
        }
      }

      // 6. Atualizar cupom
      if (coupon) {
        await supabase
          .from("coupons")
          .update({ used_count: coupon.used_count + 1 })
          .eq("id", coupon.id);
      }

      // 7. Gerenciar pontos de fidelidade
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

      // 8. Salvar endereço se solicitado
      if (addressData.saveForLater) {
        await supabase.from("customer_addresses").insert({
          customer_cpf: customerData.cpf,
          customer_name: customerData.name,
          customer_phone: customerData.phone,
          ...addressData.address,
          is_default: addressData.isFirstAddress,
        });
      }

      // 9. Limpar carrinho
      localStorage.removeItem(`delivery-cart-${restaurantSlug}`);
      onClearCart();

      // 10. Redirecionar
      navigate(`/delivery/${restaurant.slug}/pedido/${order.id}`);
      toast.success("Pedido realizado com sucesso! 🎉");
    } catch (error: any) {
      console.error("Erro ao finalizar pedido:", error);
      console.error("Detalhes do erro:", error?.message || error);
      
      // Mensagem de erro mais específica
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
    // Buscar ou criar registro de pontos
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

    // Criar transação
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
            onContinue={() => setStep("address")}
          />
        );
      case "address":
        return (
          <AddressStep
            onBack={() => setStep("cart")}
            onContinue={(data) => {
              setCustomerData({ name: data.customerName, cpf: data.customerCPF, phone: data.customerPhone });
              setAddressData(data);
              setStep("payment");
              
              // Buscar pontos de fidelidade se habilitado
              if (restaurant.loyalty_enabled && data.customerCPF) {
                fetchLoyaltyPoints(data.customerCPF);
              }
            }}
            restaurantSlug={restaurantSlug}
          />
        );
      case "payment":
        return (
          <PaymentStep
            onBack={() => setStep("address")}
            onContinue={(data) => {
              setPaymentData(data);
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
            onBack={() => setStep("payment")}
            onConfirm={handleFinishOrder}
            submitting={submitting}
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
    // Renderizar o antigo CartDrawer para modo local
    return null; // Implementar depois se necessário
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
