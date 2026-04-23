/**
 * Gestão de expiração da sessão do painel administrativo.
 *
 * O painel usa autenticação customizada (não usa Supabase Auth),
 * armazenando restaurant_id e staff_id em localStorage. Por padrão,
 * localStorage não expira. Aqui adicionamos uma expiração de 7 dias
 * para reforçar segurança sem afetar a UX (a maioria dos usuários
 * acessa o painel diariamente).
 *
 * Cada login bem-sucedido renova o timestamp via `markSessionActive()`.
 * O `ProtectedRoute` chama `isSessionExpired()` antes de liberar acesso.
 */

const SESSION_TIMESTAMP_KEY = "admin_session_started_at";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

/** Marca o início de uma sessão (chamar após login bem-sucedido). */
export function markSessionActive(): void {
  try {
    localStorage.setItem(SESSION_TIMESTAMP_KEY, String(Date.now()));
  } catch {
    // ignore: localStorage indisponível (modo privado etc.)
  }
}

/**
 * Verifica se a sessão expirou (mais de 7 dias desde o último login).
 * Retorna `true` apenas se houver timestamp e ele estiver vencido.
 * Retorna `false` quando não há timestamp (compatibilidade com sessões
 * antigas anteriores a esta funcionalidade — elas continuam válidas
 * até o próximo login, que registrará o timestamp).
 */
export function isSessionExpired(): boolean {
  try {
    const raw = localStorage.getItem(SESSION_TIMESTAMP_KEY);
    if (!raw) return false;
    const startedAt = Number(raw);
    if (!Number.isFinite(startedAt)) return false;
    return Date.now() - startedAt > SESSION_MAX_AGE_MS;
  } catch {
    return false;
  }
}

/** Remove o timestamp da sessão (chamar em logout explícito). */
export function clearSessionTimestamp(): void {
  try {
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
  } catch {
    // ignore
  }
}

/**
 * Retorna o caminho do painel se o usuário possui sessão válida (logado e não expirada).
 * Caso contrário, retorna `null`. Usado para auto-redirect na landing/login.
 */
export function getActiveAdminRedirectPath(): string | null {
  try {
    if (isSessionExpired()) return null;
    const restaurantId = localStorage.getItem("restaurant_id");
    const staffId = localStorage.getItem("staff_id");
    if (!restaurantId) return null;
    const slug = localStorage.getItem("restaurant_slug");
    if (!slug) return null;
    if (!staffId) return `/login/staff`;
    return `/${slug}/admin`;
  } catch {
    return null;
  }
}
