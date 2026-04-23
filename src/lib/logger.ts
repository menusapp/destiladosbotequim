/**
 * Logger com silenciamento em produção.
 *
 * Mantém TODO o comportamento atual em desenvolvimento (preview, dev server),
 * mas em produção (build final) silencia `log`, `info`, `warn` e `debug`.
 * `error` é SEMPRE preservado para não perder rastros de problemas reais.
 *
 * Uso:
 *   import { logger } from "@/lib/logger";
 *   logger.log("debug info");        // apenas em dev
 *   logger.error("real error", err); // sempre
 *
 * Não substitui `console.error` no código existente — isto é um wrapper
 * opcional para novo código. Para silenciar logs antigos sem reescrever
 * cada linha, chame `installProductionLogSilencer()` uma única vez no
 * bootstrap da aplicação (já feito em `src/main.tsx`).
 */

// `import.meta.env.DEV` é true em `vite dev`/preview e false em build de produção.
const IS_DEV = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true;

const noop = (..._args: unknown[]) => {};

export const logger = {
  log: IS_DEV ? console.log.bind(console) : noop,
  info: IS_DEV ? console.info.bind(console) : noop,
  warn: IS_DEV ? console.warn.bind(console) : noop,
  debug: IS_DEV ? console.debug.bind(console) : noop,
  error: console.error.bind(console),
};

let silencerInstalled = false;

/**
 * Sobrescreve `console.log/info/warn/debug` em produção para no-op.
 * `console.error` permanece intacto. Em dev, não faz nada.
 *
 * Chamar UMA ÚNICA VEZ no bootstrap da aplicação.
 */
export function installProductionLogSilencer(): void {
  if (silencerInstalled) return;
  silencerInstalled = true;
  if (IS_DEV) return;

  // Em produção, silenciamos os métodos verbosos preservando assinatura.
  // `console.error` NÃO é alterado: erros reais continuam sendo reportados.
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.debug = noop;
}
