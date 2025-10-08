import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface ProductExtra {
  id: string;
  name: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
}

interface ProductDetailDialogProps {
  product: Product | null;
  extras: ProductExtra[];
  open: boolean;
  onClose: () => void;
  onAddToCart: (product: Product, selectedExtras: ProductExtra[]) => void;
}

const ProductDetailDialog = ({
  product,
  extras,
  open,
  onClose,
  onAddToCart,
}: ProductDetailDialogProps) => {
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  if (!product) return null;

  const handleExtraToggle = (extraId: string) => {
    setSelectedExtras((prev) =>
      prev.includes(extraId)
        ? prev.filter((id) => id !== extraId)
        : [...prev, extraId]
    );
  };

  const handleAddToCart = () => {
    const extrasToAdd = extras.filter((e) => selectedExtras.includes(e.id));
    onAddToCart(product, extrasToAdd);
    setSelectedExtras([]);
    onClose();
  };

  const getTotalPrice = () => {
    const extrasTotal = extras
      .filter((e) => selectedExtras.includes(e.id))
      .reduce((sum, e) => sum + e.price, 0);
    return product.price + extrasTotal;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          {product.description && (
            <DialogDescription>{product.description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {product.image_url && (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-48 object-cover rounded-lg"
            />
          )}

          <div className="space-y-2">
            <p className="text-2xl font-bold text-primary">
              R$ {product.price.toFixed(2)}
            </p>

            {extras.length > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-secondary/20">
                <h4 className="font-semibold">Adicionais</h4>
                {extras.map((extra) => (
                  <div key={extra.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={extra.id}
                      checked={selectedExtras.includes(extra.id)}
                      onCheckedChange={() => handleExtraToggle(extra.id)}
                    />
                    <Label
                      htmlFor={extra.id}
                      className="flex-1 cursor-pointer flex justify-between"
                    >
                      <span>{extra.name}</span>
                      <span className="font-semibold">
                        + R$ {extra.price.toFixed(2)}
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            )}

            {selectedExtras.length > 0 && (
              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                <span className="font-semibold">Total com adicionais:</span>
                <span className="text-xl font-bold text-primary">
                  R$ {getTotalPrice().toFixed(2)}
                </span>
              </div>
            )}
          </div>

          <Button className="w-full" size="lg" onClick={handleAddToCart}>
            <Plus className="h-5 w-5 mr-2" />
            Adicionar ao Carrinho
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductDetailDialog;
