import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StockItemsGrid from "./StockItemsGrid";
import StockCategoriesTab from "./StockCategoriesTab";

interface StockTabProps {
  restaurantId: string;
}

export default function StockTab({ restaurantId }: StockTabProps) {
  const [activeTab, setActiveTab] = useState("insumos");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-foreground leading-tight">Estoque</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie insumos e categorias</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 w-full justify-start">
          <TabsTrigger 
            value="insumos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Insumos
          </TabsTrigger>
          <TabsTrigger 
            value="categorias"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insumos" className="mt-6">
          <StockItemsGrid restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <StockCategoriesTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
