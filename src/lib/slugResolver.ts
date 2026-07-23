import { ESTABLISHMENT } from "@/config/establishment";
/**
 * Slug Resolver — Detecta o slug do restaurante a partir do subdomínio ou da URL.
 *
 * Suporta dois formatos:
 *   1. Subdomínio (preferido): `rods.menusapp.com.br` → "rods"
 *   2. Path (fallback antigo): `menusapp.com.br/rods` → vem de useParams
 *
 * Ignora subdomínios reservados (www, app, admin, etc.) e ambientes de preview.
 */

const MAIN_DOMAINS = [
  "menusapp.com.br",
  "lovable.app",
  "lovableproject.com",
  "localhost",
];

/** Subdomínios que NÃO devem ser tratados como slug de restaurante. */
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "app",
  "admin",
  "api",
  "cdn",
  "static",
  "assets",
  "mail",
  "email",
  "ftp",
  "blog",
  "docs",
  "help",
  "support",
  "status",
  "dev",
  "staging",
  "preview",
  "test",
]);

export function getSlugFromSubdomain(): string | null {
  if (typeof window === "undefined") return null;

  const hostname = window.location.hostname;

  // Ignora endereços IP (ex.: 192.168.x.x, 127.0.0.1)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return null;

  for (const domain of MAIN_DOMAINS) {
    // Match exato do domínio raiz → não é subdomínio
    if (hostname === domain) return null;

    if (hostname.endsWith(`.${domain}`)) {
      const subdomain = hostname.slice(0, -1 * (`.${domain}`.length));

      if (!subdomain) return null;
      // Subdomínios compostos (ex.: id-preview--xxxx.lovable.app) → ignorar
      if (subdomain.includes(".")) return null;
      if (subdomain.startsWith("id-preview--")) return null;
      if (RESERVED_SUBDOMAINS.has(subdomain.toLowerCase())) return null;

      return subdomain.toLowerCase();
    }
  }

  return null;
}

/**
 * Helper para hooks/páginas: resolve o slug do restaurante.
 *
 * IMPORTANTE (estabelecimento único): NÃO usamos mais o subdomínio como slug.
 * No modo SaaS antigo, cada restaurante tinha um subdomínio; agora há um só
 * estabelecimento, e o host do Lovable (ex.: `destiladobotequim.lovable.app`)
 * era interpretado erradamente como slug (`destiladobotequim`), sem bater com
 * o slug real (`destilado-botequim`) — causando "Restaurante não encontrado".
 * Por isso resolvemos apenas pelo path (`/:slug/...`) ou, na falta dele, pelo
 * slug configurado em ESTABLISHMENT.slug.
 */
export function resolveSlug(pathSlug?: string): string | undefined {
  return pathSlug || ESTABLISHMENT.slug || undefined;
}

/**
 * Indica se o app está sendo acessado via subdomínio de restaurante.
 * Útil para decidir se a rota "/" deve renderizar o cardápio em vez da landing.
 */
export function isOnRestaurantSubdomain(): boolean {
  return getSlugFromSubdomain() !== null;
}
