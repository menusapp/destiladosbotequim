import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useProductPerformance, type ProductPerformanceItem } from "@/hooks/useProductPerformance";
import type { DateRange } from "@/hooks/useOrderMetrics";
import { Package, TrendingUp, DollarSign, Layers } from "lucide-react";

interface Props {
  restaurantId: string;
  dateRange: DateRange;
}

const positionBadge = (pos: number) => {
  if (pos === 1) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-white text-xs font-bold">1°</span>;
  if (pos === 2) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold">2°</span>;
  if (pos === 3) return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700 text-white text-xs font-bold">3°</span>;
  return <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-medium">{pos}°</span>;
};

function ProductList({
  items,
  maxQty,
  variant,
}: {
  items: ProductPerformanceItem[];
  maxQty: number;
  variant: "top" | "bottom";
}) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pos = variant === "top" ? i + 1 : i + 1;
        const pct = maxQty > 0 ? (item.totalQuantity / maxQty) * 100 : 0;
        return (
          <div key={item.productId} className="flex items-center gap-3">
            {positionBadge(pos)}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-sm font-medium truncate">{item.productName}</span>
                <span className="text-sm font-semibold ml-2 whitespace-nowrap">R$ {item.totalRevenue.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>{item.categoryName}</span>
                <span>{item.totalQuantity} un.</span>
              </div>
              <Progress
                value={pct}
                className={`h-1.5 ${variant === "bottom" ? "[&>div]:bg-muted-foreground/40" : ""}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ProductPerformanceSection({ restaurantId, dateRange }: Props) {
  const [topX, setTopX] = useState<number>(10);
  const { data, isLoading } = useProductPerformance(restaurantId, dateRange);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!data || data.products.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum produto vendido no período</p>
        </CardContent>
      </Card>
    );
  }

  const topProducts = data.products.slice(0, topX);
  const bottomProducts = data.products.length > topX
    ? data.products.slice(-topX).reverse()
    : data.products.slice().reverse().slice(0, topX);
  // Remove duplicates (if total products <= topX, both lists are the same)
  const showBottom = data.products.length > topX;

  const topMaxQty = topProducts[0]?.totalQuantity || 1;
  const bottomMaxQty = bottomProducts[0]?.totalQuantity || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">Desempenho de Produtos</h3>
          <p className="text-xs text-muted-foreground">Ranking de vendas no período selecionado</p>
        </div>
        <Select value={topX.toString()} onValueChange={(v) => setTopX(Number(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Top 5</SelectItem>
            <SelectItem value="10">Top 10</SelectItem>
            <SelectItem value="20">Top 20</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className={`grid gap-6 ${showBottom ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Badge className="bg-emerald-500 text-white">Mais Vendidos</Badge>
            </div>
            <ProductList items={topProducts} maxQty={topMaxQty} variant="top" />
          </CardContent>
        </Card>

        {showBottom && (
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">Menos Vendidos</Badge>
              </div>
              <ProductList items={bottomProducts} maxQty={bottomMaxQty} variant="bottom" />
            </CardContent>
          </Card>
        )}
      </div>

    </div>
  );
}

function MiniCard({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1 text-muted-foreground">
          {icon}
          <span className="text-xs">{title}</span>
        </div>
        <p className="text-sm font-semibold truncate">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
