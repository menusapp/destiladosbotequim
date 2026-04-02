/**
 * Slug Resolver - Detects restaurant slug from subdomain or URL path.
 * 
 * On VPS with wildcard subdomains (e.g., rods.menusapp.com.br):
 *   → returns "rods" from hostname
 * 
 * On Lovable or path-based routing (e.g., menusapp.com.br/rods):
 *   → returns null (slug comes from useParams)
 */

const MAIN_DOMAINS = [
  'menusapp.com.br',
  'lovable.app',
  'localhost',
];

export function getSlugFromSubdomain(): string | null {
  const hostname = window.location.hostname;
  
  // Check if we're on a subdomain of a known main domain
  for (const domain of MAIN_DOMAINS) {
    if (hostname.endsWith(`.${domain}`)) {
      const subdomain = hostname.replace(`.${domain}`, '');
      // Ignore www, system subdomains, and Lovable preview subdomains
      if (
        subdomain &&
        subdomain !== 'www' &&
        !subdomain.includes('.') &&
        !subdomain.startsWith('id-preview--')
      ) {
        return subdomain;
      }
    }
  }
  
  return null;
}

/**
 * Hook helper: returns the slug from subdomain if available,
 * otherwise falls back to the provided path param.
 */
export function resolveSlug(pathSlug?: string): string | undefined {
  return getSlugFromSubdomain() || pathSlug || undefined;
}
