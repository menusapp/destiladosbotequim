/**
 * Configuração do ESTABELECIMENTO ÚNICO (Destilado Botequim).
 *
 * Este sistema deixou de ser um SaaS genérico ("Menu's") e passou a ser o ERP
 * de um único estabelecimento. Ajuste aqui a identidade padrão do app.
 *
 * IMPORTANTE:
 *  - `slug` deve ser IGUAL ao slug do restaurante cadastrado no banco
 *    (tabela restaurants.slug). É por ele que a página inicial "/" resolve
 *    qual estabelecimento mostrar quando não há subdomínio. Se o cardápio
 *    inicial não carregar, é quase sempre porque este slug não bate com o
 *    do banco — corrija aqui.
 *  - A LOGO e a COR principal do cardápio vêm do banco (Configurações →
 *    dados do estabelecimento). Faça upload da logo do Destilado e defina a
 *    cor verde lá para o cardápio do cliente ficar com a identidade.
 */
export const ESTABLISHMENT = {
  /** Nome exibido nas telas de login e no título do app. */
  name: "Destilado Botequim",
  /** Slug do restaurante no banco (restaurants.slug). AJUSTE se necessário. */
  slug: "destilado-botequim",
  /** Frase curta nas telas de login (sem revelar que é um sistema genérico). */
  tagline: "Área da equipe",
} as const;
