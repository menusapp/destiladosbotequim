/**
 * Pré-validação de conexão com o QZ Tray.
 *
 * Tenta abrir uma conexão WebSocket curta com o QZ Tray (ws://localhost:8181)
 * para verificar se o aplicativo está instalado e em execução na máquina
 * do usuário ANTES de tentar imprimir.
 *
 * - NÃO altera a impressão antiga (window.print).
 * - NÃO interfere no fluxo de printOrderWithQz — apenas adiciona uma checagem
 *   prévia para evitar tentativas de impressão sem QZ ativo.
 */

import qz from "qz-tray";

export type QzConnectionStatus =
  | { ok: true; alreadyConnected: boolean }
  | { ok: false; reason: string };

/**
 * Verifica se o QZ Tray está disponível.
 * Se não estava conectado e a checagem abrir conexão para testar,
 * a conexão é fechada ao final para não interferir no estado global.
 */
export async function checkQzTrayConnection(
  timeoutMs = 3000
): Promise<QzConnectionStatus> {
  console.group("🔎 [QZ Check] Verificando conexão com QZ Tray…");
  try {
    if (qz.websocket.isActive()) {
      console.log("✅ QZ Tray já está conectado.");
      console.groupEnd();
      return { ok: true, alreadyConnected: true };
    }

    console.log("⏳ Tentando conectar a ws://localhost:8181…");
    const connectPromise = qz.websocket.connect();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error("Tempo esgotado ao conectar ao QZ Tray")),
        timeoutMs
      )
    );

    await Promise.race([connectPromise, timeoutPromise]);
    console.log("✅ Conexão com QZ Tray estabelecida.");

    // Fecha a conexão de teste — printOrderWithQz reabre quando necessário.
    try {
      await qz.websocket.disconnect();
      console.log("🔌 Conexão de teste fechada.");
    } catch {
      // ignore
    }

    console.groupEnd();
    return { ok: true, alreadyConnected: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("❌ QZ Tray indisponível:", message);
    console.groupEnd();
    return { ok: false, reason: message };
  }
}
