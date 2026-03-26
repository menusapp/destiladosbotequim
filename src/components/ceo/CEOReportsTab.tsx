import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformMetricsTab } from "./reports/PlatformMetricsTab";
import { RestaurantDashboardTab } from "./reports/RestaurantDashboardTab";
import { TrendingUp, Store } from "lucide-react";

export function CEOReportsTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Relatórios & Analytics</h2>
      <Tabs defaultValue="platform" className="w-full">
        <TabsList>
          <TabsTrigger value="platform" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Plataforma Menu's
          </TabsTrigger>
          <TabsTrigger value="restaurants" className="flex items-center gap-2">
            <Store className="h-4 w-4" /> Dashboard Restaurantes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="platform">
          <PlatformMetricsTab />
        </TabsContent>
        <TabsContent value="restaurants">
          <RestaurantDashboardTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
