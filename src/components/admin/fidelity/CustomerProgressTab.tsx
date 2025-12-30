import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Gift, AlertCircle } from "lucide-react";

interface CustomerProgress {
  id: string;
  customer_cpf: string;
  purchase_count: number;
  total_spent: number;
  last_reward_trigger: number;
  customer_name?: string;
}

interface LoyaltyProgram {
  id: string;
  name: string;
  type: string;
  rewards: {
    trigger_value: number;
    reward_type: string;
    reward_value: number | null;
    description: string | null;
  }[];
}

interface CustomerProgressTabProps {
  restaurantId: string;
}

export default function CustomerProgressTab({ restaurantId }: CustomerProgressTabProps) {
  const [activeProgram, setActiveProgram] = useState<LoyaltyProgram | null>(null);
  const [customers, setCustomers] = useState<CustomerProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchActiveProgram();
  }, [restaurantId]);

  const fetchActiveProgram = async () => {
    try {
      const { data: program, error } = await supabase
        .from("loyalty_programs")
        .select(`
          *,
          loyalty_program_rewards(*)
        `)
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      if (program) {
        setActiveProgram({
          ...program,
          rewards: program.loyalty_program_rewards || [],
        });
        await fetchCustomerProgress(program.id);
      } else {
        setActiveProgram(null);
      }
    } catch (error) {
      console.error("Error fetching active program:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerProgress = async (programId: string) => {
    try {
      const { data: progress, error } = await supabase
        .from("customer_loyalty_progress")
        .select("*")
        .eq("program_id", programId)
        .order("purchase_count", { ascending: false });

      if (error) throw error;

      // Fetch customer names from orders
      const cpfs = progress?.map(p => p.customer_cpf) || [];
      const { data: orders } = await supabase
        .from("orders")
        .select("customer_cpf, customer_name")
        .in("customer_cpf", cpfs)
        .eq("restaurant_id", restaurantId);

      const cpfToName: Record<string, string> = {};
      orders?.forEach(o => {
        if (!cpfToName[o.customer_cpf]) {
          cpfToName[o.customer_cpf] = o.customer_name;
        }
      });

      setCustomers(progress?.map(p => ({
        ...p,
        customer_name: cpfToName[p.customer_cpf] || "Cliente",
      })) || []);
    } catch (error) {
      console.error("Error fetching customer progress:", error);
    }
  };

  const getNextReward = (customer: CustomerProgress) => {
    if (!activeProgram) return null;
    
    const currentValue = activeProgram.type === "purchases" 
      ? customer.purchase_count 
      : customer.total_spent;

    const sortedRewards = [...activeProgram.rewards].sort((a, b) => a.trigger_value - b.trigger_value);
    
    // Find next reward that hasn't been claimed
    for (const reward of sortedRewards) {
      if (reward.trigger_value > customer.last_reward_trigger) {
        return {
          reward,
          progress: Math.min((currentValue / reward.trigger_value) * 100, 100),
          remaining: Math.max(reward.trigger_value - currentValue, 0),
        };
      }
    }
    return null;
  };

  const formatCPF = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  };

  const getRewardDescription = (reward: any) => {
    switch (reward.reward_type) {
      case "discount_percentage":
        return `${reward.reward_value}% de desconto`;
      case "discount_fixed":
        return `R$ ${reward.reward_value} de desconto`;
      case "free_item":
        return "Item grátis";
      case "free_delivery":
        return "Entrega grátis";
      default:
        return reward.description || "Recompensa";
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.customer_cpf.includes(searchTerm.replace(/\D/g, "")) ||
    c.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  if (!activeProgram) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-medium mb-2">Nenhum programa ativo</h3>
          <p className="text-muted-foreground">
            Ative um programa de fidelidade na aba "Programas" para ver o progresso dos clientes
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Progresso dos Clientes
          </h2>
          <p className="text-sm text-muted-foreground">
            Programa ativo: <span className="font-medium">{activeProgram.name}</span>
            {" "}({activeProgram.type === "purchases" ? "por compras" : "por valor gasto"})
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por CPF ou nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {customers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Gift className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Nenhum cliente ainda</h3>
            <p className="text-muted-foreground">
              Quando clientes fizerem pedidos, o progresso deles aparecerá aqui
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead className="text-center">
                    {activeProgram.type === "purchases" ? "Compras" : "Total Gasto"}
                  </TableHead>
                  <TableHead>Próxima Recompensa</TableHead>
                  <TableHead className="w-[200px]">Progresso</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const nextReward = getNextReward(customer);
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.customer_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCPF(customer.customer_cpf)}
                      </TableCell>
                      <TableCell className="text-center">
                        {activeProgram.type === "purchases" ? (
                          <Badge variant="secondary">{customer.purchase_count} compras</Badge>
                        ) : (
                          <Badge variant="secondary">R$ {customer.total_spent.toFixed(2)}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {nextReward ? (
                          <div className="text-sm">
                            <div className="font-medium">{getRewardDescription(nextReward.reward)}</div>
                            <div className="text-muted-foreground">
                              {activeProgram.type === "purchases" 
                                ? `Faltam ${Math.ceil(nextReward.remaining)} compras`
                                : `Faltam R$ ${nextReward.remaining.toFixed(2)}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Todas as recompensas obtidas ✓
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {nextReward ? (
                          <div className="space-y-1">
                            <Progress value={nextReward.progress} className="h-2" />
                            <span className="text-xs text-muted-foreground">
                              {nextReward.progress.toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <Badge variant="default">Completo</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
