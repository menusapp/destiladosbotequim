/**
 * Normaliza strings para buscas tolerantes a acentos e maiúsculas.
 *
 * Remove diacríticos (acentos, til, cedilha → c) e converte para minúsculas,
 * permitindo que "agua" encontre "Água", "pao" encontre "Pão", etc.
 *
 * Use em TODAS as buscas de produtos, itens, complementos, clientes e
 * pedidos no painel administrativo e no cardápio do cliente.
 */
export function normalizeSearch(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Conveniência: testa se `haystack` contém `needle` ignorando acentos/caixa. */
export function matchesSearch(
  haystack: string | null | undefined,
  needle: string | null | undefined,
): boolean {
  const n = normalizeSearch(needle);
  if (!n) return true;
  return normalizeSearch(haystack).includes(n);
}
