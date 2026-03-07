import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Receipt } from "lucide-react";
import FiscalSettingsTab from "./FiscalSettingsTab";
import NotasFiscaisTab from "./NotasFiscaisTab";

interface FiscalTabProps {
  restaurantId: string;
}

export default function FiscalTab({ restaurantId }: FiscalTabProps) {
  const [activeTab, setActiveTab] = useState("settings");

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="settings" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Configurações Fiscais
          </TabsTrigger>
          <TabsTrigger value="invoices" className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Notas Fiscais
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <FiscalSettingsTab restaurantId={restaurantId} />
        </TabsContent>

        <TabsContent value="invoices">
          <NotasFiscaisTab restaurantId={restaurantId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
