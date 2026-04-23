/**
 * Pré-validação de conexão com o QZ Tray.
 *
 * Suporta dois modos:
 * - passivo: apenas verifica se já existe conexão ativa, SEM abrir popup
 * - ativo: usa o gerenciador central para conectar quando necessário
 *
 * Importante: nunca fecha a conexão depois da checagem.
 */

import qz from "qz-tray";
import { ensureQzConnected } from "@/lib/qzConnectionManager";

export type QzConnectionStatus =
  | { ok: true; alreadyConnected: boolean }
  | { ok: false; reason: string };

interface CheckQzTrayConnectionOptions {
  timeoutMs?: number;
  connectIfNeeded?: boolean;
}

export async function checkQzTrayConnection(
  options: number | CheckQzTrayConnectionOptions = {}
): Promise<QzConnectionStatus> {
  const normalized =
    typeof options === "number"
      ? { timeoutMs: options, connectIfNeeded: true }
      : {
          timeoutMs: options.timeoutMs ?? 3000,
          connectIfNeeded: options.connectIfNeeded ?? true,
        };

  console.group("🔎 [QZ Check] Verificando conexão com QZ Tray…");
  try {
    if (qz.websocket.isActive()) {
      console.log("✅ [QZ Check] conexão já ativa.");
      console.groupEnd();
      return { ok: true, alreadyConnected: true };
    }

    if (!normalized.connectIfNeeded) {
      console.log("ℹ️ [QZ Check] modo passivo: não vai conectar automaticamente.");
      console.groupEnd();
      return { ok: false, reason: "QZ Tray desconectado" };
    }

    console.log("🔄 [QZ Check] sem conexão ativa; solicitando conexão ao manager.");
    await ensureQzConnected({ timeoutMs: normalized.timeoutMs, retries: 1 });
    console.log("✅ [QZ Check] conexão estabelecida e mantida ativa.");
    console.groupEnd();
    return { ok: true, alreadyConnected: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("❌ [QZ Check] QZ Tray indisponível:", message);
    console.groupEnd();
    return { ok: false, reason: message };
  }
}
