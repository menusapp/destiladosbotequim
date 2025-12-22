import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Calendar as CalendarIcon, DollarSign, TrendingUp, Users, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

interface ReportsTabProps {
  restaurantId: string;
}

interface PaymentMethodSummary {
  method_name: string;
  method_type: string;
  total: number;
}

interface DashboardStats {
  salesToday: number;
  ordersCount: number;
  averageTicket: number;
  mesasAtendidas: number;
  paymentsByMethod: PaymentMethodSummary[];
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

export const ReportsTab = ({ restaurantId }: ReportsTabProps) => {
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>();
  const [loading, setLoading] = useState(true);
  
  // Dashboard stats
  const [stats, setStats] = useState<DashboardStats>({
    salesToday: 0,
    ordersCount: 0,
    averageTicket: 0,
    mesasAtendidas: 0,
    paymentsByMethod: [],
  });

  // DRE states
  const [fixedCosts, setFixedCosts] = useState<FixedCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCost[]>([]);
  const [cmv, setCmv] = useState(0);
  const [operationalExpenses, setOperationalExpenses] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    fetchData();
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange();

      // Fetch costs
      const [fixedData, variableData, laborData] = await Promise.all([
        supabase.from("fixed_costs").select("name, amount").eq("restaurant_id", restaurantId),
        supabase.from("variable_costs").select("name, type, amount, percentage").eq("restaurant_id", restaurantId),
        supabase.from("labor_costs").select("employee_name, salary").eq("restaurant_id", restaurantId),
      ]);

      setFixedCosts(fixedData.data || []);
      setVariableCosts(variableData.data || []);
      setLaborCosts(laborData.data || []);

      // Buscar bills pagas no período (pedidos locais) - incluir payment_method
      const { data: paidBills } = await supabase
        .from("bills")
        .select(`
          id,
          total_amount,
          table_id,
          payment_method,
          tables!inner(restaurant_id)
        `)
        .eq("tables.restaurant_id", restaurantId)
        .eq("status", "paid")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString());

      let billsTotal = 0;
      let billsCount = 0;
      let localOrderIds: string[] = [];
      
      if (paidBills && paidBills.length > 0) {
        billsTotal = paidBills.reduce((sum, bill) => sum + Number(bill.total_amount), 0);
        billsCount = paidBills.length;
        
        const tableIds = paidBills.map(b => b.table_id);
        // Buscar apenas pedidos locais do período selecionado
        const { data: localOrders } = await supabase
          .from("orders")
          .select("id")
          .in("table_id", tableIds)
          .eq("order_type", "local")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
        
        localOrderIds = (localOrders || []).map(o => o.id);
      }

      // Buscar pedidos delivery finalizados - incluir taxas
      const { data: deliveryOrders } = await supabase
        .from("orders")
        .select(`
          id,
          delivery_fee,
          coupon_discount,
          loyalty_points_used,
          payment_type,
          order_items (
            quantity,
            price_at_order,
            order_item_extras (price_at_order)
          )
        `)
        .eq("restaurant_id", restaurantId)
        .eq("order_type", "delivery")
        .in("status", ["delivered", "picked_up"])
        .gte("updated_at", startDate.toISOString())
        .lte("updated_at", endDate.toISOString());

      let deliveryTotal = 0;
      const deliveryOrderIds = (deliveryOrders || []).map(o => o.id);
      
      deliveryOrders?.forEach((order: any) => {
        let orderSubtotal = 0;
        order.order_items?.forEach((item: any) => {
          const itemTotal = item.price_at_order * item.quantity;
          const extrasTotal = (item.order_item_extras || []).reduce(
            (sum: number, extra: any) => sum + Number(extra.price_at_order || 0),
            0
          );
          orderSubtotal += itemTotal + extrasTotal;
        });
        // Adicionar taxa de entrega e descontar cupom/fidelidade
        const deliveryFee = Number(order.delivery_fee || 0);
        const couponDiscount = Number(order.coupon_discount || 0);
        const loyaltyDiscount = Number(order.loyalty_points_used || 0) * 0.01;
        deliveryTotal += orderSubtotal + deliveryFee - couponDiscount - loyaltyDiscount;
      });

      // Buscar configuração de taxa de serviço
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("service_fee_enabled, service_fee_percentage")
        .eq("id", restaurantId)
        .single();

      // Remover aplicação duplicada de taxa de serviço nos delivery (já está no subtotal do pedido)
      // A taxa de serviço é calculada no checkout e incluída no valor dos itens

      // Buscar pedidos de balcão finalizados - incluir payment_method
      const { data: counterOrders } = await supabase
        .from("counter_orders")
        .select("id, total_amount, payment_method")
        .eq("restaurant_id", restaurantId)
        .eq("status", "paid")
        .gte("finalized_at", startDate.toISOString())
        .lte("finalized_at", endDate.toISOString());

      const counterTotal = (counterOrders || []).reduce((sum, order) => sum + Number(order.total_amount), 0);
      const counterOrderIds = (counterOrders || []).map(o => o.id);
      
      const salesTotal = billsTotal + deliveryTotal + counterTotal;
      const ordersCount = billsCount + (deliveryOrders?.length || 0) + (counterOrders?.length || 0);
      const avgTicket = ordersCount > 0 ? salesTotal / ordersCount : 0;

      setTotalRevenue(salesTotal);

      // Contar comandas criadas no período (Mesas Atendidas)
      const { data: comandasData } = await supabase
        .from("comandas")
        .select("id")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

      const mesasAtendidas = comandasData?.length || 0;

      // Buscar formas de pagamento ativas e calcular receita por método
      const { data: paymentMethods } = await supabase
        .from("payment_methods")
        .select("id, name, method_type")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true);

      // Agregar valores por forma de pagamento
      const paymentTotals: Record<string, { method_type: string; total: number }> = {};

      // Criar mapeamento de method_type/id/nome para o nome de exibição
      const methodToName: Record<string, string> = {};
      
      // Inicializar todas as formas de pagamento ativas com 0
      paymentMethods?.forEach(pm => {
        paymentTotals[pm.name] = { method_type: pm.method_type, total: 0 };
        // Mapear por nome, method_type e id
        methodToName[pm.name] = pm.name;
        methodToName[pm.method_type] = pm.name;
        methodToName[pm.id] = pm.name;
      });
      
      // Fallbacks para valores legados do banco
      if (!methodToName["cash"]) methodToName["cash"] = "Dinheiro";
      if (!methodToName["pix"]) methodToName["pix"] = "PIX";
      if (!methodToName["card"]) methodToName["card"] = "Cartão";
      if (!methodToName["credit"]) methodToName["credit"] = "Crédito";
      if (!methodToName["debit"]) methodToName["debit"] = "Débito";

      // Função para resolver nome e somar valor
      const addToPaymentTotal = (method: string | null | undefined, amount: number) => {
        if (!method) return;
        const resolvedName = methodToName[method] || method;
        if (paymentTotals[resolvedName]) {
          paymentTotals[resolvedName].total += amount;
        } else {
          // Criar entrada para métodos não mapeados
          paymentTotals[resolvedName] = { method_type: "other", total: amount };
        }
      };

      // Somar bills por payment_method
      paidBills?.forEach((bill: any) => {
        addToPaymentTotal(bill.payment_method, Number(bill.total_amount));
      });

      // Somar counter_orders por payment_method
      counterOrders?.forEach((order: any) => {
        addToPaymentTotal(order.payment_method, Number(order.total_amount));
      });

      // Somar delivery orders por payment_type
      deliveryOrders?.forEach((order: any) => {
        let orderTotal = 0;
        order.order_items?.forEach((item: any) => {
          const itemTotal = item.price_at_order * item.quantity;
          const extrasTotal = (item.order_item_extras || []).reduce(
            (sum: number, extra: any) => sum + Number(extra.price_at_order || 0),
            0
          );
          orderTotal += itemTotal + extrasTotal;
        });
        // Adicionar taxa de entrega e descontar cupom
        orderTotal += Number(order.delivery_fee || 0);
        orderTotal -= Number(order.coupon_discount || 0);
        orderTotal -= Number(order.loyalty_points_used || 0) * 0.01;
        addToPaymentTotal(order.payment_type, orderTotal);
      });

      const paymentsByMethod: PaymentMethodSummary[] = Object.entries(paymentTotals).map(([name, data]) => ({
        method_name: name,
        method_type: data.method_type,
        total: data.total,
      }));

      setStats({
        salesToday: salesTotal,
        ordersCount,
        averageTicket: avgTicket,
        mesasAtendidas,
        paymentsByMethod,
      });

      // Calcular CMV e despesas operacionais
      await calculateCMV([...localOrderIds, ...deliveryOrderIds], counterOrderIds);
      await calculateOperationalExpenses(startDate, endDate);

    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateCMV = async (orderIds: string[], counterOrderIds: string[]) => {
    if (orderIds.length === 0 && counterOrderIds.length === 0) {
      setCmv(0);
      return;
    }

    try {
      let totalCmv = 0;

      if (orderIds.length > 0) {
        const { data: items } = await supabase
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

        items?.forEach((item: any) => {
          const itemQty = item.quantity;
          
          const ingredients = item.products?.product_ingredients || [];
          ingredients.forEach((ing: any) => {
            totalCmv += (ing.quantity || 0) * (ing.stock_items?.price_per_unit || 0) * itemQty;
          });
          
          const extras = item.order_item_extras || [];
          extras.forEach((extra: any) => {
            const extraIngredients = extra.product_extras?.product_extra_ingredients || [];
            extraIngredients.forEach((ing: any) => {
              totalCmv += (ing.quantity || 0) * (ing.stock_items?.price_per_unit || 0) * itemQty;
            });
          });
        });
      }

      if (counterOrderIds.length > 0) {
        const { data: counterItems } = await supabase
          .from("counter_order_items")
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
            counter_order_item_extras (
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
          .in("counter_order_id", counterOrderIds);

        counterItems?.forEach((item: any) => {
          const itemQty = item.quantity;
          
          const ingredients = item.products?.product_ingredients || [];
          ingredients.forEach((ing: any) => {
            totalCmv += (ing.quantity || 0) * (ing.stock_items?.price_per_unit || 0) * itemQty;
          });
          
          const extras = item.counter_order_item_extras || [];
          extras.forEach((extra: any) => {
            const extraIngredients = extra.product_extras?.product_extra_ingredients || [];
            extraIngredients.forEach((ing: any) => {
              totalCmv += (ing.quantity || 0) * (ing.stock_items?.price_per_unit || 0) * itemQty;
            });
          });
        });
      }

      setCmv(totalCmv);
    } catch (error) {
      console.error("Erro ao calcular CMV:", error);
      setCmv(0);
    }
  };

  const calculateOperationalExpenses = async (startDate: Date, endDate: Date) => {
    try {
      const { data } = await supabase
        .from("cash_movements")
        .select("amount")
        .eq("restaurant_id", restaurantId)
        .eq("movement_type", "saida")
        .gte("created_at", startDate.toISOString())
        .lte("created_at", endDate.toISOString());

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

    const totalCosts = cmv + operationalExpenses + totalFixedCosts + totalVariableCosts + totalLaborCosts;
    const operationalProfit = totalRevenue - totalCosts;

    return {
      grossRevenue: totalRevenue,
      cmv,
      grossProfit: totalRevenue - cmv,
      operationalExpenses,
      fixedCost: totalFixedCosts,
      variableCost: totalVariableCosts,
      laborCost: totalLaborCosts,
      totalCosts,
      operationalProfit
    };
  };

  const dreValues = calculateDREValues();

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground">Relatórios</h2>
        <p className="text-muted-foreground">
          Visualize métricas e análises do seu negócio
        </p>
      </div>

      {/* Filtros de Data */}
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

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Vendas */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-300 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-700">Vendas</p>
              <p className="text-3xl font-bold text-orange-900">
                R$ {stats.salesToday.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-orange-600">{stats.ordersCount} pedidos</p>
            </div>
            <div className="p-3 bg-orange-600 rounded-xl">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Ticket Médio */}
        <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-300 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-amber-700">Ticket Médio</p>
              <p className="text-3xl font-bold text-amber-900">
                R$ {stats.averageTicket.toFixed(2).replace(".", ",")}
              </p>
              <p className="text-xs text-amber-600">Por pedido pago</p>
            </div>
            <div className="p-3 bg-amber-500 rounded-xl">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Mesas Atendidas */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-orange-700">Mesas Atendidas</p>
              <p className="text-3xl font-bold text-orange-900">{stats.mesasAtendidas}</p>
              <p className="text-xs text-orange-600">Comandas no período</p>
            </div>
            <div className="p-3 bg-orange-500 rounded-xl">
              <Users className="h-6 w-6 text-white" />
            </div>
          </div>
        </Card>

        {/* Formas de Pagamento */}
        <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 shadow-card hover:shadow-hover transition-shadow">
          <div className="flex items-start justify-between mb-3">
            <p className="text-sm font-medium text-orange-700">Formas de Pagamento</p>
            <div className="p-2 bg-orange-400 rounded-xl">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
          </div>
          {stats.paymentsByMethod.length === 0 ? (
            <p className="text-xs text-orange-600">Nenhuma forma cadastrada</p>
          ) : (
            <div className="space-y-1">
              {stats.paymentsByMethod.map(pm => (
                <div key={pm.method_name} className="flex justify-between items-center text-sm">
                  <span className="text-orange-800 truncate">{pm.method_name}</span>
                  <span className="font-semibold text-orange-900">R$ {pm.total.toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* DRE */}
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
              <span className="font-bold text-lg text-orange-600">R$ {dreValues.grossRevenue.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2 pl-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">(-) CMV dos Produtos</span>
              <span className="font-semibold text-orange-800">R$ {dreValues.cmv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-semibold">Lucro Bruto</span>
              <span className="font-bold text-orange-600">R$ {dreValues.grossProfit.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2 pl-4">
            <h3 className="font-semibold text-sm text-muted-foreground mb-2">Despesas Operacionais:</h3>
            <div className="flex justify-between items-center pl-4">
              <span className="text-sm">Despesas Registradas (Saídas do Caixa)</span>
              <span className="text-sm text-orange-800">R$ {dreValues.operationalExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pl-4">
              <span className="text-sm">Custo Fixo (proporcional)</span>
              <span className="text-sm text-orange-800">R$ {dreValues.fixedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pl-4">
              <span className="text-sm">Custo Variável</span>
              <span className="text-sm text-orange-800">R$ {dreValues.variableCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pl-4">
              <span className="text-sm">CMO - Custo de Mão de Obra (proporcional)</span>
              <span className="text-sm text-orange-800">R$ {dreValues.laborCost.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2 border-t-2 pt-4">
            <div className="flex justify-between items-center bg-orange-50 p-4 rounded-lg">
              <span className="font-bold text-lg">Lucro Operacional Final</span>
              <span className={`font-bold text-2xl ${dreValues.operationalProfit >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
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
};
