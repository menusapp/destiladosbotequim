/**
 * Helpers centralizados para gerar links públicos do restaurante.
 *
 * Formato atual: path-based (`menusapp.com.br/{slug}/...`)
 *
 * Os subdomínios (`{slug}.menusapp.com.br`) foram desativados temporariamente
 * pois o domínio é hospedado no Lovable, que não suporta wildcards em domínios
 * customizados. Todas as funções abaixo retornam URLs no formato path-based.
 *
 * - `getPublicMenuLink(slug, extraPath?)` → URL pública do cardápio.
 * - `getDirectMenuLink(slug, extraPath?)` → alias de retrocompatibilidade.
 * - `getSubdomainMenuLink(slug)`          → alias de retrocompatibilidade.
 * - `getLegacyMenuLink(slug, extraPath?)` → mesmo formato (mantido por compat).
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
 * URL pública canônica do cardápio — formato path-based.
 * Ex.: getPublicMenuLink("rods") → "https://menusapp.com.br/rods"
 *      getPublicMenuLink("rods", "mesa/3") → "https://menusapp.com.br/rods/mesa/3"
 */
export function getPublicMenuLink(slug: string, extraPath?: string): string {
  return joinPath(`https://${PUBLIC_DOMAIN}/${slug}`, extraPath);
}

/**
 * Alias mantido para retrocompatibilidade.
 */
export function getDirectMenuLink(slug: string, extraPath?: string): string {
  return getPublicMenuLink(slug, extraPath);
}

/**
 * Alias mantido para retrocompatibilidade — agora retorna o mesmo formato
 * path-based (subdomínios desativados).
 */
export function getSubdomainMenuLink(slug: string): string {
  return getPublicMenuLink(slug);
}

/**
 * Formato legado (mantido como alias do formato atual).
 */
export function getLegacyMenuLink(slug: string, extraPath?: string): string {
  return getPublicMenuLink(slug, extraPath);
}

/**
 * URL com prévia rica (Open Graph) para WhatsApp / redes sociais.
 * Roteia pela edge function `menu-link-preview`, que devolve HTML com og:image
 * e redireciona o navegador para a URL canônica.
 */
export function getShareableMenuLink(slug: string, extraPath?: string): string {
  return joinPath(`${PREVIEW_FN_BASE}/${slug}`, extraPath);
}

/**
 * Link para a mesa (QR code).
 * Usa a URL pública path-based do cardápio local da mesa,
 * para que o cliente abra diretamente o cardápio com a comanda da mesa.
 */
export function getTableMenuLink(slug: string, tableNumber: number): string {
  return getPublicMenuLink(slug, `mesa/${tableNumber}`);
}
