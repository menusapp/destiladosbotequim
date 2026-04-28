import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Gift, Users, Ticket, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProgramsTab from "./fidelity/ProgramsTab";
import CustomerProgressTab from "./fidelity/CustomerProgressTab";
import CouponsTab from "./fidelity/CouponsTab";

interface FidelityTabProps {
  restaurantId: string;
}

export default function FidelityTab({ restaurantId }: FidelityTabProps) {
  const [stats, setStats] = useState({ programs: 0, customers: 0, coupons: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [programsRes, customersRes, couponsRes] = await Promise.all([
        supabase.from("loyalty_programs").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("is_active", true),
        supabase.from("customer_loyalty_progress").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId),
        supabase.from("coupons").select("id", { count: "exact", head: true }).eq("restaurant_id", restaurantId).eq("is_active", true),
      ]);
      setStats({
        programs: programsRes.count || 0,
        customers: customersRes.count || 0,
        coupons: couponsRes.count || 0,
      });
    };
    fetchStats();
  }, [restaurantId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.025em]">Fidelidade & Cupons</h1>
        <p className="text-muted-foreground font-light">
          Gerencie programas de fidelidade e cupons de desconto
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.programs}</p>
              <p className="text-xs text-muted-foreground">Programas ativos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.customers}</p>
              <p className="text-xs text-muted-foreground">Clientes fidelizados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ticket className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.coupons}</p>
              <p className="text-xs text-muted-foreground">Cupons ativos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="programas" className="space-y-6">
        <TabsList data-tour="fidelidade-tabs" className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
          <TabsTrigger value="programas" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            <span className="hidden sm:inline">Programas</span>
          </TabsTrigger>
          <TabsTrigger value="clientes" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span className="hidden sm:inline">Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="cupons" className="flex items-center gap-2">
            <Ticket className="w-4 h-4" />
            <span className="hidden sm:inline">Cupons</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programas">
          <ProgramsTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="clientes">
          <CustomerProgressTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="cupons">
          <CouponsTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
