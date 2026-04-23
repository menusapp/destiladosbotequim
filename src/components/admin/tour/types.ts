/**
 * Tipos do tour guiado do painel admin.
 *
 * Cada aba/seção tem um array de TourStep. Cada step aponta para um
 * elemento do DOM via seletor (`data-tour="..."`) e exibe um card com
 * título + descrição. Quando o elemento alvo não está no DOM (ex.: sub-aba
 * inativa), o overlay simplesmente centraliza o card e segue.
 */

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  /** Seletor CSS do elemento a destacar. Use `[data-tour="x"]`. Opcional — se omitido, exibe centralizado. */
  target?: string;
  /** Título exibido no topo do card. */
  title: string;
  /** Texto descritivo. Pode ter 1-3 frases. */
  content: string;
  /** Onde posicionar o card relativo ao target. Default: 'bottom'. */
  placement?: TourPlacement;
}

/** ID das seções do painel (mesmo `activeSection` usado no `RestaurantAdmin`). */
export type TourSectionId =
  | "visao-geral"
  | "pedidos"
  | "pdv"
  | "mesas-reservas"
  | "cardapio"
  | "estoque"
  | "caixa"
  | "custos"
  | "margens"
  | "relatorios"
  | "clientes"
  | "fidelidade"
  | "marketing"
  | "robo-menus"
  | "integracoes"
  | "fiscal"
  | "contas"
  | "modulos"
  | "config-dados"
  | "config-totem"
  | "config-whatsapp";

export type TourStepsBySection = Partial<Record<TourSectionId, TourStep[]>>;
