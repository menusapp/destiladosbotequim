import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface DRETabProps {
  restaurantId: string;
}

interface FixedCost {
  name: string;
  amount: number;
}

interface VariableCost {
  name: string;
  type: string;
  amount: number;
  percentage: number;
}

interface LaborCost {
  employee_name: string;
  salary: number;
}

interface CardFeesConfig {
  debit_fee: number;
  credit_fee: number;
}

export default function DRETab({ restaurantId }: DRETabProps) {
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCost[]>([]);
  const [cardFeesConfig, setCardFeesConfig] = useState<CardFeesConfig | null>(null);
  const [cmv, setCmv] = useState(0);
  const [operationalExpenses, setOperationalExpenses] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [cardPayments, setCardPayments] = useState({ count: 0, total: 0 });

  useEffect(() => {
    fetchDREData();
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

  const fetchDREData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch costs
      const { data: fixedData } = await supabase
        .from("fixed_costs")
        .select("name, amount")
        .eq("restaurant_id", restaurantId);
      setFixedCosts(fixedData || []);

      const { data: variableData } = await supabase
        .from("variable_costs")
        .select("name, type, amount, percentage")
        .eq("restaurant_id", restaurantId);
      setVariableCosts(variableData || []);

      const { data: laborData } = await supabase
        .from("labor_costs")
        .select("employee_name, salary")
        .eq("restaurant_id", restaurantId);
      setLaborCosts(laborData || []);

      const { data: cardData } = await supabase
        .from("card_fees_config")
        .select("debit_fee, credit_fee")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();
      setCardFeesConfig(cardData);

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
        setTotalRevenue(0);
        setCmv(0);
        setOperationalExpenses(0);
        setCardPayments({ count: 0, total: 0 });
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
          order_item_extras (price_at_order)
        `)
        .in("order_id", orderIds);

      // Calcular valor de cada pedido
      const orderTotals = new Map<string, number>();

      orderItems?.forEach((item: any) => {
        const orderId = item.order_id;
        const itemSubtotal = item.price_at_order * item.quantity;
        const extrasTotal = (item.order_item_extras || []).reduce(
          (sum: number, extra: any) => sum + Number(extra.price_at_order || 0),
          0
        );
        const itemTotal = itemSubtotal + extrasTotal;
        
        orderTotals.set(orderId, (orderTotals.get(orderId) || 0) + itemTotal);
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
      let revenue = 0;
      let cardCount = 0;
      let cardRevenue = 0;

      const isCard = (method: string) => method === "card" || method === "credito" || method === "debito";

      orderTotals.forEach((total, orderId) => {
        revenue += total;
        const paymentMethod = orderPayments.get(orderId) || 'pending';
        
        if (isCard(paymentMethod)) {
          cardCount++;
          cardRevenue += total;
        }
      });

      setTotalRevenue(revenue);
      setCardPayments({ count: cardCount, total: cardRevenue });

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
        
        const ingredients = item.products?.product_ingredients || [];
        ingredients.forEach((ing: any) => {
          const ingQty = ing.quantity || 0;
          const pricePerUnit = ing.stock_items?.price_per_unit || 0;
          totalCmv += ingQty * pricePerUnit * itemQty;
        });
        
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
    
    const calculateMonthlyProration = (monthlyCost: number): number => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      if (start.getTime() === end.getTime()) {
        const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        return monthlyCost * (1 / daysInMonth);
      }
      
      let totalProration = 0;
      const currentMonth = new Date(start);
      currentMonth.setDate(1);
      
      while (currentMonth <= end) {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month, daysInMonth);
        
        const periodStart = start > firstDayOfMonth ? start : firstDayOfMonth;
        const periodEnd = end < lastDayOfMonth ? end : lastDayOfMonth;
        
        const daysInPeriod = Math.floor((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        totalProration += monthlyCost * (daysInPeriod / daysInMonth);
        
        currentMonth.setMonth(currentMonth.getMonth() + 1);
      }
      
      return totalProration;
    };
    
    const totalFixedCostsMonthly = fixedCosts.reduce((sum, cost) => sum + Number(cost.amount), 0);
    const totalFixedCosts = calculateMonthlyProration(totalFixedCostsMonthly);
    
    const totalLaborCostsMonthly = laborCosts.reduce((sum, cost) => sum + Number(cost.salary), 0);
    const totalLaborCosts = calculateMonthlyProration(totalLaborCostsMonthly);
    
    let totalVariableCosts = 0;
    variableCosts.forEach(cost => {
      if (cost.type === 'percentage') {
        totalVariableCosts += totalRevenue * (Number(cost.percentage) / 100);
      } else {
        totalVariableCosts += calculateMonthlyProration(Number(cost.amount || 0));
      }
    });

    let cardTaxes = 0;
    if (cardFeesConfig && cardPayments.total > 0) {
      const avgFee = (cardFeesConfig.debit_fee + cardFeesConfig.credit_fee) / 2;
      cardTaxes = cardPayments.total * (avgFee / 100);
    }

    const totalCosts = cmv + operationalExpenses + totalFixedCosts + totalVariableCosts + totalLaborCosts + cardTaxes;
    const operationalProfit = totalRevenue - totalCosts;

    return {
      grossRevenue: totalRevenue,
      cmv,
      grossProfit: totalRevenue - cmv,
      operationalExpenses,
      fixedCost: totalFixedCosts,
      variableCost: totalVariableCosts,
      laborCost: totalLaborCosts,
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
    <div className="space-y-4">
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
    </div>
  );
}
