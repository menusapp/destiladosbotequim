/**
 * Helpers for generating shareable links for the digital menu.
 *
 * - `getShareableMenuLink(slug)` — URL pointing to the `menu-link-preview` edge function.
 *   Used when sharing on WhatsApp / Facebook / Twitter so the preview shows the
 *   restaurant's logo and name (Open Graph meta tags). Browsers are auto-redirected
 *   to the actual SPA menu.
 *
 * - `getDirectMenuLink(slug)` — Plain URL of the digital menu (no preview metadata).
 *   Use when the link doesn't need a rich preview (e.g. internal admin nav).
 *
 * - `getSubdomainMenuLink(slug)` — Pretty subdomain version: `slug.menusapp.com.br/menus`.
 *   Available because the VPS has a wildcard DNS (*.menusapp.com.br).
 *
 * - `getTableMenuLink(slug, tableNumber)` — Link to a specific table's menu (QR codes).
 */

const PUBLIC_DOMAIN = "menusapp.com.br";
const SUPABASE_PROJECT_REF = "nrddbsudiphrvgfneqle";
const PREVIEW_FN_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co/functions/v1/menu-link-preview`;

/**
 * Returns the link that should be shared with customers (WhatsApp, social media).
 * Routes through the `menu-link-preview` edge function so previews show the
 * restaurant's branding.
 */
export function getShareableMenuLink(slug: string, extraPath?: string): string {
  const base = `${PREVIEW_FN_BASE}/${slug}`;
  return extraPath ? `${base}/${extraPath}` : base;
}

/**
 * Direct path-based link to the digital menu (no preview metadata).
 */
export function getDirectMenuLink(slug: string): string {
  return `https://${PUBLIC_DOMAIN}/${slug}`;
}

/**
 * Pretty subdomain link: `slug.menusapp.com.br/menus`.
 * Works because the VPS has wildcard DNS configured.
 */
export function getSubdomainMenuLink(slug: string): string {
  return `https://${slug}.${PUBLIC_DOMAIN}/menus`;
}

/**
 * Link to a specific table's menu (used by QR codes).
 * Always shareable via the preview function.
 */
export function getTableMenuLink(slug: string, tableNumber: number): string {
  return getShareableMenuLink(slug, `mesa/${tableNumber}`);
}
