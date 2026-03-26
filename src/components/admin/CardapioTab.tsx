import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductsGrid from "./ProductsGrid";
import ComplementosTab from "./ComplementosTab";

interface CardapioTabProps {
  restaurantId: string;
  isRestaurantOpen: boolean;
}

const CardapioTab = ({ restaurantId, isRestaurantOpen }: CardapioTabProps) => {
  const [activeTab, setActiveTab] = useState("produtos");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[32px] font-bold text-foreground leading-tight">Cardápio</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie produtos, categorias, complementos e destaques</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-transparent border-b border-border rounded-none h-auto p-0 w-full justify-start">
          <TabsTrigger 
            value="produtos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Produtos
          </TabsTrigger>
          <TabsTrigger 
            value="complementos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Complementos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-6">
          <ProductsGrid restaurantId={restaurantId} isRestaurantOpen={isRestaurantOpen} />
        </TabsContent>

        <TabsContent value="complementos" className="mt-6">
          <ComplementosTab restaurantId={restaurantId} isRestaurantOpen={isRestaurantOpen} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CardapioTab;
