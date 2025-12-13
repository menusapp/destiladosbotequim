import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Construction } from "lucide-react";

const PrintersSettings = ({ restaurantId }: { restaurantId: string }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Impressoras</h2>
        <p className="text-muted-foreground">Configure as impressoras para comandas e cupons</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Printer className="h-12 w-12 text-muted-foreground" />
            <Construction className="h-8 w-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Esta funcionalidade está sendo desenvolvida. Em breve você poderá configurar
            impressoras térmicas para imprimir comandas e cupons automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PrintersSettings;
