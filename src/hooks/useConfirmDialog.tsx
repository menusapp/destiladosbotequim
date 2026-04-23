/**
 * useConfirmDialog — API imperativa para mostrar diálogos de confirmação.
 *
 * Substitui `window.confirm()` em todo o painel admin. Em vez de adicionar
 * JSX em cada componente, basta:
 *
 *   const confirm = useConfirmDialog();
 *   const ok = await confirm({
 *     variant: "destructive",
 *     title: "Excluir produto?",
 *     description: "O produto será removido do cardápio.",
 *     consequence: "Esta ação não pode ser desfeita.",
 *   });
 *   if (ok) executeAction();
 *
 * O `ConfirmDialogProvider` é montado UMA ÚNICA VEZ no topo do painel admin
 * (em RestaurantAdmin.tsx) e expõe uma única instância de ConfirmDialog
 * controlada via context. Como cada chamada usa uma Promise com resolver
 * único, não é seguro abrir dois diálogos simultâneos — o segundo sobrescreve
 * o primeiro. Esse comportamento é intencional: confirmações em cascata
 * confundem o usuário.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmDialogOptions } from "@/components/admin/ConfirmDialog";

type ConfirmFn = (opts: ConfirmDialogOptions) => Promise<boolean>;

const ConfirmDialogContext = createContext<ConfirmFn | null>(null);

interface ProviderState {
  open: boolean;
  options: ConfirmDialogOptions | null;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProviderState>({ open: false, options: null });
  // Resolver guarda a função `resolve` da Promise atual para ser chamada em
  // confirm/cancel. Mantido em ref para sobreviver a re-renders sem trigger extra.
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      // Se já houver uma confirmação aberta, resolvemos a anterior como `false`
      // (equivalente ao usuário ter cancelado) antes de abrir a nova.
      if (resolverRef.current) {
        resolverRef.current(false);
      }
      resolverRef.current = resolve;
      setState({ open: true, options });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
    r?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    const r = resolverRef.current;
    resolverRef.current = null;
    setState((s) => ({ ...s, open: false }));
    r?.(false);
  }, []);

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      {state.options && (
        <ConfirmDialog
          open={state.open}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          {...state.options}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}

/**
 * Retorna a função `confirm` do contexto. Lança fora do provider para
 * deixar o erro óbvio em vez de retornar uma função no-op silenciosa.
 */
export function useConfirmDialog(): ConfirmFn {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error(
      "useConfirmDialog precisa estar dentro de <ConfirmDialogProvider>. " +
      "Verifique se RestaurantAdmin.tsx envolve o app com o provider."
    );
  }
  return ctx;
}
