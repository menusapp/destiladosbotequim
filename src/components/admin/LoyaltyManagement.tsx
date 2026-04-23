import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { Gift, TrendingUp } from "lucide-react";

interface LoyaltyConfig {
  enabled: boolean;
  pointsPerReal: number;
  realPerPoint: number;
}

interface TopCustomer {
  customer_cpf: string;
  customer_name?: string;
  points_balance: number;
  total_earned: number;
  total_redeemed: number;
}

interface LoyaltyManagementProps {
  restaurantId: string;
}

export default function LoyaltyManagement({ restaurantId }: LoyaltyManagementProps) {
  const [config, setConfig] = useState<LoyaltyConfig>({
    enabled: false,
    pointsPerReal: 1,
    realPerPoint: 0.01,
  });
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConfig();
    fetchTopCustomers();
  }, [restaurantId]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("loyalty_enabled, loyalty_points_per_real, loyalty_real_per_point")
        .eq("id", restaurantId)
        .single();

      if (error) throw error;

      if (data) {
        setConfig({
          enabled: data.loyalty_enabled || false,
          pointsPerReal: parseFloat(String(data.loyalty_points_per_real)) || 1,
          realPerPoint: parseFloat(String(data.loyalty_real_per_point)) || 0.01,
        });
      }
    } catch (error) {
      console.error("Error fetching loyalty config:", error);
      toast.error("Erro ao carregar configuração");
    } finally {
      setLoading(false);
    }
  };

  const fetchTopCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("loyalty_points")
        .select("customer_cpf, points_balance, total_earned, total_redeemed")
        .eq("restaurant_id", restaurantId)
        .order("total_earned", { ascending: false })
        .limit(10);

      if (error) throw error;

      const baseList = data || [];
      const cpfs = baseList.map((c) => c.customer_cpf).filter(Boolean);

      // Resolve customer names in a SINGLE query (was N+1: 10 customers → 10 queries).
      // We pick the most-recent customer_name for each CPF in this restaurant.
      const namesByCpf = new Map<string, string>();
      if (cpfs.length > 0) {
        const { data: ordersData } = await supabase
          .from("orders")
          .select("customer_cpf, customer_name, created_at")
          .eq("restaurant_id", restaurantId)
          .in("customer_cpf", cpfs)
          .order("created_at", { ascending: false });

        for (const row of ordersData || []) {
          if (row.customer_cpf && row.customer_name && !namesByCpf.has(row.customer_cpf)) {
            namesByCpf.set(row.customer_cpf, row.customer_name);
          }
        }
      }

      setTopCustomers(
        baseList.map((customer) => ({
          ...customer,
          customer_name: namesByCpf.get(customer.customer_cpf),
        })),
      );
    } catch (error) {
      console.error("Error fetching top customers:", error);
    }
  };

  const handleToggleProgram = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ loyalty_enabled: enabled })
        .eq("id", restaurantId);

      if (error) throw error;

      setConfig({ ...config, enabled });
      toast.success(enabled ? "Programa de fidelidade ativado!" : "Programa de fidelidade desativado!");
    } catch (error) {
      console.error("Error toggling loyalty program:", error);
      toast.error("Erro ao atualizar programa");
    }
  };

  const handleSaveConfig = async () => {
    if (config.pointsPerReal <= 0 || config.realPerPoint <= 0) {
      toast.error("Os valores devem ser maiores que zero");
      return;
    }

    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          loyalty_points_per_real: config.pointsPerReal,
          loyalty_real_per_point: config.realPerPoint,
        })
        .eq("id", restaurantId);

      if (error) throw error;

      toast.success("Configuração salva!");
    } catch (error) {
      console.error("Error saving loyalty config:", error);
      toast.error("Erro ao salvar configuração");
    }
  };

  if (loading) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Gift className="w-5 h-5" />
                Programa de Fidelidade
              </CardTitle>
              <CardDescription>
                Recompense clientes fiéis com pontos que podem ser trocados por descontos
              </CardDescription>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={handleToggleProgram}
            />
          </div>
        </CardHeader>

        {config.enabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pontos por Real gasto</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={config.pointsPerReal}
                  onChange={(e) =>
                    setConfig({ ...config, pointsPerReal: parseFloat(e.target.value) || 1 })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Ex: 1 = Cliente ganha 1 ponto a cada R$1 gasto
                </p>
              </div>

              <div>
                <Label>Valor de cada ponto (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={config.realPerPoint}
                  onChange={(e) =>
                    setConfig({ ...config, realPerPoint: parseFloat(e.target.value) || 0.01 })
                  }
                />
                <p className="text-sm text-muted-foreground mt-1">
                  Ex: 0.01 = 100 pontos = R$1 de desconto
                </p>
              </div>
            </div>

            <Button onClick={handleSaveConfig}>Salvar Configuração</Button>

            {/* Exemplo visual */}
            <div className="bg-muted p-4 rounded-lg">
              <h4 className="font-medium mb-2">Exemplo prático:</h4>
              <p className="text-sm">
                Cliente faz pedido de <strong>R$50,00</strong>
                <br />
                → Ganha <strong>{(50 * config.pointsPerReal).toFixed(0)} pontos</strong>
                <br />
                → {(50 * config.pointsPerReal).toFixed(0)} pontos ={" "}
                <strong>R$ {(50 * config.pointsPerReal * config.realPerPoint).toFixed(2)}</strong> de
                desconto em futuras compras
              </p>
            </div>
          </CardContent>
        )}
      </Card>

      {config.enabled && topCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Top 10 Clientes Fiéis
            </CardTitle>
            <CardDescription>
              Clientes que mais acumularam pontos no programa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Total Ganho</TableHead>
                  <TableHead className="text-right">Total Resgatado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomers.map((customer, index) => (
                  <TableRow key={customer.customer_cpf}>
                    <TableCell className="font-medium">{index + 1}º</TableCell>
                    <TableCell>{customer.customer_name || "-"}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {customer.customer_cpf.replace(
                        /(\d{3})(\d{3})(\d{3})(\d{2})/,
                        "$1.$2.$3-$4"
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {customer.points_balance} pts
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      +{customer.total_earned} pts
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      -{customer.total_redeemed} pts
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {config.enabled && topCustomers.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente com pontos ainda</h3>
            <p className="text-muted-foreground">
              Os clientes começarão a acumular pontos conforme fizerem pedidos
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
