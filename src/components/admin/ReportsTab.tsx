import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, DollarSign, TrendingUp, Users, CreditCard, FileText, Download } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

const EmployeeCreditsTab = lazy(() => import("./EmployeeCreditsTab"));

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
  const [pendingCustomDateRange, setPendingCustomDateRange] = useState<DateRange | undefined>();
  const [customDatePopoverOpen, setCustomDatePopoverOpen] = useState(false);
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
  const [payrollRecovery, setPayrollRecovery] = useState(0);

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

      // Fetch ALL data in parallel — single Promise.all instead of serial waterfall
      const [
        fixedData, variableData, laborData,
        { data: paidBills },
        { data: deliveryOrders },
        { data: counterOrders },
        { data: comandasData },
        { data: paymentMethods },
        { data: cashMovements },
      ] = await Promise.all([
        supabase.from("fixed_costs").select("name, amount").eq("restaurant_id", restaurantId),
        supabase.from("variable_costs").select("name, type, amount, percentage").eq("restaurant_id", restaurantId),
        supabase.from("labor_costs").select("employee_name, salary").eq("restaurant_id", restaurantId),
        supabase.from("bills").select(`id, total_amount, table_id, payment_method, payment_splits, tables!inner(restaurant_id)`)
          .eq("tables.restaurant_id", restaurantId).eq("status", "paid")
          .gte("paid_at", startDate.toISOString()).lte("paid_at", endDate.toISOString()),
        supabase.from("orders").select(`id, delivery_fee, coupon_discount, loyalty_points_used, payment_type, order_items(quantity, price_at_order, order_item_extras(price_at_order))`)
          .eq("restaurant_id", restaurantId).eq("order_type", "delivery")
          .in("status", ["delivered", "picked_up"])
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("counter_orders").select("id, total_amount, payment_method")
          .eq("restaurant_id", restaurantId).eq("status", "paid")
          .gte("finalized_at", startDate.toISOString()).lte("finalized_at", endDate.toISOString()),
        supabase.from("comandas").select("id").eq("restaurant_id", restaurantId)
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
        supabase.from("payment_methods").select("id, name, method_type").eq("restaurant_id", restaurantId),
        supabase.from("cash_movements").select("amount")
          .eq("restaurant_id", restaurantId).eq("movement_type", "saida")
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString()),
      ]);

      setFixedCosts(fixedData.data || []);
      setVariableCosts(variableData.data || []);
      setLaborCosts(laborData.data || []);

      let billsTotal = 0;
      let billsCount = 0;
      let localOrderIds: string[] = [];
      
      if (paidBills && paidBills.length > 0) {
        billsTotal = paidBills.reduce((sum, bill) => sum + Number(bill.total_amount), 0);
        billsCount = paidBills.length;
        
        const tableIds = paidBills.map(b => b.table_id);
        const { data: localOrders } = await supabase
          .from("orders").select("id").in("table_id", tableIds)
          .eq("order_type", "local")
          .gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());
        localOrderIds = (localOrders || []).map(o => o.id);
      }

      let deliveryTotal = 0;
      const deliveryOrderIds = (deliveryOrders || []).map(o => o.id);
      
      deliveryOrders?.forEach((order: any) => {
        let orderSubtotal = 0;
        order.order_items?.forEach((item: any) => {
          const itemTotal = item.price_at_order * item.quantity;
          const extrasTotal = (item.order_item_extras || []).reduce(
            (sum: number, extra: any) => sum + Number(extra.price_at_order || 0), 0);
          orderSubtotal += itemTotal + extrasTotal;
        });
        const deliveryFee = Number(order.delivery_fee || 0);
        const couponDiscount = Number(order.coupon_discount || 0);
        const loyaltyDiscount = Number(order.loyalty_points_used || 0) * 0.01;
        deliveryTotal += orderSubtotal + deliveryFee - couponDiscount - loyaltyDiscount;
      });

      const counterTotal = (counterOrders || []).reduce((sum, order) => sum + Number(order.total_amount), 0);
      const counterOrderIds = (counterOrders || []).map(o => o.id);
      
      const salesTotal = billsTotal + deliveryTotal + counterTotal;
      const ordersCount = billsCount + (deliveryOrders?.length || 0) + (counterOrders?.length || 0);
      const avgTicket = ordersCount > 0 ? salesTotal / ordersCount : 0;

      setTotalRevenue(salesTotal);

      const mesasAtendidas = comandasData?.length || 0;

      // Operational expenses from cash_movements (already fetched in parallel)
      const opExpenses = cashMovements?.reduce((sum, m) => sum + Number(m.amount), 0) || 0;
      setOperationalExpenses(opExpenses);

      const METHOD_TYPE_LABELS: Record<string, string> = {
        cash: "Dinheiro",
        credit: "Cartão de Crédito",
        debit: "Cartão de Débito",
        pix: "PIX",
        meal_voucher: "Vale Refeição",
        employee_credit: "Crédito de Funcionário",
      };

      // Agregar valores diretamente por method_type
      const paymentTotals: Record<string, number> = {
        cash: 0,
        credit: 0,
        debit: 0,
        pix: 0,
        meal_voucher: 0,
        employee_credit: 0,
      };

      // Função para normalizar qualquer valor salvo → method_type
      const normalizeMethod = (method: string | null | undefined): string | null => {
        if (!method) return null;
        
        // Já é um method_type válido
        if (paymentTotals.hasOwnProperty(method)) return method;
        
        // Mapear valores legados
        if (method === "card") return "credit"; // card genérico vai para crédito
        
        // Verificar se é UUID de uma forma de pagamento cadastrada
        const pmById = paymentMethods?.find(p => p.id === method);
        if (pmById) return pmById.method_type;
        
        // Verificar se é nome de uma forma de pagamento
        const pmByName = paymentMethods?.find(p => 
          p.name.toLowerCase() === method.toLowerCase()
        );
        if (pmByName) return pmByName.method_type;
        
        return null;
      };

      // Função para somar ao total do method_type
      const addToPaymentTotal = (method: string | null | undefined, amount: number) => {
        const normalized = normalizeMethod(method);
        if (normalized && paymentTotals.hasOwnProperty(normalized)) {
          paymentTotals[normalized] += amount;
        }
      };

      // Somar bills — desagregar payment_splits quando disponível
      paidBills?.forEach((bill: any) => {
        const splits = bill.payment_splits;
        if (Array.isArray(splits) && splits.length > 0) {
          for (const split of splits) {
            addToPaymentTotal(split.method || split.display, Number(split.amount || 0));
          }
        } else {
          addToPaymentTotal(bill.payment_method, Number(bill.total_amount));
        }
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

      // Converter para array de exibição (apenas os que têm valor > 0)
      const paymentsByMethod: PaymentMethodSummary[] = Object.entries(paymentTotals)
        .filter(([_, total]) => total > 0)
        .map(([type, total]) => ({
          method_name: METHOD_TYPE_LABELS[type] || type,
          method_type: type,
          total,
        }));

      setStats({
        salesToday: salesTotal,
        ordersCount,
        averageTicket: avgTicket,
        mesasAtendidas,
        paymentsByMethod,
      });

      // Calcular CMV (operational expenses already computed above)
      await calculateCMV([...localOrderIds, ...deliveryOrderIds], counterOrderIds);

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

  const handleExportPDF = () => {
    const { startDate, endDate } = getDateRange();
    const periodLabel = dateFilter === "today" ? "Hoje" : dateFilter === "yesterday" ? "Ontem" : dateFilter === "7days" ? "7 Dias" : dateFilter === "30days" ? "30 Dias" : `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;

    const rows = [
      { label: "Receita Bruta", value: dreValues.grossRevenue, bold: true },
      { label: "   (-) CMV dos Produtos", value: dreValues.cmv },
      { label: "Lucro Bruto", value: dreValues.grossProfit, bold: true },
      { label: "   Saídas do Caixa", value: dreValues.operationalExpenses },
      { label: "   Custo Fixo (proporcional)", value: dreValues.fixedCost },
      { label: "   Custo Variável", value: dreValues.variableCost },
      { label: "   CMO - Mão de Obra (proporcional)", value: dreValues.laborCost },
      { label: "Lucro Operacional", value: dreValues.operationalProfit, bold: true, highlight: true },
    ];

    if (dreValues.grossRevenue > 0) {
      rows.push({ label: "Margem Operacional", value: parseFloat(((dreValues.operationalProfit / dreValues.grossRevenue) * 100).toFixed(1)), bold: false, isPercentage: true } as any);
    }

    const html = `
      <html><head><title>DRE - ${periodLabel}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #1a1a1a; }
        h1 { font-size: 22px; margin-bottom: 4px; }
        .period { font-size: 13px; color: #666; margin-bottom: 24px; }
        .stats { display: flex; gap: 24px; margin-bottom: 28px; }
        .stat { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px 16px; min-width: 140px; }
        .stat-value { font-size: 20px; font-weight: 700; }
        .stat-label { font-size: 11px; color: #888; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 10px 16px; border-bottom: 1px solid #eee; font-size: 14px; }
        .bold td { font-weight: 700; background: #f9f9f9; }
        .highlight td { font-size: 16px; background: #f0f7ff; }
        .right { text-align: right; font-variant-numeric: tabular-nums; }
        @media print { body { padding: 20px; } }
      </style></head><body>
      <h1>Demonstrativo de Resultados (DRE)</h1>
      <p class="period">Período: ${periodLabel}</p>
      <div class="stats">
        <div class="stat"><div class="stat-value">R$ ${stats.salesToday.toFixed(2).replace(".",",")}</div><div class="stat-label">Vendas · ${stats.ordersCount} pedidos</div></div>
        <div class="stat"><div class="stat-value">R$ ${stats.averageTicket.toFixed(2).replace(".",",")}</div><div class="stat-label">Ticket Médio</div></div>
        <div class="stat"><div class="stat-value">${stats.mesasAtendidas}</div><div class="stat-label">Mesas Atendidas</div></div>
      </div>
      <table>${rows.map(r => `<tr class="${r.bold ? 'bold' : ''} ${(r as any).highlight ? 'highlight' : ''}"><td>${r.label}</td><td class="right">${(r as any).isPercentage ? r.value + '%' : 'R$ ' + r.value.toFixed(2).replace(".",",")}</td></tr>`).join('')}</table>
      <p style="margin-top:24px;font-size:11px;color:#aaa;">Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 300);
    }
  };

  if (loading) {
    return <div className="p-6 text-muted-foreground">Carregando...</div>;
  }

  return (
    <Tabs defaultValue="dre" className="space-y-6">
      <TabsList>
        <TabsTrigger value="dre">DRE</TabsTrigger>
        <TabsTrigger value="employee_credits">Créditos Funcionários</TabsTrigger>
      </TabsList>

      <TabsContent value="dre">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.025em]">Relatório DRE</h2>
          <p className="text-sm text-muted-foreground font-light">Visualize métricas e análises do seu negócio</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: "today", label: "Hoje" },
          { key: "yesterday", label: "Ontem" },
          { key: "7days", label: "7 Dias" },
          { key: "30days", label: "30 Dias" },
        ].map((f) => (
          <Button key={f.key} variant={dateFilter === f.key ? "default" : "outline"} size="sm" onClick={() => setDateFilter(f.key)}>
            {f.label}
          </Button>
        ))}
        <Popover
          open={customDatePopoverOpen}
          onOpenChange={(open) => {
            setCustomDatePopoverOpen(open);
            if (open) setPendingCustomDateRange(undefined);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant={dateFilter === "custom" ? "default" : "outline"} size="sm" className="justify-start text-left font-normal">
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
              selected={pendingCustomDateRange}
              onSelect={(range) => {
                setPendingCustomDateRange(range);
                if (range?.from && range?.to) {
                  const isForward = range.from <= range.to;
                  const from = isForward ? range.from : range.to;
                  const to = isForward ? range.to : range.from;
                  setCustomDateRange({ from: startOfDay(from), to: endOfDay(to) });
                  setDateFilter("custom");
                  setCustomDatePopoverOpen(false);
                }
              }}
              locale={ptBR}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">R$ {stats.salesToday.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground mt-1">Vendas · {stats.ordersCount} pedidos</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">R$ {stats.averageTicket.toFixed(2).replace(".", ",")}</p>
          <p className="text-xs text-muted-foreground mt-1">Ticket Médio</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-bold tracking-tight">{stats.mesasAtendidas}</p>
          <p className="text-xs text-muted-foreground mt-1">Mesas Atendidas</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-4 w-4 text-primary" />
            </div>
          </div>
          {stats.paymentsByMethod.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma forma cadastrada</p>
          ) : (
            <div className="space-y-1.5">
              {stats.paymentsByMethod.map(pm => (
                <div key={pm.method_name} className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground truncate">{pm.method_name}</span>
                  <span className="font-semibold tabular-nums">R$ {pm.total.toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">Formas de Pagamento</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Demonstrativo de Resultados (DRE)</CardTitle>
              <CardDescription className="text-xs">Análise financeira do período selecionado</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-b font-semibold">
              <span>Receita Bruta</span>
              <span className="text-primary tabular-nums">R$ {dreValues.grossRevenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 border-b text-sm pl-8">
              <span className="text-muted-foreground">(-) CMV dos Produtos</span>
              <span className="tabular-nums">R$ {dreValues.cmv.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2.5 border-b bg-muted/20 font-medium text-sm">
              <span>Lucro Bruto</span>
              <span className="text-primary tabular-nums">R$ {dreValues.grossProfit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 border-b text-sm pl-8">
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Despesas Operacionais</span>
              <span></span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 border-b text-sm pl-12">
              <span className="text-muted-foreground">Saídas do Caixa</span>
              <span className="tabular-nums">R$ {dreValues.operationalExpenses.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 border-b text-sm pl-12">
              <span className="text-muted-foreground">Custo Fixo (proporcional)</span>
              <span className="tabular-nums">R$ {dreValues.fixedCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 border-b text-sm pl-12">
              <span className="text-muted-foreground">Custo Variável</span>
              <span className="tabular-nums">R$ {dreValues.variableCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center px-4 py-2 border-b text-sm pl-12">
              <span className="text-muted-foreground">CMO - Mão de Obra (proporcional)</span>
              <span className="tabular-nums">R$ {dreValues.laborCost.toFixed(2)}</span>
            </div>
            <div className={cn(
              "flex justify-between items-center px-4 py-4 font-bold text-lg",
              dreValues.operationalProfit >= 0 ? "bg-primary/5" : "bg-destructive/5"
            )}>
              <span>Lucro Operacional</span>
              <span className={cn("tabular-nums", dreValues.operationalProfit >= 0 ? "text-primary" : "text-destructive")}>
                R$ {dreValues.operationalProfit.toFixed(2)}
              </span>
            </div>
            {dreValues.grossRevenue > 0 && (
              <div className="flex justify-between items-center px-4 py-2 text-xs text-muted-foreground border-t">
                <span>Margem Operacional</span>
                <span className="font-semibold tabular-nums">{((dreValues.operationalProfit / dreValues.grossRevenue) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
      </TabsContent>

      <TabsContent value="employee_credits">
        <Suspense fallback={<div className="p-6 text-muted-foreground">Carregando...</div>}>
          <EmployeeCreditsTab restaurantId={restaurantId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
};
