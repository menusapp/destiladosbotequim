/**
 * Configuração persistente da impressora térmica (QZ Tray).
 *
 * Guarda a escolha do usuário em localStorage para não precisar
 * selecionar a impressora toda vez.
 *
 * NÃO afeta a impressão antiga (window.print) — usado apenas
 * pela nova impressão via QZ Tray (printOrderWithQz).
 */

import qz from "qz-tray";

const STORAGE_KEY = "qz:selectedPrinter";
const ONBOARDING_KEY = "qz:configured";
const ONBOARDING_DISMISSED_KEY = "qz:onboardingDismissed";

/** Marca o onboarding como concluído (impressora configurada e testada). */
export function markQzConfigured(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, "true");
  } catch {
    // ignore
  }
}

/** Indica se o usuário já completou o onboarding do QZ. */
export function isQzConfigured(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "true";
  } catch {
    return false;
  }
}

/** Marca o onboarding como "dispensado por agora" (não mostra mais nesta sessão). */
export function dismissQzOnboarding(): void {
  try {
    sessionStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
  } catch {
    // ignore
  }
}

export function isQzOnboardingDismissed(): boolean {
  try {
    return sessionStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function getSavedQzPrinter(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSavedQzPrinter(name: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, name);
    console.log("💾 [QZ Config] Impressora salva:", name);
  } catch (e) {
    console.warn("[QZ Config] Falha ao salvar impressora:", e);
  }
}

export function clearSavedQzPrinter(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log("🧹 [QZ Config] Impressora removida da configuração.");
  } catch {
    // ignore
  }
}

/** Lista impressoras conectando ao QZ Tray (e desconecta ao final). */
export async function listQzPrinters(): Promise<string[]> {
  const wasActive = qz.websocket.isActive();
  try {
    if (!wasActive) await qz.websocket.connect();
    const printers = (await qz.printers.find()) as string[];
    console.log(`🖨️ [QZ Config] ${printers.length} impressora(s):`, printers);
    return printers;
  } finally {
    if (!wasActive && qz.websocket.isActive()) {
      try {
        await qz.websocket.disconnect();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Resolve qual impressora usar no momento da impressão:
 * 1) Se houver impressora salva E ela ainda existir → usa ela.
 * 2) Se houver salva mas NÃO existir mais → fallback para a padrão + log.
 * 3) Se não houver salva → usa a padrão + log.
 *
 * Pré-requisito: WebSocket QZ já conectado.
 */
export async function resolveQzPrinter(): Promise<{
  printer: string | null;
  source: "saved" | "default-fallback" | "default-no-config";
}> {
  const saved = getSavedQzPrinter();

  let available: string[] = [];
  try {
    available = (await qz.printers.find()) as string[];
  } catch (e) {
    console.warn("[QZ Config] Falha ao listar impressoras:", e);
  }

  if (saved) {
    const found = available.includes(saved);
    if (found) {
      console.log(`✅ [QZ Config] Usando impressora salva: "${saved}"`);
      return { printer: saved, source: "saved" };
    }
    console.warn(
      `⚠️ [QZ Config] Impressora salva "${saved}" não encontrada no sistema. Usando padrão como fallback.`
    );
    const def = (await qz.printers.getDefault()) as string;
    console.log(`↩️ [QZ Config] Padrão (fallback): "${def}"`);
    return { printer: def ?? null, source: "default-fallback" };
  }

  console.warn(
    "⚠️ [QZ Config] Nenhuma impressora salva. Usando a padrão do sistema."
  );
  const def = (await qz.printers.getDefault()) as string;
  console.log(`↩️ [QZ Config] Padrão: "${def}"`);
  return { printer: def ?? null, source: "default-no-config" };
}

// Helpers expostos no window para teste rápido via DevTools
if (typeof window !== "undefined") {
  (window as any).qzConfig = {
    list: listQzPrinters,
    get: getSavedQzPrinter,
    set: setSavedQzPrinter,
    clear: clearSavedQzPrinter,
  };
}
