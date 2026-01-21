import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CreditCard, Construction } from "lucide-react";

interface OnlinePaymentsSettingsProps {
  restaurantId: string;
}

const OnlinePaymentsSettings = ({ restaurantId }: OnlinePaymentsSettingsProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Pagamentos Online</h2>
        <p className="text-muted-foreground">
          Receba pagamentos online diretamente no seu delivery
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Integração de Pagamentos
          </CardTitle>
          <CardDescription>
            Configure pagamentos online via Pix e Cartão de Crédito
          </CardDescription>
        </CardHeader>
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Construction className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-lg">Em Desenvolvimento</h3>
              <p className="text-muted-foreground max-w-md">
                A integração de pagamentos online está sendo implementada. 
                Em breve você poderá receber pagamentos via Pix e Cartão de Crédito 
                diretamente pelo seu cardápio digital.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default OnlinePaymentsSettings;
