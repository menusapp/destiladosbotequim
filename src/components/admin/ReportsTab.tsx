import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardTab from "./DashboardTab";
import DRETab from "./DRETab";
import CostosTab from "./CostosTab";
import MargensTab from "./MargensTab";

interface ReportsTabProps {
  restaurantId: string;
}

export const ReportsTab = ({ restaurantId }: ReportsTabProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Relatórios</h2>
        <p className="text-muted-foreground">
          Visualize métricas e análises do seu negócio
        </p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="dre">DRE</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="margens">Margens</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="dre" className="space-y-6">
          <DRETab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="custos" className="space-y-6">
          <CostosTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="margens" className="space-y-6">
          <MargensTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};
