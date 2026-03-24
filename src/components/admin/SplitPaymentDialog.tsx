import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: {
    id: string;
    quantity: number;
    price_at_order: number;
    products?: { name: string } | null;
    order_item_extras?: Array<{ price_at_order: number }>;
  };
  orderId: string;
  restaurantId: string;
  onSplitCreated: () => void;
}

export function SplitPaymentDialog({
  open, onOpenChange, item, orderId, restaurantId, onSplitCreated,
}: SplitPaymentDialogProps) {
  const [tab, setTab] = useState("equal");
  const [splitCount, setSplitCount] = useState(2);
  const [customAmount, setCustomAmount] = useState("");

  const extrasTotal = item.order_item_extras?.reduce((s, e) => s + e.price_at_order, 0) || 0;
  const itemTotal = (item.price_at_order + extrasTotal) * item.quantity;
  const perPart = itemTotal / splitCount;

  const handleEqualSplit = async () => {
    if (splitCount < 2 || splitCount > 20) {
      toast.error("Divida entre 2 e 20 partes");
      return;
    }

    const splits = Array.from({ length: splitCount }, (_, i) => ({
      order_item_id: item.id,
      order_id: orderId,
      restaurant_id: restaurantId,
      split_number: i + 1,
      total_splits: splitCount,
      value: Math.round((itemTotal / splitCount) * 100) / 100,
      status: "pending",
    }));

    // Adjust last split for rounding
    const sumSoFar = splits.slice(0, -1).reduce((s, sp) => s + sp.value, 0);
    splits[splits.length - 1].value = Math.round((itemTotal - sumSoFar) * 100) / 100;

    const { error } = await supabase.from("order_item_splits" as any).insert(splits);
    if (error) {
      toast.error("Erro ao dividir item");
      return;
    }
    toast.success(`Item dividido em ${splitCount} partes`);
    onSplitCreated();
    onOpenChange(false);
  };

  const handleCustomSplit = async () => {
    const amount = parseFloat(customAmount);
    if (isNaN(amount) || amount <= 0 || amount >= itemTotal) {
      toast.error("Digite um valor válido menor que o total do item");
      return;
    }

    const remainder = Math.round((itemTotal - amount) * 100) / 100;
    const splits = [
      {
        order_item_id: item.id,
        order_id: orderId,
        restaurant_id: restaurantId,
        split_number: 1,
        total_splits: 2,
        value: amount,
        status: "pending",
      },
      {
        order_item_id: item.id,
        order_id: orderId,
        restaurant_id: restaurantId,
        split_number: 2,
        total_splits: 2,
        value: remainder,
        status: "pending",
      },
    ];

    const { error } = await supabase.from("order_item_splits" as any).insert(splits);
    if (error) {
      toast.error("Erro ao dividir item");
      return;
    }
    toast.success("Item dividido");
    onSplitCreated();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            Dividir: {item.products?.name || "Item"}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Total: R$ {itemTotal.toFixed(2)}
          </p>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full">
            <TabsTrigger value="equal" className="flex-1">Partes iguais</TabsTrigger>
            <TabsTrigger value="custom" className="flex-1">Valor específico</TabsTrigger>
          </TabsList>

          <TabsContent value="equal" className="space-y-4 pt-4">
            <div>
              <Label>Dividir em quantas partes?</Label>
              <Input
                type="number"
                min={2}
                max={20}
                value={splitCount}
                onChange={(e) => setSplitCount(Math.max(2, Math.min(20, parseInt(e.target.value) || 2)))}
              />
            </div>
            <div className="p-3 bg-muted rounded-lg text-center">
              <p className="text-lg font-bold">{splitCount}x R$ {perPart.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">cada parte</p>
            </div>
            <Button onClick={handleEqualSplit} className="w-full">
              Confirmar Divisão
            </Button>
          </TabsContent>

          <TabsContent value="custom" className="space-y-4 pt-4">
            <div>
              <Label>Quanto vai pagar deste item?</Label>
              <Input
                type="number"
                step="0.01"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {customAmount && parseFloat(customAmount) > 0 && parseFloat(customAmount) < itemTotal && (
              <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Pagando:</span>
                  <span className="font-bold">R$ {parseFloat(customAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Resta:</span>
                  <span>R$ {(itemTotal - parseFloat(customAmount)).toFixed(2)}</span>
                </div>
              </div>
            )}
            <Button onClick={handleCustomSplit} className="w-full">
              Confirmar Divisão
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
