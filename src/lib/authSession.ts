/**
 * Token de sessão assinado (JWT) que dá identidade autenticada ao app.
 *
 * O painel/PDV usa autenticação customizada (RPCs + localStorage) e, até então,
 * falava com o banco como papel público `anon`. A partir daqui, após o login o
 * app recebe da edge function `issue-session-token` um JWT assinado carregando
 * os claims `restaurant_id` / `staff_id` / `role`. Esse token é anexado como
 * `Authorization: Bearer` em todas as requisições (ver client.ts), fazendo o
 * app operar como `authenticated` — o que permite ao RLS distinguir um
 * funcionário legítimo de um visitante anônimo.
 *
 * O cliente público do cardápio (sem login) permanece `anon`, sem token.
 */

const TOKEN_KEY = "sb_session_token";
const TOKEN_EXP_KEY = "sb_session_token_exp"; // epoch em segundos

/** Guarda o token e sua expiração (chamar após login bem-sucedido). */
export function setSessionToken(token: string, expiresAt: number): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
  } catch {
    // ignore: localStorage indisponível
  }
}

/**
 * Retorna o token vigente, ou `null` se ausente/expirado.
 * Se expirado, limpa-o para o app voltar a operar como anon (e o
 * ProtectedRoute redirecionar ao login).
 */
export function getSessionToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const exp = Number(localStorage.getItem(TOKEN_EXP_KEY));
    if (Number.isFinite(exp) && exp > 0 && Date.now() / 1000 >= exp) {
      clearSessionToken();
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/** Remove o token de sessão (chamar em logout/expiração). */
export function clearSessionToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_EXP_KEY);
  } catch {
    // ignore
  }
}
