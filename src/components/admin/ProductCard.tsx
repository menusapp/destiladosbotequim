import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    available: boolean;
    cost?: number;
    margin?: number;
    prep_time?: number;
    sku?: string;
  };
  onEdit: (product: any) => void;
  onToggleAvailable: (id: string, available: boolean) => void;
}

const ProductCard = ({ product, onEdit, onToggleAvailable }: ProductCardProps) => {
  const margin = product.margin || 0;
  const marginColor = margin >= 70 ? "text-success" : margin >= 50 ? "text-warning" : "text-foreground";

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-4">
          <h3 className="font-semibold text-foreground text-base leading-tight mb-1">
            {product.name}
          </h3>
          {product.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {product.description}
            </p>
          )}
        </div>
        <Switch
          checked={product.available}
          onCheckedChange={(checked) => onToggleAvailable(product.id, checked)}
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-[28px] font-bold text-primary leading-none">
          R$ {product.price.toFixed(2)}
        </div>
        <Badge 
          variant={product.available ? "default" : "secondary"}
          className={product.available ? "bg-foreground text-background" : ""}
        >
          {product.available ? "Disponível" : "Indisponível"}
        </Badge>
      </div>

      <div className="pt-4 border-t border-border space-y-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Custo:</span>
            <span className="font-medium text-foreground">
              R$ {(product.cost || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margem:</span>
            <span className={`font-medium ${marginColor}`}>
              {margin.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Preparo:</span>
            <span className="font-medium text-foreground">
              {product.prep_time || 0} min
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SKU:</span>
            <span className="font-medium text-foreground">
              {product.sku || "-"}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3"
          onClick={() => onEdit(product)}
        >
          <Pencil className="h-4 w-4 mr-2" />
          Editar
        </Button>
      </div>
    </Card>
  );
};

export default ProductCard;
