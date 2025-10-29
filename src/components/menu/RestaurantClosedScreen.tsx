import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";

interface RestaurantClosedScreenProps {
  restaurantName: string;
  logoUrl?: string | null;
  primaryColor: string;
}

export default function RestaurantClosedScreen({ 
  restaurantName, 
  logoUrl, 
  primaryColor 
}: RestaurantClosedScreenProps) {
  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: `${primaryColor}10` }}
    >
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center space-y-4">
          {logoUrl && (
            <div className="flex justify-center">
              <img
                src={logoUrl}
                alt={restaurantName}
                className="h-24 w-24 object-contain rounded-lg"
              />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl font-bold">{restaurantName}</CardTitle>
            <CardDescription className="mt-2">Cardápio Digital</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div 
            className="inline-flex items-center justify-center w-20 h-20 rounded-full"
            style={{ backgroundColor: `${primaryColor}20` }}
          >
            <Clock className="h-10 w-10" style={{ color: primaryColor }} />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Ops! Estamos Fechados</h2>
            <p className="text-muted-foreground">
              O restaurante está fechado no momento. Volte mais tarde para fazer seu pedido!
            </p>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Em breve estaremos de volta para atendê-lo! 😊
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
