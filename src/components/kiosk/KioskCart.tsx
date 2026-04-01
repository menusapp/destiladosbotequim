import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Minus, Plus, Trash2 } from "lucide-react";
import { CartItem } from "@/types/menu";

interface Props {
  cart: CartItem[];
  primaryColor: string;
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  cartTotal: number;
  onBack: () => void;
  onNext: () => void;
}

export function KioskCart({ cart, primaryColor, onUpdateQuantity, onRemove, cartTotal, onBack, onNext }: Props) {
  if (cart.length === 0) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center gap-4 p-6 border-b bg-card">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-14 w-14 rounded-full">
            <ArrowLeft className="h-8 w-8" />
          </Button>
          <h2 className="text-2xl font-bold text-foreground">Seu Pedido</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-6xl mb-4">🛒</p>
            <p className="text-xl text-muted-foreground">Seu carrinho está vazio</p>
            <Button variant="outline" className="mt-6 h-14 text-lg px-8 rounded-xl" onClick={onBack}>Voltar ao cardápio</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="flex items-center gap-4 p-6 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-14 w-14 rounded-full">
          <ArrowLeft className="h-8 w-8" />
        </Button>
        <h2 className="text-2xl font-bold text-foreground">Seu Pedido</h2>
        <span className="ml-auto text-lg text-muted-foreground">{cart.length} {cart.length === 1 ? "item" : "itens"}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-4 max-w-2xl mx-auto">
          {cart.map(item => {
            const price = item.product.promotional_price ?? item.product.price;
            const extrasTotal = item.extras.reduce((s, e) => s + e.price, 0);
            const itemTotal = (price + extrasTotal) * item.quantity;

            return (
              <div key={item.id} className="flex items-start gap-4 p-4 bg-card rounded-xl border">
                {item.product.image_url && (
                  <img src={item.product.image_url} className="h-20 w-20 rounded-xl object-cover shrink-0" alt="" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg text-foreground truncate">{item.product.name}</p>
                  {item.extras.length > 0 && (
                    <p className="text-sm text-muted-foreground truncate">
                      {item.extras.map(e => e.name).join(", ")}
                    </p>
                  )}
                  {item.notes && <p className="text-sm text-muted-foreground italic">"{item.notes}"</p>}
                  <p className="font-bold text-lg mt-1" style={{ color: primaryColor }}>R$ {itemTotal.toFixed(2)}</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onRemove(item.id)} className="h-10 w-10 text-destructive">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center gap-2 bg-muted rounded-xl p-1">
                    <Button variant="ghost" size="icon" onClick={() => onUpdateQuantity(item.id, -1)} className="h-10 w-10 rounded-lg">
                      <Minus className="h-5 w-5" />
                    </Button>
                    <span className="text-xl font-bold w-6 text-center text-foreground">{item.quantity}</span>
                    <Button variant="ghost" size="icon" onClick={() => onUpdateQuantity(item.id, 1)} className="h-10 w-10 rounded-lg">
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="border-t bg-card p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xl font-medium text-foreground">Total</span>
            <span className="text-3xl font-bold" style={{ color: primaryColor }}>R$ {cartTotal.toFixed(2)}</span>
          </div>
          <Button onClick={onNext} className="w-full h-16 text-xl font-bold rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
}
