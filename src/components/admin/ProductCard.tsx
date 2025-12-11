import { memo } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Copy, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface VariableCostInfo {
  name: string;
  price: number;
  cost: number;
  margin: number;
}

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    promotional_price?: number | null;
    available: boolean;
    cost?: number;
    margin?: number;
    prep_time?: number;
    sku?: string;
    variableCosts?: VariableCostInfo[];
  };
  onEdit: (product: any) => void;
  onToggleAvailable: (id: string, available: boolean) => void;
  onDuplicate?: (product: any) => void;
  onDelete?: (productId: string) => void;
}

const ProductCard = memo(({ product, onEdit, onToggleAvailable, onDuplicate, onDelete }: ProductCardProps) => {
  const hasVariableCosts = product.variableCosts && product.variableCosts.length > 0;
  const margin = product.margin || 0;
  const marginColor = margin >= 70 ? "text-success" : margin >= 50 ? "text-warning" : "text-foreground";
  const hasPromoPrice = product.promotional_price !== null && product.promotional_price !== undefined;

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
        <div className="flex items-center gap-2">
          {hasPromoPrice ? (
            <>
              <span className="text-lg text-muted-foreground line-through">
                R$ {product.price.toFixed(2)}
              </span>
              <span className="text-[28px] font-bold text-primary leading-none">
                R$ {product.promotional_price!.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-[28px] font-bold text-primary leading-none">
              R$ {product.price.toFixed(2)}
            </span>
          )}
        </div>
        <Badge 
          variant={product.available ? "default" : "secondary"}
          className={product.available ? "bg-foreground text-background" : ""}
        >
          {product.available ? "Disponível" : "Indisponível"}
        </Badge>
      </div>

      <div className="pt-4 border-t border-border space-y-3">
        {/* Custos Variáveis */}
        {hasVariableCosts ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Custos por Variação:</p>
            <div className="space-y-1.5">
              {product.variableCosts!.map((vc, idx) => {
                const vcMarginColor = vc.margin >= 70 ? "text-success" : vc.margin >= 50 ? "text-warning" : "text-foreground";
                return (
                  <div key={idx} className="flex items-center justify-between text-sm bg-muted/50 p-2 rounded">
                    <span className="font-medium">{vc.name}</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">
                        R$ {vc.cost.toFixed(2)}
                      </span>
                      <span className={`font-medium ${vcMarginColor}`}>
                        {vc.margin.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
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
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
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

        <div className="flex gap-2 mt-3">
          {onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex-1">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação não pode ser desfeita. O produto "{product.name}" será removido permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(product.id)}>
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {onDuplicate && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onDuplicate(product)}
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicar
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(product)}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Editar
          </Button>
        </div>
      </div>
    </Card>
  );
});

ProductCard.displayName = "ProductCard";

export default ProductCard;
