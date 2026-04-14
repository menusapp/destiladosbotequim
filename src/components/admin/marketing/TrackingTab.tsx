import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Users, UserX, Eye, MessageSquare, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TrackingTabProps {
  restaurantId: string;
  onCreateCampaign?: (triggerType: string) => void;
}

interface AbandonedSession {
  id: string;
  name: string | null;
  phone: string | null;
  cart_items: any[];
  cart_value: number;
  abandoned_at: string | null;
  last_activity: string | null;
  status: string;
}

interface InactiveCustomer {
  id: string;
  name: string;
  phone: string | null;
  cpf: string;
  last_order_date: string;
  total_orders: number;
  total_spent: number;
}

interface NoPurchaseCustomer {
  id: string;
  name: string;
  phone: string | null;
  cpf: string;
  created_at: string;
}

export function TrackingTab({ restaurantId, onCreateCampaign }: TrackingTabProps) {
  const [metrics, setMetrics] = useState({ sessions: 0, abandoned: 0, rate: 0, value: 0 });
  const [abandonedFilter, setAbandonedFilter] = useState<"24h" | "7d" | "30d">("24h");
  const [abandonedSessions, setAbandonedSessions] = useState<AbandonedSession[]>([]);
  const [inactiveCustomers, setInactiveCustomers] = useState<InactiveCustomer[]>([]);
  const [noPurchaseCustomers, setNoPurchaseCustomers] = useState<NoPurchaseCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    fetchAbandoned();
    fetchInactive();
    fetchNoPurchase();
  }, [restaurantId]);

  useEffect(() => {
    fetchAbandoned();
  }, [abandonedFilter]);

  const fetchMetrics = async () => {
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const [sessionsRes, abandonedRes, potentialRes] = await Promise.all([
        supabase.from("customer_sessions" as any).select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).gte("created_at", todayISO),
        supabase.from("customer_sessions" as any).select("id, cart_value").eq("restaurant_id", restaurantId).eq("status", "abandoned").gte("abandoned_at", todayISO),
        supabase.from("customer_sessions" as any).select("id, cart_value").eq("restaurant_id", restaurantId).in("status", ["cart_added", "checkout_started"]).lt("last_activity", thirtyMinAgo),
      ]);

      const totalSessions = (sessionsRes as any).count || 0;
      const abandonedData = (abandonedRes as any).data || [];
      const potentialData = (potentialRes as any).data || [];

      const allAbandoned = [...abandonedData, ...potentialData];
      const totalAbandoned = allAbandoned.length;
      const totalValue = allAbandoned.reduce((s: number, r: any) => s + (Number(r.cart_value) || 0), 0);

      setMetrics({
        sessions: totalSessions,
        abandoned: totalAbandoned,
        rate: totalSessions > 0 ? Math.round((totalAbandoned / totalSessions) * 100) : 0,
        value: totalValue,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAbandoned = async () => {
    setLoading(true);
    try {
      const now = new Date();
      let since: Date;
      if (abandonedFilter === "24h") since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      else if (abandonedFilter === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      else since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      // Fetch both abandoned and potential abandoned sessions in parallel
      const [abandonedRes, potentialRes] = await Promise.all([
        supabase
          .from("customer_sessions" as any)
          .select("id, name, phone, cart_items, cart_value, abandoned_at, last_activity, status")
          .eq("restaurant_id", restaurantId)
          .eq("status", "abandoned")
          .gte("abandoned_at", since.toISOString())
          .order("abandoned_at", { ascending: false })
          .limit(100) as any,
        supabase
          .from("customer_sessions" as any)
          .select("id, name, phone, cart_items, cart_value, abandoned_at, last_activity, status")
          .eq("restaurant_id", restaurantId)
          .in("status", ["cart_added", "checkout_started"])
          .lt("last_activity", thirtyMinAgo)
          .gte("last_activity", since.toISOString())
          .order("last_activity", { ascending: false })
          .limit(100) as any,
      ]);

      const abandoned = (abandonedRes.data || []) as AbandonedSession[];
      const potential = (potentialRes.data || []) as AbandonedSession[];

      setAbandonedSessions([...potential, ...abandoned]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchInactive = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone, cpf, created_at")
        .eq("restaurant_id", restaurantId);

      if (!customers || customers.length === 0) {
        setInactiveCustomers([]);
        return;
      }

      const inactive: InactiveCustomer[] = [];

      for (const c of customers.slice(0, 200)) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id, created_at, order_items(price_at_order, quantity)")
          .eq("restaurant_id", restaurantId)
          .eq("customer_cpf", c.cpf)
          .order("created_at", { ascending: false });

        if (orders && orders.length > 0) {
          const lastOrder = orders[0] as any;
          if (lastOrder.created_at && lastOrder.created_at < thirtyDaysAgo) {
            const totalSpent = (orders as any[]).reduce((s, o) => {
              const items = o.order_items || [];
              return s + items.reduce((is: number, i: any) => is + (Number(i.price_at_order) || 0) * (i.quantity || 1), 0);
            }, 0);
            inactive.push({
              id: c.id,
              name: c.name,
              phone: c.phone,
              cpf: c.cpf,
              last_order_date: lastOrder.created_at,
              total_orders: orders.length,
              total_spent: totalSpent,
            });
          }
        }
      }

      setInactiveCustomers(inactive);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNoPurchase = async () => {
    try {
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, phone, cpf, created_at")
        .eq("restaurant_id", restaurantId);

      if (!customers || customers.length === 0) {
        setNoPurchaseCustomers([]);
        return;
      }

      const noPurchase: NoPurchaseCustomer[] = [];

      for (const c of customers.slice(0, 200)) {
        const { count } = await supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId)
          .eq("customer_cpf", c.cpf);

        if (!count || count === 0) {
          noPurchase.push({
            id: c.id,
            name: c.name,
            phone: c.phone,
            cpf: c.cpf,
            created_at: c.created_at,
          });
        }
      }

      setNoPurchaseCustomers(noPurchase);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCampaign = (triggerType: string) => {
    onCreateCampaign?.(triggerType);
  };

  const getTimestamp = (session: AbandonedSession) => {
    return session.abandoned_at || session.last_activity;
  };

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.sessions}</p>
              <p className="text-xs text-muted-foreground">Sessões hoje</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.abandoned}</p>
              <p className="text-xs text-muted-foreground">Abandonos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{metrics.rate}%</p>
              <p className="text-xs text-muted-foreground">Taxa abandono</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingCart className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">R$ {metrics.value.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">Valor abandonado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="abandoned" className="space-y-4">
        <TabsList>
          <TabsTrigger value="abandoned" className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Carrinho Abandonado
          </TabsTrigger>
          <TabsTrigger value="inactive" className="gap-2">
            <Users className="h-4 w-4" />
            Inativos
          </TabsTrigger>
          <TabsTrigger value="no-purchase" className="gap-2">
            <UserX className="h-4 w-4" />
            Nunca Compraram
          </TabsTrigger>
        </TabsList>

        {/* Abandoned Carts */}
        <TabsContent value="abandoned" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(["24h", "7d", "30d"] as const).map((f) => (
                <Button
                  key={f}
                  variant={abandonedFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAbandonedFilter(f)}
                >
                  {f === "24h" ? "24 horas" : f === "7d" ? "7 dias" : "30 dias"}
                </Button>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => handleCreateCampaign("abandoned_cart")}
              disabled={!onCreateCampaign}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Criar campanha WhatsApp
            </Button>
          </div>

          {abandonedSessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum carrinho abandonado neste período
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Itens</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tempo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abandonedSessions.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.name || "—"}</TableCell>
                      <TableCell>{s.phone || "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(s.cart_items) ? s.cart_items : []).slice(0, 3).map((item: any, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {item.qty}x {item.name}
                            </Badge>
                          ))}
                          {(Array.isArray(s.cart_items) ? s.cart_items : []).length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{(s.cart_items as any[]).length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">R$ {Number(s.cart_value).toFixed(2)}</TableCell>
                      <TableCell>
                        {s.status === "abandoned" ? (
                          <Badge variant="destructive" className="text-xs">Abandonado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-orange-400 text-orange-600">Potencial</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {getTimestamp(s)
                          ? formatDistanceToNow(new Date(getTimestamp(s)!), { locale: ptBR, addSuffix: true })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Inactive Customers */}
        <TabsContent value="inactive" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={() => handleCreateCampaign("inactive_customer")}
              disabled={!onCreateCampaign}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Criar campanha WhatsApp
            </Button>
          </div>

          {inactiveCustomers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Nenhum cliente inativo encontrado (sem pedidos há 30+ dias)
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Último pedido</TableHead>
                    <TableHead>Total pedidos</TableHead>
                    <TableHead>Total gasto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inactiveCustomers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(c.last_order_date), { locale: ptBR, addSuffix: true })}
                      </TableCell>
                      <TableCell>{c.total_orders}</TableCell>
                      <TableCell className="font-semibold">R$ {c.total_spent.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Never Purchased */}
        <TabsContent value="no-purchase" className="space-y-4">
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              onClick={() => handleCreateCampaign("no_purchase")}
              disabled={!onCreateCampaign}
              className="gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Criar campanha WhatsApp
            </Button>
          </div>

          {noPurchaseCustomers.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                Todos os clientes cadastrados já fizeram pelo menos 1 pedido
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cadastrado há</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {noPurchaseCustomers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {c.created_at
                          ? formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
