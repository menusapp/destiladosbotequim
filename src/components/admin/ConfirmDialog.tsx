/**
 * ConfirmDialog — modal padronizado de confirmação para ações destrutivas.
 *
 * Camada visual sobre Radix AlertDialog. Não substitui AlertDialogs já
 * existentes no projeto; é o destino para todos os `window.confirm()` e
 * para novas ações irreversíveis.
 *
 * Variantes:
 *   - "default":     ações neutras (cinza)
 *   - "warning":     ações que merecem atenção (amarelo)
 *   - "destructive": ações irreversíveis comuns (vermelho)
 *   - "critical":    ações catastróficas — exige digitar uma palavra
 *
 * Recursos:
 *   - Lista opcional de avisos contextuais (ex: "3 pedidos em andamento")
 *   - Cooldown configurável no botão de confirmação para impedir duplo-clique
 *   - Spinner durante processamento
 *   - Texto exigido para liberar a confirmação em variant="critical"
 *
 * Não é chamado diretamente pelos componentes — o hook
 * `useConfirmDialog` monta este componente uma vez e expõe uma API
 * imperativa `await confirm(opts)` que retorna boolean.
 */
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { AlertTriangle, AlertCircle, Info, ShieldAlert, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "default" | "warning" | "destructive" | "critical";

export interface ConfirmDialogOptions {
  title: string;
  description?: string;
  /** Texto destacado em vermelho abaixo da descrição (ex: "Esta ação não pode ser desfeita."). */
  consequence?: string;
  /** Lista de avisos contextuais (renderizados em caixa amarela). */
  warnings?: string[];
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Para variant="critical": palavra que o usuário precisa digitar (default "CONFIRMAR"). */
  requireTyping?: string;
  /** Tempo (ms) que o botão de confirmar fica desabilitado após primeiro clique. Default 1500. */
  cooldownMs?: number;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES: Record<ConfirmVariant, { iconBg: string; iconColor: string; Icon: typeof AlertTriangle; actionClass: string }> = {
  default: {
    iconBg: "bg-muted",
    iconColor: "text-muted-foreground",
    Icon: Info,
    actionClass: "",
  },
  warning: {
    iconBg: "bg-yellow-500/10",
    iconColor: "text-yellow-600 dark:text-yellow-500",
    Icon: AlertCircle,
    actionClass: "bg-yellow-600 text-white hover:bg-yellow-700",
  },
  destructive: {
    iconBg: "bg-destructive/10",
    iconColor: "text-destructive",
    Icon: AlertTriangle,
    actionClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
  critical: {
    iconBg: "bg-destructive/15",
    iconColor: "text-destructive",
    Icon: ShieldAlert,
    actionClass: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
  },
};

export function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  consequence,
  warnings,
  variant = "destructive",
  confirmLabel = "Sim, prosseguir",
  cancelLabel = "Cancelar",
  requireTyping,
  cooldownMs = 1500,
}: ConfirmDialogProps) {
  const styles = VARIANT_STYLES[variant];
  const { Icon } = styles;

  const [typedValue, setTypedValue] = useState("");
  const [cooldownActive, setCooldownActive] = useState(false);
  const [processing, setProcessing] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);

  // Reset estado interno sempre que o dialog reabre.
  useEffect(() => {
    if (open) {
      setTypedValue("");
      setCooldownActive(false);
      setProcessing(false);
    }
    return () => {
      if (cooldownTimerRef.current) {
        window.clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, [open]);

  // Para variant=critical, a confirmação exige digitar a palavra exata (case-insensitive).
  const expectedTyping = variant === "critical" ? (requireTyping || "CONFIRMAR") : null;
  const typingOk = !expectedTyping || typedValue.trim().toUpperCase() === expectedTyping.toUpperCase();

  const handleConfirmClick = (e: React.MouseEvent) => {
    // Bloqueia o clique no AlertDialogAction se a confirmação não puder ainda ser executada.
    if (!typingOk || cooldownActive || processing) {
      e.preventDefault();
      return;
    }
    setProcessing(true);
    setCooldownActive(true);
    // Cooldown impede que o usuário clique duas vezes muito rápido caso o handler
    // remontasse o dialog em vez de fechar — defesa em profundidade.
    cooldownTimerRef.current = window.setTimeout(() => {
      setCooldownActive(false);
      cooldownTimerRef.current = null;
    }, cooldownMs);
    onConfirm();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !processing) onCancel();
  };

  const confirmDisabled = !typingOk || cooldownActive || processing;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-start gap-3 mb-1">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", styles.iconBg)}>
              <Icon className={cn("w-5 h-5", styles.iconColor)} />
            </div>
            <AlertDialogTitle className="pt-2">{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-3 text-sm text-muted-foreground">
              {description && <p>{description}</p>}
              {consequence && (
                <p className="text-destructive font-medium flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{consequence}</span>
                </p>
              )}
              {warnings && warnings.length > 0 && (
                <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-1">
                  <p className="font-medium text-yellow-700 dark:text-yellow-400 text-xs uppercase tracking-wide">Atenção</p>
                  <ul className="list-disc list-inside space-y-0.5 text-foreground">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
              {expectedTyping && (
                <div className="space-y-2 pt-1">
                  <p>
                    Digite <strong className="text-foreground font-mono">{expectedTyping}</strong> para liberar a confirmação:
                  </p>
                  <Input
                    autoFocus
                    value={typedValue}
                    onChange={(e) => setTypedValue(e.target.value)}
                    placeholder={expectedTyping}
                    className="font-mono uppercase"
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={processing}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmClick}
            disabled={confirmDisabled}
            className={cn(styles.actionClass)}
          >
            {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
