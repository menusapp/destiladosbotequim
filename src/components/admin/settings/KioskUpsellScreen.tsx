import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import {
  Monitor,
  ShoppingBag,
  Users,
  Gift,
  Package,
  Tablet,
  CheckCircle,
  Sparkles,
} from "lucide-react";

const benefits = [
  { icon: Monitor, text: "Autoatendimento estilo McDonald's" },
  { icon: ShoppingBag, text: "Cliente monta o próprio pedido" },
  { icon: Users, text: "Cadastro por CPF e integração com CRM" },
  { icon: Gift, text: "Fidelidade e cupons integrados" },
  { icon: Package, text: "Integração com estoque e pedidos" },
  { icon: Tablet, text: "Ideal para totem, tablet e balcão" },
];

export default function KioskUpsellScreen() {
  const handleRequestActivation = () => {
    toast.success("Solicitação enviada! Nossa equipe entrará em contato em breve.");
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="overflow-hidden border-primary/20">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Monitor className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Módulo Totem
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Transforme seu atendimento com autoatendimento profissional.
            Seus clientes fazem o pedido sozinhos, direto no tablet ou totem.
          </p>
        </div>

        <CardContent className="p-8 space-y-8">
          {/* Benefits */}
          <div className="grid gap-3">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <b.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-foreground">{b.text}</span>
                <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
              </div>
            ))}
          </div>

          {/* Price */}
          <div className="text-center rounded-xl bg-muted/50 p-6">
            <Badge variant="secondary" className="mb-3">
              <Sparkles className="h-3 w-3 mr-1" />
              Módulo Adicional
            </Badge>
            <div className="flex items-baseline justify-center gap-1 mb-1">
              <span className="text-sm text-muted-foreground">R$</span>
              <span className="text-4xl font-bold text-foreground">49,90</span>
              <span className="text-sm text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Equivalente a R$ 1,66/dia
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full text-base" onClick={handleRequestActivation}>
              <Monitor className="h-5 w-5 mr-2" />
              Adicionar ao plano
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={handleRequestActivation}>
              Falar com suporte / solicitar ativação
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
