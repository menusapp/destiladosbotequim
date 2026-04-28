import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import StockItemsGrid from "./StockItemsGrid";
import StockCategoriesTab from "./StockCategoriesTab";
import StockMovementsTab from "./StockMovementsTab";
import SuppliersTab from "./SuppliersTab";
import ImportNfeDialog from "./ImportNfeDialog";

interface StockTabProps {
  restaurantId: string;
}

export default function StockTab({ restaurantId }: StockTabProps) {
  const [activeTab, setActiveTab] = useState("insumos");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-foreground leading-tight">Estoque</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie insumos, categorias e movimentações</p>
        </div>
        <Button data-tour="estoque-import-nfe" onClick={() => setImportDialogOpen(true)} className="gap-2">
          <FileText className="h-4 w-4" />
          Importar Nota Fiscal
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList data-tour="estoque-tabs" className="bg-transparent border-b border-border rounded-none h-auto p-0 w-full justify-start">
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
          <TabsTrigger 
            value="movimentacoes"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Movimentações
          </TabsTrigger>
          <TabsTrigger 
            value="fornecedores"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-6 py-3 font-medium"
          >
            Fornecedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="insumos" className="mt-6">
          <StockItemsGrid key={refreshKey} restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="categorias" className="mt-6">
          <StockCategoriesTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-6">
          <StockMovementsTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="fornecedores" className="mt-6">
          <SuppliersTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>

      <ImportNfeDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        restaurantId={restaurantId}
        onImported={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
