import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductsGrid from "./ProductsGrid";
import CategoriesTab from "./CategoriesTab";
import DestaquesTab from "./DestaquesTab";

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
        <p className="text-sm text-muted-foreground mt-1">Gerencie produtos, categorias e destaques</p>
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
            value="categorias"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Categorias
          </TabsTrigger>
          <TabsTrigger 
            value="destaques"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Destaques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-6">
          <ProductsGrid restaurantId={restaurantId} isRestaurantOpen={isRestaurantOpen} />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <CategoriesTab restaurantId={restaurantId} isRestaurantOpen={isRestaurantOpen} />
        </TabsContent>

        <TabsContent value="destaques" className="mt-6">
          <DestaquesTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CardapioTab;
