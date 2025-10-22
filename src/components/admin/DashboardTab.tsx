import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DollarSign, ShoppingCart, CreditCard, Smartphone, Banknote, Calendar as CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DashboardTabProps {
  restaurantId: string;
}

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  averageTicket: number;
  cardPayments: { count: number; total: number };
  pixPayments: { count: number; total: number };
  cashPayments: { count: number; total: number };
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface OperationalCost {
  fixed_cost: number;
  variable_cost: number;
  variable_cost_type: 'fixed' | 'percentage';
  labor_cost: number;
}

interface CardFee {
  card_brand: string;
  fee_percentage: number;
}

export default function DashboardTab({ restaurantId }: DashboardTabProps) {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    averageTicket: 0,
    cardPayments: { count: 0, total: 0 },
    pixPayments: { count: 0, total: 0 },
    cashPayments: { count: 0, total: 0 }
  });
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [operationalCosts, setOperationalCosts] = useState<OperationalCost | null>(null);
  const [cardFees, setCardFees] = useState<CardFee[]>([]);
  const [cmv, setCmv] = useState(0);
  const [operationalExpenses, setOperationalExpenses] = useState(0);

  useEffect(() => {
    fetchStats();
    fetchOperationalCosts();
    fetchCardFees();
  }, [dateFilter, customDateRange, restaurantId]);

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
        startDate = startOfDay(subDays(now, 6));
        break;
      case "30days":
        startDate = startOfDay(subDays(now, 29));
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

  const fetchOperationalCosts = async () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    const { data, error } = await supabase
      .from("operational_costs")
      .select("*")
      .eq("restaurant_id", restaurantId)
      .eq("month_year", currentMonth)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error("Erro ao buscar custos operacionais:", error);
      return;
    }

    if (data) {
      setOperationalCosts({
        ...data,
        variable_cost_type: data.variable_cost_type as 'fixed' | 'percentage'
      });
    }
  };

  const fetchCardFees = async () => {
    const { data, error } = await supabase
      .from("card_fees")
      .select("*")
      .eq("restaurant_id", restaurantId);

    if (error) {
      console.error("Erro ao buscar taxas de cartões:", error);
      return;
    }

    setCardFees(data || []);
  };

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Buscar pedidos aceitos no período
      const { data: acceptedOrders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          table_id,
          created_at,
          tables!inner(restaurant_id)
        `)
        .eq("tables.restaurant_id", restaurantId)
        .eq("status", "accepted")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (ordersError) throw ordersError;

      if (!acceptedOrders || acceptedOrders.length === 0) {
        setStats({
          totalRevenue: 0,
          totalOrders: 0,
          averageTicket: 0,
          cardPayments: { count: 0, total: 0 },
          pixPayments: { count: 0, total: 0 },
          cashPayments: { count: 0, total: 0 }
        });
        setTopProducts([]);
        setCmv(0);
        setOperationalExpenses(0);
        setLoading(false);
        return;
      }

      const orderIds = acceptedOrders.map(o => o.id);

      // Buscar configurações do restaurante para taxa de serviço
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("service_fee_enabled, service_fee_percentage")
        .eq("id", restaurantId)
        .single();

      // Buscar itens dos pedidos com extras
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          id,
          order_id,
          quantity,
          price_at_order,
          products (name),
          order_item_extras (price_at_order)
        `)
        .in("order_id", orderIds);

      // Calcular valor de cada pedido
      const orderTotals = new Map<string, number>();
      const productMap = new Map<string, { quantity: number; revenue: number }>();

      orderItems?.forEach((item: any) => {
        const orderId = item.order_id;
        const itemSubtotal = item.price_at_order * item.quantity;
        const extrasTotal = (item.order_item_extras || []).reduce(
          (sum: number, extra: any) => sum + Number(extra.price_at_order || 0),
          0
        );
        const itemTotal = itemSubtotal + extrasTotal;
        
        orderTotals.set(orderId, (orderTotals.get(orderId) || 0) + itemTotal);

        // Para top produtos
        const productName = item.products?.name || "Produto desconhecido";
        const existing = productMap.get(productName);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += itemSubtotal;
        } else {
          productMap.set(productName, {
            quantity: item.quantity,
            revenue: itemSubtotal
          });
        }
      });

      // Aplicar taxa de serviço
      const serviceFeeEnabled = restaurant?.service_fee_enabled || false;
      const serviceFeePercentage = restaurant?.service_fee_percentage || 0;

      orderTotals.forEach((subtotal, orderId) => {
        if (serviceFeeEnabled) {
          const serviceFee = subtotal * (serviceFeePercentage / 100);
          orderTotals.set(orderId, subtotal + serviceFee);
        }
      });

      // Buscar bills para identificar formas de pagamento
      const tableIds = [...new Set(acceptedOrders.map(o => o.table_id))];
      const { data: bills } = await supabase
        .from("bills")
        .select("table_id, payment_method, status")
        .in("table_id", tableIds);

      // Mapear pedidos com suas formas de pagamento
      const orderPayments = new Map<string, string>();
      acceptedOrders.forEach(order => {
        const bill = bills?.find(b => b.table_id === order.table_id && b.status === 'paid');
        orderPayments.set(order.id, bill?.payment_method || 'pending');
      });

      // Calcular estatísticas
      let totalRevenue = 0;
      let cardCount = 0, pixCount = 0, cashCount = 0;
      let cardRevenue = 0, pixRevenue = 0, cashRevenue = 0;

      const isCash = (method: string) => method === "cash" || method === "dinheiro";
      const isPix = (method: string) => method === "pix";
      const isCard = (method: string) => method === "card" || method === "credito" || method === "debito";

      orderTotals.forEach((total, orderId) => {
        totalRevenue += total;
        const paymentMethod = orderPayments.get(orderId) || 'pending';
        
        if (isCard(paymentMethod)) {
          cardCount++;
          cardRevenue += total;
        } else if (isPix(paymentMethod)) {
          pixCount++;
          pixRevenue += total;
        } else if (isCash(paymentMethod)) {
          cashCount++;
          cashRevenue += total;
        }
      });

      setStats({
        totalRevenue,
        totalOrders: orderTotals.size,
        averageTicket: orderTotals.size > 0 ? totalRevenue / orderTotals.size : 0,
        cardPayments: { count: cardCount, total: cardRevenue },
        pixPayments: { count: pixCount, total: pixRevenue },
        cashPayments: { count: cashCount, total: cashRevenue }
      });

      // Top produtos
      const topProductsList = Array.from(productMap.entries())
        .map(([name, data]) => ({
          name,
          quantity: data.quantity,
          revenue: data.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setTopProducts(topProductsList);

      await calculateCMV(orderIds);
      await calculateOperationalExpenses(startDate, endDate);

    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateCMV = async (orderIds: string[]) => {
    if (orderIds.length === 0) {
      setCmv(0);
      return;
    }

    try {
      // Buscar itens do pedido com ingredientes dos produtos
      const { data: items, error } = await supabase
        .from("order_items")
        .select(`
          id,
          quantity,
          products (
            product_ingredients (
              quantity,
              stock_items (
                price_per_unit
              )
            )
          ),
          order_item_extras (
            product_extra_id,
            product_extras (
              product_extra_ingredients (
                quantity,
                stock_items (
                  price_per_unit
                )
              )
            )
          )
        `)
        .in("order_id", orderIds);

      if (error) throw error;

      let totalCmv = 0;
      
      items?.forEach((item: any) => {
        const itemQty = item.quantity;
        
        // Custo dos ingredientes do produto
        const ingredients = item.products?.product_ingredients || [];
        ingredients.forEach((ing: any) => {
          const ingQty = ing.quantity || 0;
          const pricePerUnit = ing.stock_items?.price_per_unit || 0;
          totalCmv += ingQty * pricePerUnit * itemQty;
        });
        
        // Custo dos ingredientes dos adicionais
        const extras = item.order_item_extras || [];
        extras.forEach((extra: any) => {
          const extraIngredients = extra.product_extras?.product_extra_ingredients || [];
          extraIngredients.forEach((ing: any) => {
            const ingQty = ing.quantity || 0;
            const pricePerUnit = ing.stock_items?.price_per_unit || 0;
            totalCmv += ingQty * pricePerUnit * itemQty;
          });
        });
      });

      setCmv(totalCmv);
    } catch (error) {
      console.error("Erro ao calcular CMV:", error);
      setCmv(0);
    }
  };

  const calculateOperationalExpenses = async (startDate: Date, endDate: Date) => {
    try {
      const { data, error } = await supabase
        .from("cash_movements")
        .select("amount")
        .eq("restaurant_id", restaurantId)
        .eq("movement_type", "saida")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      if (error) throw error;

      const total = data?.reduce((sum, m) => sum + Number(m.amount), 0) || 0;
      setOperationalExpenses(total);
    } catch (error) {
      console.error("Erro ao calcular despesas operacionais:", error);
      setOperationalExpenses(0);
    }
  };

  const calculateDREValues = () => {
    const { startDate, endDate } = getDateRange();
    const daysInPeriod = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let fixedCost = 0;
    let laborCost = 0;
    let variableCost = 0;

    if (operationalCosts) {
      fixedCost = operationalCosts.fixed_cost * daysInPeriod;
      laborCost = operationalCosts.labor_cost * daysInPeriod;
      
      if (operationalCosts.variable_cost_type === 'percentage') {
        variableCost = stats.totalRevenue * (operationalCosts.variable_cost / 100);
      } else {
        variableCost = operationalCosts.variable_cost;
      }
    }

    let cardTaxes = 0;
    if (cardFees.length > 0 && stats.cardPayments.total > 0) {
      const avgFee = cardFees.reduce((sum, f) => sum + f.fee_percentage, 0) / cardFees.length;
      cardTaxes = stats.cardPayments.total * (avgFee / 100);
    }

    const totalCosts = cmv + operationalExpenses + fixedCost + variableCost + laborCost + cardTaxes;
    const operationalProfit = stats.totalRevenue - totalCosts;

    return {
      grossRevenue: stats.totalRevenue,
      cmv,
      grossProfit: stats.totalRevenue - cmv,
      operationalExpenses,
      fixedCost,
      variableCost,
      laborCost,
      cardTaxes,
      totalCosts,
      operationalProfit
    };
  };

  const dreValues = calculateDREValues();

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  return (
    <Tabs defaultValue="faturamento" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
        <TabsTrigger value="dre">DRE</TabsTrigger>
      </TabsList>

      <TabsContent value="faturamento" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={dateFilter === "today" ? "default" : "outline"} onClick={() => setDateFilter("today")}>Hoje</Button>
          <Button variant={dateFilter === "yesterday" ? "default" : "outline"} onClick={() => setDateFilter("yesterday")}>Ontem</Button>
          <Button variant={dateFilter === "7days" ? "default" : "outline"} onClick={() => setDateFilter("7days")}>7 Dias</Button>
          <Button variant={dateFilter === "30days" ? "default" : "outline"} onClick={() => setDateFilter("30days")}>30 Dias</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={dateFilter === "custom" ? "default" : "outline"} className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter === "custom" && customDateRange?.from
                  ? customDateRange.to
                    ? `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                    : format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                  if (range?.from) setDateFilter("custom");
                }}
                locale={ptBR}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {stats.totalRevenue.toFixed(2)}</div>
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
              <div className="text-2xl font-bold">R$ {stats.averageTicket.toFixed(2)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Formas de Pagamento</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span>Cartão:</span>
                  <span className="font-bold">{stats.cardPayments.count} (R$ {stats.cardPayments.total.toFixed(2)})</span>
                </div>
                <div className="flex justify-between">
                  <span>PIX:</span>
                  <span className="font-bold">{stats.pixPayments.count} (R$ {stats.pixPayments.total.toFixed(2)})</span>
                </div>
                <div className="flex justify-between">
                  <span>Dinheiro:</span>
                  <span className="font-bold">{stats.cashPayments.count} (R$ {stats.cashPayments.total.toFixed(2)})</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Produtos Mais Vendidos</CardTitle>
            <CardDescription>Produtos com maior volume de vendas no período</CardDescription>
          </CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhum produto vendido no período</p>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <span className="text-sm font-bold text-primary">#{index + 1}</span>
                      </div>
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">{product.quantity} unidades vendidas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">R$ {product.revenue.toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">faturado</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="dre" className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={dateFilter === "today" ? "default" : "outline"} onClick={() => setDateFilter("today")}>Hoje</Button>
          <Button variant={dateFilter === "yesterday" ? "default" : "outline"} onClick={() => setDateFilter("yesterday")}>Ontem</Button>
          <Button variant={dateFilter === "7days" ? "default" : "outline"} onClick={() => setDateFilter("7days")}>7 Dias</Button>
          <Button variant={dateFilter === "30days" ? "default" : "outline"} onClick={() => setDateFilter("30days")}>30 Dias</Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant={dateFilter === "custom" ? "default" : "outline"} className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateFilter === "custom" && customDateRange?.from
                  ? customDateRange.to
                    ? `${format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}`
                    : format(customDateRange.from, "dd/MM/yyyy", { locale: ptBR })
                  : "Personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="range"
                selected={customDateRange}
                onSelect={(range) => {
                  setCustomDateRange(range);
                  if (range?.from) setDateFilter("custom");
                }}
                locale={ptBR}
                numberOfMonths={2}
                className="pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Demonstrativo de Resultados (DRE)
            </CardTitle>
            <CardDescription>Análise financeira completa do período selecionado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold text-lg">Receita Bruta</span>
                <span className="font-bold text-lg text-green-600">R$ {dreValues.grossRevenue.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pl-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">(-) CMV dos Produtos</span>
                <span className="font-semibold text-red-600">R$ {dreValues.cmv.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center border-b pb-2">
                <span className="font-semibold">Lucro Bruto</span>
                <span className="font-bold text-green-600">R$ {dreValues.grossProfit.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 pl-4">
              <h3 className="font-semibold text-sm text-muted-foreground mb-2">Despesas Operacionais:</h3>
              <div className="flex justify-between items-center pl-4">
                <span className="text-sm">Despesas Registradas (Saídas do Caixa)</span>
                <span className="text-sm text-red-600">R$ {dreValues.operationalExpenses.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pl-4">
                <span className="text-sm">Custo Fixo (proporcional)</span>
                <span className="text-sm text-red-600">R$ {dreValues.fixedCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pl-4">
                <span className="text-sm">Custo Variável</span>
                <span className="text-sm text-red-600">R$ {dreValues.variableCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pl-4">
                <span className="text-sm">CMO - Custo de Mão de Obra (proporcional)</span>
                <span className="text-sm text-red-600">R$ {dreValues.laborCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pl-4">
                <span className="text-sm">Taxas de Cartões</span>
                <span className="text-sm text-red-600">R$ {dreValues.cardTaxes.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2 border-t-2 pt-4">
              <div className="flex justify-between items-center bg-primary/5 p-4 rounded-lg">
                <span className="font-bold text-lg">Lucro Operacional Final</span>
                <span className={`font-bold text-2xl ${dreValues.operationalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {dreValues.operationalProfit.toFixed(2)}
                </span>
              </div>
              {dreValues.grossRevenue > 0 && (
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>Margem Operacional</span>
                  <span className="font-semibold">{((dreValues.operationalProfit / dreValues.grossRevenue) * 100).toFixed(2)}%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}