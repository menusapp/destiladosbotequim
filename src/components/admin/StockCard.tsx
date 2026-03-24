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
    supplier_id?: string | null;
    stock_categories?: { name: string } | null;
    suppliers?: { name: string } | null;
  };
  onEdit: (item: any) => void;
  onDelete: (item: any) => void;
}

const StockCard = memo(({ item, onEdit, onDelete }: StockCardProps) => {
  const totalValue = item.current_quantity * item.price_per_unit;
  const isLowStock = item.current_quantity <= item.minimum_quantity;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-3">
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">{item.name}</h3>
              {item.suppliers && (
                <p className="text-[11px] text-muted-foreground truncate">{item.suppliers.name}</p>
              )}
              {item.stock_categories && (
                <p className="text-[11px] text-muted-foreground truncate">{item.stock_categories.name}</p>
              )}
            </div>
            {isLowStock && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 shrink-0">
                Baixo
              </Badge>
            )}
          </div>

          {/* Valor total */}
          <p className="text-xl font-bold text-primary">
            R$ {totalValue.toFixed(2)}
          </p>

          {/* Metricas */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Estoque:</span>
              <p className="font-medium text-foreground">
                {item.current_quantity.toFixed(2)} {item.unit}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Minimo:</span>
              <p className="font-medium text-foreground">
                {item.minimum_quantity.toFixed(2)} {item.unit}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Custo Unit.:</span>
              <p className="font-medium text-foreground">
                R$ {item.price_per_unit.toFixed(2)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Unidade:</span>
              <p className="font-medium text-foreground uppercase">{item.unit}</p>
            </div>
          </div>

          {/* Botoes */}
          <div className="flex gap-1.5 pt-1">
            <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onEdit(item)}>
              <Pencil className="h-3 w-3 mr-1" />
              Atualizar
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onDelete(item)}>
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

StockCard.displayName = "StockCard";

export default StockCard;
