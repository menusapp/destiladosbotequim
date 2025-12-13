import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, Construction } from "lucide-react";

const WhatsAppSettings = ({ restaurantId }: { restaurantId: string }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Automação WhatsApp</h2>
        <p className="text-muted-foreground">Configure notificações automáticas via WhatsApp</p>
      </div>

      <Card>
        <CardContent className="py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
            <Construction className="h-8 w-8 text-orange-500" />
          </div>
          <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Esta funcionalidade está sendo desenvolvida. Em breve você poderá configurar
            mensagens automáticas de WhatsApp para notificar clientes sobre o status dos pedidos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppSettings;
