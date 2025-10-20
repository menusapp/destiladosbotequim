import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DollarSign, ShoppingCart, CreditCard, Smartphone, Banknote } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  cardPayments: number;
  pixPayments: number;
  cashPayments: number;
  cardRevenue: number;
  pixRevenue: number;
  cashRevenue: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  unitPrice: number;
  totalRevenue: number;
}

const DashboardTab = ({ restaurantId }: { restaurantId: string }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    cardPayments: 0,
    pixPayments: 0,
    cashPayments: 0,
    cardRevenue: 0,
    pixRevenue: 0,
    cashRevenue: 0,
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [restaurantId, dateFilter, customDateRange]);

  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;
    let endDate: Date = endOfDay(now);

    switch (dateFilter) {
      case "today":
        startDate = startOfDay(now);
        break;
      case "yesterday":
        startDate = startOfDay(subDays(now, 1));
        endDate = endOfDay(subDays(now, 1));
        break;
      case "7days":
        startDate = startOfDay(subDays(now, 7));
        break;
      case "30days":
        startDate = startOfDay(subDays(now, 30));
        break;
      case "custom":
        if (customDateRange?.from) {
          startDate = startOfDay(customDateRange.from);
          endDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from);
        } else {
          startDate = startOfDay(now);
        }
        break;
      default:
        startDate = startOfDay(now);
    }

    return { startDate, endDate };
  };

  const fetchStats = async () => {
    setLoading(true);
    const { startDate, endDate } = getDateRange();

    try {
      // Buscar sessões de caixa FECHADAS no período
      const { data: sessions, error: sessionsError } = await supabase
        .from("cash_register_sessions")
        .select("id, closed_at")
        .eq("restaurant_id", restaurantId)
        .eq("status", "closed")
        .gte("closed_at", startDate.toISOString())
        .lte("closed_at", endDate.toISOString());

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) {
        setStats({
          totalRevenue: 0,
          totalOrders: 0,
          cardPayments: 0,
          pixPayments: 0,
          cashPayments: 0,
          cardRevenue: 0,
          pixRevenue: 0,
          cashRevenue: 0,
        });
        setTopProducts([]);
        setLoading(false);
        return;
      }

      const sessionIds = sessions.map((s) => s.id);

      // Buscar movimentações das sessões fechadas
      const { data: movements, error: movError } = await supabase
        .from("cash_movements")
        .select("movement_type, amount, payment_method, category, description")
        .in("cash_session_id", sessionIds);

      if (movError) throw movError;

      const entradas = (movements || []).filter((m) => m.movement_type === "entrada");
      const pedidos = entradas.filter((m) => m.category === "Pedido");

      const totalRevenue = entradas.reduce((sum, m) => sum + Number(m.amount || 0), 0);

      const isCash = (method?: string | null) => method === "cash" || method === "dinheiro";
      const isPix = (method?: string | null) => method === "pix";
      const isCard = (method?: string | null) => method === "card" || method === "credito" || method === "debito";

      const cardPayments = pedidos.filter((v) => isCard(v.payment_method)).length;
      const pixPayments = pedidos.filter((v) => isPix(v.payment_method)).length;
      const cashPayments = pedidos.filter((v) => isCash(v.payment_method)).length;

      const cardRevenue = pedidos
        .filter((v) => isCard(v.payment_method))
        .reduce((sum, v) => sum + Number(v.amount || 0), 0);
      const pixRevenue = pedidos
        .filter((v) => isPix(v.payment_method))
        .reduce((sum, v) => sum + Number(v.amount || 0), 0);
      const cashRevenue = pedidos
        .filter((v) => isCash(v.payment_method))
        .reduce((sum, v) => sum + Number(v.amount || 0), 0);

      setStats({
        totalRevenue,
        totalOrders: pedidos.length,
        cardPayments,
        pixPayments,
        cashPayments,
        cardRevenue,
        pixRevenue,
        cashRevenue,
      });

      // Buscar produtos mais vendidos dos pedidos que entraram no caixa
      const orderIds: string[] = [];
      pedidos.forEach((movement) => {
        const match = movement.description?.match(/Pedido #([a-f0-9-]+)/);
        if (match && match[1]) {
          orderIds.push(match[1]);
        }
      });

      if (orderIds.length > 0) {
        const { data: orderItems } = await supabase
          .from("order_items")
          .select(`
            quantity,
            price_at_order,
            products (
              name
            )
          `)
          .in("order_id", orderIds);

        if (orderItems && orderItems.length > 0) {
          const productMap = new Map<string, { quantity: number; revenue: number; unitPrice: number }>();

          orderItems.forEach((item: any) => {
            const productName = item.products?.name || "Produto desconhecido";
            const existing = productMap.get(productName);
            const itemRevenue = item.price_at_order * item.quantity;

            if (existing) {
              existing.quantity += item.quantity;
              existing.revenue += itemRevenue;
            } else {
              productMap.set(productName, {
                quantity: item.quantity,
                revenue: itemRevenue,
                unitPrice: item.price_at_order,
              });
            }
          });

          const topProductsList = Array.from(productMap.entries())
            .map(([name, data]) => ({
              name,
              quantity: data.quantity,
              unitPrice: data.unitPrice,
              totalRevenue: data.revenue,
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5);

          setTopProducts(topProductsList);
        } else {
          setTopProducts([]);
        }
      } else {
        setTopProducts([]);
      }
    } catch (error) {
      console.error("Erro ao buscar estatísticas:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={dateFilter === "today" ? "default" : "outline"}
          onClick={() => setDateFilter("today")}
        >
          Hoje
        </Button>
        <Button
          variant={dateFilter === "yesterday" ? "default" : "outline"}
          onClick={() => setDateFilter("yesterday")}
        >
          Ontem
        </Button>
        <Button
          variant={dateFilter === "7days" ? "default" : "outline"}
          onClick={() => setDateFilter("7days")}
        >
          7 Dias
        </Button>
        <Button
          variant={dateFilter === "30days" ? "default" : "outline"}
          onClick={() => setDateFilter("30days")}
        >
          30 Dias
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={dateFilter === "custom" ? "default" : "outline"}
              className={cn("justify-start text-left font-normal")}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter === "custom" && customDateRange?.from
                ? customDateRange.to
                  ? `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                  : format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                : "Personalizado"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={customDateRange}
              onSelect={(range) => {
                setCustomDateRange(range);
                if (range?.from) {
                  setDateFilter("custom");
                }
              }}
              locale={ptBR}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando estatísticas...</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {stats.totalRevenue.toFixed(2)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalOrders}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {stats.totalOrders > 0 ? (stats.totalRevenue / stats.totalOrders).toFixed(2) : "0.00"}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Métodos de Pagamento</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <CreditCard className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Cartão</p>
                    <p className="text-2xl font-bold">{stats.cardPayments}</p>
                    <p className="text-sm text-primary font-semibold">R$ {stats.cardRevenue.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Smartphone className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">PIX</p>
                    <p className="text-2xl font-bold">{stats.pixPayments}</p>
                    <p className="text-sm text-primary font-semibold">R$ {stats.pixRevenue.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Banknote className="h-8 w-8 text-primary" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Dinheiro</p>
                    <p className="text-2xl font-bold">{stats.cashPayments}</p>
                    <p className="text-sm text-primary font-semibold">R$ {stats.cashRevenue.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {topProducts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Produtos Mais Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topProducts.map((product, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-semibold">{product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Quantidade: {product.quantity} | Preço unitário: R$ {product.unitPrice.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">
                          R$ {product.totalRevenue.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardTab;
