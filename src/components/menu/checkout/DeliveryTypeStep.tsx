import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Truck, Store, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface DeliveryTypeStepProps {
  selected: "delivery" | "pickup";
  onSelect: (type: "delivery" | "pickup") => void;
  onBack: () => void;
  onContinue: () => void;
  storeAddress?: string;
  restaurantId?: string;
}

export const DeliveryTypeStep = ({
  selected,
  onSelect,
  onBack,
  onContinue,
  storeAddress,
  restaurantId
}: DeliveryTypeStepProps) => {
  const [hasDeliveryZones, setHasDeliveryZones] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDeliveryZones = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("delivery_zones")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .limit(1);

      if (!error) {
        const hasZones = data && data.length > 0;
        setHasDeliveryZones(hasZones);
        
        // Se não há zonas de entrega, forçar seleção de retirada
        if (!hasZones) {
          onSelect("pickup");
        }
      }
      setLoading(false);
    };

    checkDeliveryZones();
  }, [restaurantId, onSelect]);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h3 className="text-lg font-semibold">Como deseja receber?</h3>
      
      {!hasDeliveryZones && (
        <Card className="p-4 border-amber-500 bg-amber-500/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <p className="text-sm text-amber-700">
              Apenas retirada disponível no momento
            </p>
          </div>
        </Card>
      )}
      
      <div className="grid grid-cols-1 gap-3">
        <Card
          className={`p-4 transition-all ${
            !hasDeliveryZones 
              ? "opacity-50 cursor-not-allowed bg-muted" 
              : selected === "delivery" 
                ? "border-primary border-2 bg-primary/5 cursor-pointer" 
                : "border-muted hover:border-primary/50 cursor-pointer"
          }`}
          onClick={() => hasDeliveryZones && onSelect("delivery")}
        >
          <div className="flex items-center gap-3">
            <Truck className="w-6 h-6" />
            <div>
              <p className="font-semibold">Entrega</p>
              <p className="text-sm text-muted-foreground">
                {hasDeliveryZones 
                  ? "Receba em seu endereço" 
                  : "Indisponível - sem regiões de entrega configuradas"}
              </p>
            </div>
          </div>
        </Card>

        <Card
          className={`p-4 cursor-pointer transition-all ${
            selected === "pickup" 
              ? "border-primary border-2 bg-primary/5" 
              : "border-muted hover:border-primary/50"
          }`}
          onClick={() => onSelect("pickup")}
        >
          <div className="flex items-center gap-3">
            <Store className="w-6 h-6" />
            <div>
              <p className="font-semibold">Retirada</p>
              <p className="text-sm text-muted-foreground">
                Retire na loja
              </p>
              {storeAddress && (
                <p className="text-xs text-muted-foreground mt-1">
                  📍 {storeAddress}
                </p>
              )}
            </div>
          </div>
        </Card>
      </div>

      <div className="flex gap-2 pt-4 relative z-50 pointer-events-auto pb-safe" data-vaul-no-drag>
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button onClick={onContinue} className="flex-1">
          Continuar
        </Button>
      </div>
    </div>
  );
};