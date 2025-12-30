import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Gift, Users, Ticket } from "lucide-react";
import ProgramsTab from "./fidelity/ProgramsTab";
import CustomerProgressTab from "./fidelity/CustomerProgressTab";
import CouponsTab from "./fidelity/CouponsTab";

interface FidelityTabProps {
  restaurantId: string;
}

export default function FidelityTab({ restaurantId }: FidelityTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Fidelidade & Cupons</h1>
        <p className="text-muted-foreground">
          Gerencie programas de fidelidade e cupons de desconto
        </p>
      </div>

      <Tabs defaultValue="programas" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
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
