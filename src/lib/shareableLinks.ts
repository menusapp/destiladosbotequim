/**
 * Helpers centralizados para gerar links públicos do restaurante.
 *
 * Formato preferido: subdomínio (`slug.menusapp.com.br/...`)
 * Fallback aceito:    path antigo (`menusapp.com.br/slug/...`)
 *
 * - `getPublicMenuLink(slug, extraPath?)` → URL pública limpa (subdomínio).
 * - `getDirectMenuLink(slug, extraPath?)` → mesmo que acima (mantido por
 *   retrocompatibilidade).
 * - `getSubdomainMenuLink(slug)`         → subdomínio explícito (ex.: para
 *   exibir como "link mais bonito" na UI).
 * - `getLegacyMenuLink(slug, extraPath?)` → formato antigo path-based (fallback
 *   exibido para o usuário caso o subdomínio não funcione).
 * - `getShareableMenuLink(slug, extraPath?)` → URL com prévia rica para
 *   WhatsApp/redes sociais (passa pela edge function `menu-link-preview`).
 * - `getTableMenuLink(slug, tableNumber)`  → link de QR Code para mesa.
 */

const PUBLIC_DOMAIN = "menusapp.com.br";
const SUPABASE_PROJECT_REF = "nrddbsudiphrvgfneqle";
const PREVIEW_FN_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/menu-link-preview`;

function joinPath(base: string, extraPath?: string): string {
  if (!extraPath) return base;
  const cleaned = extraPath.replace(/^\/+/, "");
  return `${base}/${cleaned}`;
}

/**
 * URL pública canônica do cardápio — formato subdomínio.
 * Ex.: getPublicMenuLink("rods") → "https://rods.menusapp.com.br"
 *      getPublicMenuLink("rods", "mesa/3") → "https://rods.menusapp.com.br/mesa/3"
 */
export function getPublicMenuLink(slug: string, extraPath?: string): string {
  return joinPath(`https://${slug}.${PUBLIC_DOMAIN}`, extraPath);
}

/**
 * Mantido como alias do formato preferido (subdomínio) para que código
 * existente que chamava `getDirectMenuLink` continue funcionando.
 */
export function getDirectMenuLink(slug: string, extraPath?: string): string {
  return getPublicMenuLink(slug, extraPath);
}

/**
 * Subdomínio explícito (mesmo que getPublicMenuLink, mantido para clareza
 * em telas que mostram "Subdomínio (recomendado)").
 */
export function getSubdomainMenuLink(slug: string): string {
  return getPublicMenuLink(slug);
}

/**
 * Formato antigo (path-based) — continua funcionando via fallback de roteamento
 * e é exibido como alternativa caso o subdomínio falhe.
 */
export function getLegacyMenuLink(slug: string, extraPath?: string): string {
  return joinPath(`https://${PUBLIC_DOMAIN}/${slug}`, extraPath);
}

/**
 * URL com prévia rica (Open Graph) para WhatsApp / redes sociais.
 * Roteia pela edge function `menu-link-preview`, que devolve HTML com og:image
 * e redireciona o navegador para a URL canônica (subdomínio).
 */
export function getShareableMenuLink(slug: string, extraPath?: string): string {
  return joinPath(`${PREVIEW_FN_BASE}/${slug}`, extraPath);
}

/**
 * Link para a mesa (QR code).
 * Sempre via prévia para que ao compartilhar pelo WhatsApp apareça a logo.
 */
export function getTableMenuLink(slug: string, tableNumber: number): string {
  return getShareableMenuLink(slug, `mesa/${tableNumber}`);
}
