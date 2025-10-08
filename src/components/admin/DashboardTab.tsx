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

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  cardPayments: number;
  pixPayments: number;
  cashPayments: number;
}

const DashboardTab = ({ restaurantId }: { restaurantId: string }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    cardPayments: 0,
    pixPayments: 0,
    cashPayments: 0,
  });
  const [dateFilter, setDateFilter] = useState<string>("today");
  const [customDateFrom, setCustomDateFrom] = useState<Date>();
  const [customDateTo, setCustomDateTo] = useState<Date>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [restaurantId, dateFilter, customDateFrom, customDateTo]);

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
        if (customDateFrom && customDateTo) {
          startDate = startOfDay(customDateFrom);
          endDate = endOfDay(customDateTo);
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
      // Buscar todas as mesas do restaurante
      const { data: tables } = await supabase
        .from("tables")
        .select("id")
        .eq("restaurant_id", restaurantId);

      if (!tables || tables.length === 0) {
        setStats({
          totalRevenue: 0,
          totalOrders: 0,
          cardPayments: 0,
          pixPayments: 0,
          cashPayments: 0,
        });
        setLoading(false);
        return;
      }

      const tableIds = tables.map((t) => t.id);

      // Buscar contas pagas no período
      const { data: bills } = await supabase
        .from("bills")
        .select("*")
        .in("table_id", tableIds)
        .eq("status", "paid")
        .gte("paid_at", startDate.toISOString())
        .lte("paid_at", endDate.toISOString());

      if (!bills) {
        setStats({
          totalRevenue: 0,
          totalOrders: 0,
          cardPayments: 0,
          pixPayments: 0,
          cashPayments: 0,
        });
        setLoading(false);
        return;
      }

      // Calcular estatísticas
      const totalRevenue = bills.reduce((sum, bill) => sum + Number(bill.total_amount), 0);
      const totalOrders = bills.length;
      const cardPayments = bills.filter((b) => b.payment_method === "card").length;
      const pixPayments = bills.filter((b) => b.payment_method === "pix").length;
      const cashPayments = bills.filter((b) => b.payment_method === "cash").length;

      setStats({
        totalRevenue,
        totalOrders,
        cardPayments,
        pixPayments,
        cashPayments,
      });
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
              {dateFilter === "custom" && customDateFrom && customDateTo
                ? `${format(customDateFrom, "dd/MM/yyyy", { locale: ptBR })} - ${format(customDateTo, "dd/MM/yyyy", { locale: ptBR })}`
                : "Personalizado"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 space-y-2">
              <div>
                <label className="text-sm font-medium">Data inicial</label>
                <Calendar
                  mode="single"
                  selected={customDateFrom}
                  onSelect={(date) => {
                    setCustomDateFrom(date);
                    if (date && customDateTo) {
                      setDateFilter("custom");
                    }
                  }}
                  locale={ptBR}
                />
              </div>
              <div>
                <label className="text-sm font-medium">Data final</label>
                <Calendar
                  mode="single"
                  selected={customDateTo}
                  onSelect={(date) => {
                    setCustomDateTo(date);
                    if (date && customDateFrom) {
                      setDateFilter("custom");
                    }
                  }}
                  locale={ptBR}
                />
              </div>
            </div>
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
                  <div>
                    <p className="text-sm text-muted-foreground">Cartão</p>
                    <p className="text-2xl font-bold">{stats.cardPayments}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Smartphone className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">PIX</p>
                    <p className="text-2xl font-bold">{stats.pixPayments}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 border rounded-lg">
                  <Banknote className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dinheiro</p>
                    <p className="text-2xl font-bold">{stats.cashPayments}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default DashboardTab;
