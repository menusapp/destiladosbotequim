/**
 * Passos do tour guiado por seção do painel admin.
 *
 * Cada entrada corresponde a uma aba (mesmo ID usado em `activeSection` no
 * `RestaurantAdmin`). Os targets devem existir como `data-tour="..."` em
 * algum elemento da aba — quando não existem, o passo aparece centralizado.
 *
 * Diretrizes de estilo:
 *  - Título curto (até ~30 caracteres).
 *  - Descrição direta, em PT-BR, focada em "o que esse elemento faz" e
 *    "quando o operador deve usá-lo".
 *  - Não descrever lógica de negócio — apenas a UI.
 */

import type { TourStep, TourStepsBySection } from "./types";

export const tourSteps: TourStepsBySection = {
  "visao-geral": [
    {
      title: "Visão Geral",
      content:
        "Aqui você acompanha o desempenho do restaurante: vendas totais, ticket médio, pedidos do dia e quebras por método de pagamento.",
      placement: "center",
    },
    {
      target: '[data-tour="overview-period"]',
      title: "Período",
      content: "Escolha o intervalo dos dados: hoje, 7 dias, mês atual ou anual. Todos os cards e gráficos abaixo se atualizam.",
      placement: "bottom",
    },
    {
      target: '[data-tour="overview-cards"]',
      title: "Indicadores principais",
      content: "Vendas totais, número de pedidos, ticket médio e divisão entre balcão/PDV e delivery — uma leitura rápida da operação.",
      placement: "bottom",
    },
    {
      target: '[data-tour="overview-chart"]',
      title: "Vendas por hora ou por dia",
      content: "O gráfico mostra a distribuição do faturamento ao longo do período. Use para identificar picos e horários ociosos.",
      placement: "top",
    },
    {
      target: '[data-tour="overview-by-method"]',
      title: "Receita por método",
      content: "Quanto foi recebido em cada forma de pagamento — ajuda a conferir o caixa e detectar inconsistências.",
      placement: "left",
    },
  ],

  pdv: [
    {
      title: "PDV",
      content: "Aqui você cria pedidos manualmente (mesa, balcão ou delivery), controla as mesas ocupadas e busca pedidos rapidamente.",
      placement: "center",
    },
    {
      target: '[data-tour="pdv-search"]',
      title: "Buscar pedido",
      content: "Encontre rapidamente um pedido pelo nome do cliente, CPF ou item. Útil quando o cliente liga para perguntar do pedido.",
      placement: "bottom",
    },
    {
      target: '[data-tour="pdv-tables-grid"]',
      title: "Mesas",
      content: "Mesas livres aparecem em branco; ocupadas em laranja. Clique em uma mesa para ver a comanda, adicionar itens ou liberar.",
      placement: "right",
    },
    {
      target: '[data-tour="pdv-order-type"]',
      title: "Tipo do pedido",
      content: "Escolha entre Mesa, Delivery ou Retirada. Para delivery, o sistema pede o endereço e calcula a taxa pela zona.",
      placement: "left",
    },
    {
      target: '[data-tour="pdv-customer"]',
      title: "Cliente",
      content: "Busque um cliente existente pelo CPF/telefone ou preencha os campos para criar um novo. Endereço salvo é reutilizado.",
      placement: "left",
    },
    {
      target: '[data-tour="pdv-products"]',
      title: "Produtos",
      content: "Selecione os produtos por categoria. Clique para abrir as opções (complementos e adicionais) antes de adicionar.",
      placement: "left",
    },
    {
      target: '[data-tour="pdv-confirm"]',
      title: "Criar Pedido",
      content: "Quando estiver tudo certo, clique aqui. O pedido entra no sistema já como aceito e pode ser impresso automaticamente.",
      placement: "top",
    },
    {
      target: '[data-tour="pdv-auto-print"]',
      title: "Impressão automática",
      content: "Quando ligado, todo pedido criado pelo PDV é enviado direto para a impressora configurada — sem precisar clicar em imprimir.",
      placement: "bottom",
    },
  ],

  pedidos: [
    {
      title: "Pedidos",
      content: "Painel central de pedidos do delivery, balcão e integrações (iFood, Delivery Direto). Acompanhe e avance o status em tempo real.",
      placement: "center",
    },
    {
      target: '[data-tour="pedidos-auto-accept"]',
      title: "Aceitar automaticamente",
      content: "Liga/desliga o aceite automático de novos pedidos. Quando ligado, pedidos novos já entram aceitos sem precisar clicar.",
      placement: "bottom",
    },
    {
      target: '[data-tour="pedidos-auto-print"]',
      title: "Impressão automática",
      content: "Quando ligado, cada pedido aceito é enviado para a impressora configurada (PDF ou QZ Tray, conforme suas Configurações).",
      placement: "bottom",
    },
    {
      target: '[data-tour="pedidos-date"]',
      title: "Período",
      content: "Filtre os pedidos por intervalo de datas. Útil para conferir o histórico do dia ou de uma semana específica.",
      placement: "bottom",
    },
    {
      target: '[data-tour="pedidos-search"]',
      title: "Buscar",
      content: "Encontre um pedido pelo nome do cliente, telefone, CPF ou código curto.",
      placement: "bottom",
    },
    {
      target: '[data-tour="pedidos-tabs"]',
      title: "Filtros rápidos",
      content: "Alterne entre todos os pedidos, somente delivery ou somente retirada/balcão.",
      placement: "bottom",
    },
  ],

  "mesas-reservas": [
    {
      title: "Reservas",
      content: "Gerencie as reservas de mesa do seu restaurante. Aceite, confirme, cancele e veja o histórico.",
      placement: "center",
    },
    {
      target: '[data-tour="reservas-link"]',
      title: "Link de reservas",
      content: "Copie e compartilhe esse link com seus clientes. Eles fazem a reserva direto pelo cardápio digital.",
      placement: "bottom",
    },
    {
      target: '[data-tour="reservas-tabs"]',
      title: "Filtros",
      content: "Hoje, aguardando confirmação ou histórico completo. Reservas pendentes geram notificação no painel.",
      placement: "bottom",
    },
  ],

  cardapio: [
    {
      title: "Cardápio",
      content: "Gerencie produtos, categorias, complementos e destaques. Mudanças são propagadas em tempo real para Delivery, Mesa e Totem.",
      placement: "center",
    },
    {
      target: '[data-tour="cardapio-tabs"]',
      title: "Sub-abas",
      content: "Produtos é a lista principal. Categorias organiza o menu. Complementos cuida dos adicionais. Destaques aparece no topo do cardápio.",
      placement: "bottom",
    },
    {
      target: '[data-tour="cardapio-new-product"]',
      title: "Novo Produto",
      content: "Cadastre um produto novo. Você pode definir foto, preço, complementos, em quais canais (Delivery/Mesa/Totem) ele aparece e dados fiscais.",
      placement: "left",
    },
  ],

  estoque: [
    {
      title: "Estoque",
      content: "Cadastre insumos, controle quantidades, registre movimentações e cadastre fornecedores. Vinculado ao cardápio para baixar estoque em vendas.",
      placement: "center",
    },
    {
      target: '[data-tour="estoque-import-nfe"]',
      title: "Importar Nota Fiscal",
      content: "Importe um XML de NF-e para entrar com os insumos automaticamente — categorias, quantidades e custos já preenchidos.",
      placement: "left",
    },
    {
      target: '[data-tour="estoque-tabs"]',
      title: "Sub-abas",
      content: "Insumos lista os produtos do estoque. Categorias organiza. Movimentações mostra entradas/saídas. Fornecedores cadastra parceiros.",
      placement: "bottom",
    },
  ],

  caixa: [
    {
      title: "Caixa",
      content: "Abra e feche o caixa, registre suprimentos/sangrias e veja o histórico de fechamentos com diferenças apuradas.",
      placement: "center",
    },
    {
      target: '[data-tour="caixa-tabs"]',
      title: "Fluxo x Histórico",
      content: "Fluxo de Caixa mostra o caixa aberto com movimentações em tempo real. Histórico exibe fechamentos anteriores.",
      placement: "bottom",
    },
    {
      target: '[data-tour="caixa-open"]',
      title: "Abrir / Fechar",
      content: "Use o botão para abrir o caixa informando o saldo inicial. No fim do expediente, feche e o sistema calcula a diferença esperada.",
      placement: "left",
    },
  ],

  custos: [
    {
      title: "Custos",
      content: "Cadastre os custos do restaurante: fixos (aluguel, internet), variáveis (taxas, embalagens) e folha (funcionários).",
      placement: "center",
    },
  ],

  margens: [
    {
      title: "Margens",
      content: "Veja a margem de cada produto: preço de venda, custo, ficha técnica e CMV. Use para identificar produtos que precisam de reajuste.",
      placement: "center",
    },
    {
      target: '[data-tour="margens-target-cmv"]',
      title: "Meta de CMV",
      content: "Defina o CMV ideal do seu restaurante (ex: 30%). Produtos acima da meta ficam destacados.",
      placement: "bottom",
    },
  ],

  relatorios: [
    {
      title: "Relatório DRE",
      content: "Demonstrativo de Resultados: receitas, custos, despesas e lucro. Filtre por período e exporte em PDF.",
      placement: "center",
    },
    {
      target: '[data-tour="relatorios-period"]',
      title: "Período",
      content: "Escolha o intervalo do relatório: hoje, semana, mês, ou personalizado.",
      placement: "bottom",
    },
    {
      target: '[data-tour="relatorios-export"]',
      title: "Exportar PDF",
      content: "Gera o DRE em PDF para enviar ao contador ou imprimir.",
      placement: "left",
    },
  ],

  clientes: [
    {
      title: "Clientes",
      content: "Base completa de clientes que já compraram. Veja histórico de pedidos, dados de contato e endereços salvos.",
      placement: "center",
    },
    {
      target: '[data-tour="clientes-new"]',
      title: "Novo Cliente",
      content: "Cadastre um cliente manualmente — útil para clientes recorrentes que vêm pelo balcão.",
      placement: "left",
    },
  ],

  fidelidade: [
    {
      title: "Fidelidade & Cupons",
      content: "Crie programas de fidelidade (a cada X compras ganha Y) e cupons de desconto para distribuir aos clientes.",
      placement: "center",
    },
    {
      target: '[data-tour="fidelidade-tabs"]',
      title: "Sub-abas",
      content: "Programas configura recompensas. Clientes mostra o progresso de cada um. Cupons gera códigos promocionais.",
      placement: "bottom",
    },
  ],

  marketing: [
    {
      title: "Marketing",
      content: "Crie campanhas automáticas pelo WhatsApp: aniversariantes, carrinho abandonado, cliente que sumiu, novo cardápio.",
      placement: "center",
    },
    {
      target: '[data-tour="marketing-tabs"]',
      title: "Sub-abas",
      content: "Campanhas define as regras. Agendados mostra o que está prestes a sair. Histórico exibe enviados. Rastreamento mede o ROI.",
      placement: "bottom",
    },
  ],

  "robo-menus": [
    {
      title: "Robô Menu's",
      content: "Robô de WhatsApp que responde automaticamente seus clientes 24h. Envia o cardápio, tira dúvidas e aciona um atendente quando preciso.",
      placement: "center",
    },
    {
      target: '[data-tour="robo-simulator"]',
      title: "Simulador",
      content: "Teste o robô antes de ativar. Digite uma mensagem como se fosse o cliente e veja a resposta.",
      placement: "left",
    },
  ],

  integracoes: [
    {
      title: "Integrações",
      content: "Conecte iFood, Delivery Direto, Mercado Pago e Meta Pixel. Pedidos das integrações entram direto no painel de Pedidos.",
      placement: "center",
    },
  ],

  fiscal: [
    {
      title: "Fiscal",
      content: "Configure dados fiscais (CNPJ, certificado, CSC) e emita NFC-e para os pedidos. Integrado com Nuvem Fiscal.",
      placement: "center",
    },
    {
      target: '[data-tour="fiscal-tabs"]',
      title: "Sub-abas",
      content: "Configurações guarda os dados da empresa e certificado. Notas Fiscais lista as NFC-e emitidas, com download de PDF e XML.",
      placement: "bottom",
    },
  ],

  contas: [
    {
      title: "Contas",
      content: "Gerencie funcionários: crie logins, defina permissões (quais abas acessam) e bloqueie acesso quando necessário.",
      placement: "center",
    },
    {
      target: '[data-tour="contas-new"]',
      title: "Novo Funcionário",
      content: "Cadastre um funcionário com login, senha e cargo. Defina exatamente quais áreas do painel ele pode acessar.",
      placement: "left",
    },
  ],

  modulos: [
    {
      title: "Planos",
      content: "Escolha ou troque o plano do seu restaurante. Cada plano libera módulos diferentes (Totem, Mesas, Marketing, etc.).",
      placement: "center",
    },
  ],

  "config-dados": [
    {
      title: "Configurações Gerais",
      content: "Dados da empresa, horários de funcionamento, zonas de delivery, métodos de pagamento, impressoras e backup.",
      placement: "center",
    },
  ],

  "config-totem": [
    {
      title: "Totem",
      content: "Configure o Totem de autoatendimento: tipos de consumo aceitos, métodos de pagamento, tempo de inatividade e exigência de CPF.",
      placement: "center",
    },
  ],

  "config-whatsapp": [
    {
      title: "Notificações WhatsApp",
      content: "Conecte uma instância de WhatsApp para enviar atualizações de pedido aos clientes (aceito, em produção, saiu para entrega).",
      placement: "center",
    },
  ],
};

/** Retorna os passos da seção, ou um passo de fallback genérico. */
export function getStepsForSection(section: string): TourStep[] {
  const steps = tourSteps[section as keyof typeof tourSteps];
  if (steps && steps.length > 0) return steps;
  return [
    {
      title: "Tour ainda não disponível",
      content: "O tour guiado desta seção ainda não foi configurado. Use o menu lateral para navegar e explorar — todas as ações têm tooltips explicativos.",
      placement: "center",
    },
  ];
}
