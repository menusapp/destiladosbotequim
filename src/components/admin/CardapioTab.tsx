import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductsGrid from "./ProductsGrid";
import ComplementosTab from "./ComplementosTab";
import CategoriesTab from "./CategoriesTab";
import DestaquesTab from "./DestaquesTab";
import MenuDigitizerDialog, { type ImportMode } from "./MenuDigitizerDialog";
import ImportIfoodDialog from "./ImportIfoodDialog";
import { supabase } from "@/integrations/supabase/client";

interface CardapioTabProps {
  restaurantId: string;
  isRestaurantOpen: boolean;
}

const CardapioTab = ({ restaurantId, isRestaurantOpen: _isRestaurantOpen }: CardapioTabProps) => {
  // Edição de cardápio liberada mesmo com restaurante aberto.
  // Alterações são salvas direto no banco e propagadas via realtime para Delivery, Mesa e Totem.
  const isRestaurantOpen = false;
  const [activeTab, setActiveTab] = useState("produtos");
  const [digitizerOpen, setDigitizerOpen] = useState(false);
  const [digitizerMode, setDigitizerMode] = useState<ImportMode>("products");
  const [refreshKey, setRefreshKey] = useState(0);
  const [complementsRefreshKey, setComplementsRefreshKey] = useState(0);
  const [ifoodImportOpen, setIfoodImportOpen] = useState(false);
  const [ifoodConnected, setIfoodConnected] = useState(false);

  useEffect(() => {
    const checkIfood = async () => {
      const { data } = await supabase.rpc("admin_get_ifood_config", { p_restaurant_id: restaurantId });
      if (data && typeof data === "object" && (data as any).access_token === "connected") {
        setIfoodConnected(true);
      }
    };
    checkIfood();
  }, [restaurantId]);

  const handleImportComplete = () => {
    if (digitizerMode === "complements") {
      setComplementsRefreshKey((k) => k + 1);
    } else {
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground leading-tight">Cardápio</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie produtos, categorias, complementos e destaques</p>
        </div>
      </div>

      <MenuDigitizerDialog
        open={digitizerOpen}
        onOpenChange={setDigitizerOpen}
        restaurantId={restaurantId}
        onImportComplete={handleImportComplete}
        mode={digitizerMode}
      />

      <ImportIfoodDialog
        open={ifoodImportOpen}
        onOpenChange={setIfoodImportOpen}
        restaurantId={restaurantId}
        onImportComplete={() => setRefreshKey((k) => k + 1)}
      />

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
            value="complementos"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Complementos
          </TabsTrigger>
          <TabsTrigger 
            value="destaques"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Destaques
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-6">
          <ProductsGrid
            key={refreshKey}
            restaurantId={restaurantId}
            isRestaurantOpen={isRestaurantOpen}
            onOpenDigitizer={() => { setDigitizerMode("products"); setDigitizerOpen(true); }}
            onOpenIfoodImport={() => setIfoodImportOpen(true)}
            ifoodConnected={ifoodConnected}
          />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <CategoriesTab restaurantId={restaurantId} isRestaurantOpen={isRestaurantOpen} />
        </TabsContent>

        <TabsContent value="complementos" className="mt-6">
          <ComplementosTab key={complementsRefreshKey} restaurantId={restaurantId} isRestaurantOpen={isRestaurantOpen} onOpenDigitizer={() => { setDigitizerMode("complements"); setDigitizerOpen(true); }} />
        </TabsContent>

        <TabsContent value="destaques" className="mt-6">
          <DestaquesTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CardapioTab;
