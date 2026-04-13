import { Lock, ShieldOff, Clock, CreditCard, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BlockedOverlayProps {
  reason: 'plan' | 'permission' | 'trial_expired' | 'payment_pending' | 'delinquent';
  requiredPlanName?: string | null;
  onNavigateToPlans?: () => void;
}

export function BlockedOverlay({ reason, requiredPlanName, onNavigateToPlans }: BlockedOverlayProps) {
  if (reason === 'payment_pending') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="max-w-md mx-auto p-8 text-center shadow-xl">
          <CreditCard className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
          <h2 className="text-xl font-bold mb-2">Aguardando confirmação de pagamento</h2>
          <p className="text-muted-foreground mb-6">
            Seu restaurante foi criado, mas ainda estamos aguardando a confirmação do pagamento.
            Se já pagou, aguarde alguns minutos para a ativação automática.
          </p>
          <Button size="lg" onClick={onNavigateToPlans}>
            Verificar pagamento
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            A ativação é automática após a confirmação do Mercado Pago.
          </p>
        </Card>
      </div>
    );
  }

  if (reason === 'delinquent') {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <Card className="max-w-md mx-auto p-8 text-center shadow-xl">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h2 className="text-xl font-bold mb-2">Assinatura suspensa</h2>
          <p className="text-muted-foreground mb-6">
            Sua assinatura foi suspensa por falta de pagamento.
            Regularize sua situação para continuar usando o sistema.
          </p>
          <Button size="lg" variant="destructive" onClick={onNavigateToPlans}>
            Regularizar pagamento
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Seus dados estão salvos e serão restaurados após a regularização.
          </p>
        </Card>
      </div>
    );
  }

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
