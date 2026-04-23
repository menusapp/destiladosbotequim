/**
 * Teste isolado de conexão com QZ Tray.
 *
 * Pré-requisito: o QZ Tray deve estar instalado e rodando localmente
 * na máquina onde o navegador está aberto (https://qz.io/download/).
 *
 * Esta função NÃO altera nada do sistema atual de impressão.
 * Serve apenas para validar a conexão WebSocket com o QZ Tray
 * e listar as impressoras disponíveis no sistema operacional.
 */

import qz from "qz-tray";

export interface QzTestResult {
  connected: boolean;
  printers: string[];
  defaultPrinter: string | null;
  version: string | null;
  error?: string;
}

/**
 * Conecta ao QZ Tray, lista impressoras e desconecta.
 * Loga tudo no console para validação manual.
 */
export async function testQzTrayConnection(): Promise<QzTestResult> {
  console.group("🖨️ [QZ Tray] Teste de conexão");

  try {
    // Para o teste em modo "trusted-less" (sem certificado assinado),
    // o QZ Tray pedirá confirmação manual ao usuário no primeiro acesso.
    // Em produção, configure assinatura digital — por enquanto isso é só teste.
    if (!qz.websocket.isActive()) {
      console.log("⏳ Conectando ao QZ Tray (ws://localhost:8181)…");
      await qz.websocket.connect();
    } else {
      console.log("ℹ️ Já estava conectado.");
    }

    const version = await qz.api.getVersion();
    console.log("✅ Conectado. Versão do QZ Tray:", version);

    const printers = (await qz.printers.find()) as string[];
    console.log(`🖨️ ${printers.length} impressora(s) encontrada(s):`);
    printers.forEach((p, i) => console.log(`  ${i + 1}. ${p}`));

    let defaultPrinter: string | null = null;
    try {
      defaultPrinter = (await qz.printers.getDefault()) as string;
      console.log("⭐ Impressora padrão:", defaultPrinter);
    } catch (e) {
      console.warn("⚠️ Não foi possível obter a impressora padrão:", e);
    }

    const result: QzTestResult = {
      connected: true,
      printers,
      defaultPrinter,
      version,
    };

    console.log("📦 Resultado completo:", result);
    console.groupEnd();
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("❌ Falha no teste do QZ Tray:", message);
    console.warn(
      "Verifique se o QZ Tray está instalado e rodando: https://qz.io/download/"
    );
    console.groupEnd();
    return {
      connected: false,
      printers: [],
      defaultPrinter: null,
      version: null,
      error: message,
    };
  } finally {
    // Desconecta para não manter o WebSocket aberto após o teste
    try {
      if (qz.websocket.isActive()) {
        await qz.websocket.disconnect();
        console.log("🔌 [QZ Tray] Desconectado.");
      }
    } catch {
      // ignore
    }
  }
}

// Exposição opcional no window para chamar via DevTools:
//   await window.testQzTrayConnection()
if (typeof window !== "undefined") {
  (window as any).testQzTrayConnection = testQzTrayConnection;
}
