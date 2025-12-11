import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

interface StockCardProps {
  item: {
    id: string;
    name: string;
    unit: string;
    price_per_unit: number;
    current_quantity: number;
    minimum_quantity: number;
    category_id: string | null;
    stock_categories?: { name: string } | null;
  };
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

const StockCard = memo(({ item, onEdit, onDelete }: StockCardProps) => {
  const totalValue = item.current_quantity * item.price_per_unit;
  const isLowStock = item.current_quantity <= item.minimum_quantity;

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Header com nome e categoria */}
          <div>
            <h3 className="text-lg font-semibold text-foreground">{item.name}</h3>
            {item.stock_categories && (
              <p className="text-sm text-muted-foreground">{item.stock_categories.name}</p>
            )}
          </div>

          {/* Valor total em destaque */}
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-bold text-primary">
              R$ {totalValue.toFixed(2)}
            </p>
            {isLowStock && (
              <Badge variant="destructive" className="text-xs">
                Estoque baixo
              </Badge>
            )}
          </div>

          {/* Separador */}
          <div className="border-t border-border" />

          {/* Métricas em grid */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground block">Estoque Atual:</span>
              <p className="font-medium text-foreground">
                {item.current_quantity.toFixed(2)} {item.unit}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground block">Mínimo:</span>
              <p className="font-medium text-foreground">
                {item.minimum_quantity.toFixed(2)} {item.unit}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground block">Custo Unitário:</span>
              <p className="font-medium text-foreground">
                R$ {item.price_per_unit.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground block">Unidade:</span>
              <p className="font-medium text-foreground uppercase">{item.unit}</p>
            </div>
          </div>

          {/* Botões Atualizar e Excluir */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onEdit(item)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onDelete(item)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StockCard.displayName = "StockCard";

export default StockCard;
