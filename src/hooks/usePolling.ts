import { useEffect, useRef } from "react";

/**
 * Chama `callback` a cada `intervalMs` enquanto `enabled` for true e a aba
 * estiver visível. Usado como fallback de atualização ao vivo no painel, já
 * que o token de sessão não trafega no websocket do Realtime (então eventos
 * de tabelas protegidas por RLS não chegam). Um refetch periódico resolve.
 */
export function usePolling(callback: () => void, intervalMs = 12000, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") cbRef.current?.();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
