import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Gift, AlertCircle } from "lucide-react";
import { normalizeSearch } from "@/lib/searchNormalize";

interface LoyaltyProgram {
  id: string;
  name: string;
  type: string;
  activated_at: string | null;
  rewards: {
    trigger_value: number;
    reward_type: string;
    reward_value: number | null;
    description: string | null;
  }[];
}

interface CustomerWithProgress {
  cpf: string;
  name: string;
  phone: string | null;
  purchase_count: number;
  total_spent: number;
}

interface CustomerProgressTabProps {
  restaurantId: string;
}

export default function CustomerProgressTab({ restaurantId }: CustomerProgressTabProps) {
  const [activeProgram, setActiveProgram] = useState<LoyaltyProgram | null>(null);
  const [customers, setCustomers] = useState<CustomerWithProgress[]>([]);
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
        const programData: LoyaltyProgram = {
          id: program.id,
          name: program.name,
          type: program.type,
          activated_at: program.activated_at,
          rewards: program.loyalty_program_rewards || [],
        };
        setActiveProgram(programData);
        await fetchCustomersWithProgress(programData);
      } else {
        setActiveProgram(null);
      }
    } catch (error) {
      console.error("Error fetching active program:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersWithProgress = async (program: LoyaltyProgram) => {
    try {
      // Fetch all customers from CRM
      const { data: crmCustomers, error: crmError } = await supabase
        .from("customers")
        .select("cpf, name, phone")
        .eq("restaurant_id", restaurantId);

      if (crmError) throw crmError;

      if (!crmCustomers || crmCustomers.length === 0) {
        setCustomers([]);
        return;
      }

      // Fetch orders made AFTER the program was activated
      const cpfList = crmCustomers.map(c => c.cpf);
      
      let ordersQuery = supabase
        .from("orders")
        .select(`
          id, customer_cpf, created_at,
          order_items(price_at_order, quantity, order_item_extras(price_at_order))
        `)
        .eq("restaurant_id", restaurantId)
        .in("customer_cpf", cpfList)
        .in("status", ["delivered", "picked_up", "completed"]);

      // Only count orders AFTER activation date
      if (program.activated_at) {
        ordersQuery = ordersQuery.gte("created_at", program.activated_at);
      }

      const { data: ordersData, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // Calculate progress per customer
      const progressByCustomer: Record<string, { purchase_count: number; total_spent: number }> = {};
      
      ordersData?.forEach(order => {
        if (!progressByCustomer[order.customer_cpf]) {
          progressByCustomer[order.customer_cpf] = { purchase_count: 0, total_spent: 0 };
        }
        
        progressByCustomer[order.customer_cpf].purchase_count += 1;
        
        // Calculate order total
        let orderTotal = 0;
        order.order_items?.forEach((item: any) => {
          orderTotal += item.price_at_order * item.quantity;
          item.order_item_extras?.forEach((extra: any) => {
            orderTotal += extra.price_at_order;
          });
        });
        progressByCustomer[order.customer_cpf].total_spent += orderTotal;
      });

      // Merge CRM data with progress
      const customersWithProgress: CustomerWithProgress[] = crmCustomers.map(customer => ({
        cpf: customer.cpf,
        name: customer.name,
        phone: customer.phone,
        purchase_count: progressByCustomer[customer.cpf]?.purchase_count || 0,
        total_spent: progressByCustomer[customer.cpf]?.total_spent || 0,
      }));

      // Sort by proximity to next reward (higher progress first)
      const sortedRewards = [...program.rewards].sort((a, b) => a.trigger_value - b.trigger_value);
      const firstTrigger = sortedRewards[0]?.trigger_value || 1;

      customersWithProgress.sort((a, b) => {
        const valueA = program.type === "purchases" ? a.purchase_count : a.total_spent;
        const valueB = program.type === "purchases" ? b.purchase_count : b.total_spent;
        const progressA = (valueA / firstTrigger) * 100;
        const progressB = (valueB / firstTrigger) * 100;
        return progressB - progressA; // Higher progress first
      });

      setCustomers(customersWithProgress);
    } catch (error) {
      console.error("Error fetching customers with progress:", error);
    }
  };

  const getNextReward = (customer: CustomerWithProgress) => {
    if (!activeProgram) return null;
    
    const currentValue = activeProgram.type === "purchases" 
      ? customer.purchase_count 
      : customer.total_spent;

    const sortedRewards = [...activeProgram.rewards].sort((a, b) => a.trigger_value - b.trigger_value);
    
    // Find next reward that hasn't been reached
    for (const reward of sortedRewards) {
      if (currentValue < reward.trigger_value) {
        return {
          reward,
          progress: Math.min((currentValue / reward.trigger_value) * 100, 100),
          remaining: Math.max(reward.trigger_value - currentValue, 0),
        };
      }
    }
    
    // All rewards achieved
    const lastReward = sortedRewards[sortedRewards.length - 1];
    if (lastReward && currentValue >= lastReward.trigger_value) {
      return {
        reward: lastReward,
        progress: 100,
        remaining: 0,
        completed: true,
      };
    }
    
    return null;
  };

  const formatCPF = (cpf: string) => {
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
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
    c.cpf.includes(searchTerm.replace(/\D/g, "")) ||
    normalizeSearch(c.name).includes(normalizeSearch(searchTerm))
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
            <h3 className="text-lg font-medium mb-2">Nenhum cliente cadastrado</h3>
            <p className="text-muted-foreground">
              Cadastre clientes no CRM para ver o progresso deles aqui
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
                    <TableRow key={customer.cpf}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatCPF(customer.cpf)}
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
                          nextReward.completed ? (
                            <span className="text-muted-foreground">
                              Meta atingida! ✓
                            </span>
                          ) : (
                            <div className="text-sm">
                              <div className="font-medium">{getRewardDescription(nextReward.reward)}</div>
                              <div className="text-muted-foreground">
                                {activeProgram.type === "purchases" 
                                  ? `Faltam ${Math.ceil(nextReward.remaining)} compras`
                                  : `Faltam R$ ${nextReward.remaining.toFixed(2)}`}
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="text-muted-foreground">
                            Sem recompensas configuradas
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {nextReward ? (
                          nextReward.completed ? (
                            <Badge variant="default">Completo</Badge>
                          ) : (
                            <div className="space-y-1">
                              <Progress value={nextReward.progress} className="h-2" />
                              <span className="text-xs text-muted-foreground">
                                {nextReward.progress.toFixed(0)}%
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
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