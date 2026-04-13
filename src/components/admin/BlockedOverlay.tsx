import { Lock, ShieldOff, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BlockedOverlayProps {
  reason: 'plan' | 'permission' | 'trial_expired';
  requiredPlanName?: string | null;
  onNavigateToPlans?: () => void;
}

export function BlockedOverlay({ reason, requiredPlanName, onNavigateToPlans }: BlockedOverlayProps) {
  if (reason === 'trial_expired') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="max-w-md mx-auto p-8 text-center shadow-xl">
          <Clock className="w-12 h-12 mx-auto mb-4 text-orange-500" />
          <h2 className="text-xl font-bold mb-2">Seu período gratuito encerrou</h2>
          <p className="text-muted-foreground mb-6">
            Seus 7 dias de teste gratuito terminaram. Assine um plano para continuar 
            usando o Menu's e não perder seus dados.
          </p>
          <Button size="lg" onClick={onNavigateToPlans}>
            Ver planos — a partir de R$ 69,90/mês
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Seus produtos, clientes e configurações estão salvos e serão restaurados ao assinar.
          </p>
        </Card>
      </div>
    );
  }

  if (reason === 'permission') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
        <Card className="max-w-md mx-auto p-8 text-center shadow-xl">
          <ShieldOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-bold mb-2">Acesso restrito</h2>
          <p className="text-muted-foreground">
            Sua conta não tem permissão para visualizar esta página.
            Entre em contato com o administrador do restaurante.
          </p>
        </Card>
      </div>
    );
  }

  // reason === 'plan'
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <Card className="max-w-md mx-auto p-8 text-center shadow-xl">
        <Lock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-bold mb-2">Recurso bloqueado</h2>
        <p className="text-muted-foreground mb-4">
          Seu plano atual não inclui acesso a esta página.
        </p>
        {requiredPlanName && (
          <p className="text-sm text-muted-foreground mb-6">
            Faça upgrade para o plano <strong>{requiredPlanName}</strong> para desbloquear.
          </p>
        )}
        <Button onClick={onNavigateToPlans}>
          Ver planos e fazer upgrade
        </Button>
      </Card>
    </div>
  );
}
