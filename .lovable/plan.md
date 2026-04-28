## Objetivo

Transformar o tour atual (que termina em cada aba) em um **tour contínuo encadeado** entre todas as abas do painel, e melhorar a aparência visual do destaque (borda laranja fina ao redor do elemento referenciado).

---

## Comportamento novo do tour

1. **Sequência fixa de abas** — definida explicitamente em ordem (visão geral → pedidos → pdv → mesas-reservas → cardápio → estoque → caixa → custos → margens → relatórios → clientes → fidelidade → marketing → robo-menus → integrações → fiscal → contas → módulos → config-dados → config-totem → config-whatsapp).

2. **Início em qualquer aba** — clicar em "Tour" começa pelos passos da aba **atual**, mas continua dali em diante. Ex.: começou em "Cardápio" → ao terminar os passos de cardápio, avança automaticamente para "Estoque" e segue até a última aba.

3. **Não volta para abas anteriores** — quem começa em "Cardápio" não verá tour de "Visão Geral" / "Pedidos" / "PDV". O botão "Anterior" só volta dentro do range já percorrido (da aba inicial em diante).

4. **Botão "Próximo" em vez de "Concluir"** — só aparece "Concluir" no último passo da última aba da sequência. Em qualquer outro último-passo-de-aba, o botão é "Próximo" e ele:
   - Troca a aba ativa do painel (`setActiveSection`)
   - Aguarda o DOM da próxima aba renderizar
   - Avança para o primeiro passo dessa nova aba

5. **"Pular tour"** continua encerrando tudo imediatamente.

---

## Visual do destaque (borda laranja)

- Substituir o spotlight atual (escurecimento por box-shadow) por um **anel laranja fino ao redor do elemento alvo**:
  - Borda 2px sólida na cor `#F97316` (orange-500, alinha com identidade do app).
  - `border-radius: 8px`, `padding` interno de 6px ao redor do elemento.
  - `box-shadow: 0 0 0 4px rgba(249, 115, 22, 0.18)` para um glow suave.
  - Animação sutil de pulso (opcional, leve — 1.5s ease-in-out).
  - **Sem** escurecimento de tela (fundo continua visível e clicável fora do card), para ficar mais leve.
- Card flutuante mantém-se posicionado de forma adaptativa (já existe lógica em `computeCardPosition`), mas com leve atualização de estilo (sombra mais marcada, borda laranja de 1px no topo do card para conectar visualmente).
- Quando não há `target` (passo introdutório de aba, com `placement: "center"`), apenas o card centralizado aparece — sem anel.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/admin/tour/types.ts` | Adicionar constante `TOUR_SECTION_ORDER: TourSectionId[]` com a sequência completa de abas. |
| `src/components/admin/tour/TourContext.tsx` | Refatorar para suportar tour multi-aba: estado `startSectionId` + `currentSectionIndex` + `stepIndex`. `startTour(sectionId)` define o início e marca o índice atual. `nextStep` avança dentro da aba e, quando chega ao fim, pula para a próxima aba na ordem (chama callback de troca de aba). `prevStep` recua dentro da aba (e cruza para a aba anterior **somente se** já tiver sido visitada nesta sessão de tour). Expor função `setSectionChanger(fn)` para permitir que o `RestaurantAdmin` registre seu `setActiveSection`. |
| `src/pages/RestaurantAdmin.tsx` | No mount, registrar `setActiveSection` no contexto do tour via `useEffect`. |
| `src/components/admin/tour/TourOverlay.tsx` | Trocar spotlight por anel laranja; remover overlay escuro de fundo (manter só quando não há target, mas transparente / clique passa); ajustar lógica de "isLast" para considerar última aba da ordem (não apenas último passo da aba atual); ao trocar de aba, aguardar ~250ms antes de tentar localizar o próximo target (já há retries em 60ms/200ms — aumentar para cobrir troca de aba). |
| `src/components/admin/tour/tourSteps.ts` | Sem alteração funcional — apenas garantir que `getStepsForSection` continue retornando vazio gracioso para abas sem passos (essas abas serão **puladas** automaticamente pelo novo `nextStep`, em vez de exibir o fallback "Tour ainda não disponível"). |

---

## Detalhes técnicos

### Ordem das abas

```ts
export const TOUR_SECTION_ORDER: TourSectionId[] = [
  "visao-geral", "pedidos", "pdv", "mesas-reservas", "cardapio",
  "estoque", "caixa", "custos", "margens", "relatorios",
  "clientes", "fidelidade", "marketing", "robo-menus",
  "integracoes", "fiscal", "contas", "modulos",
  "config-dados", "config-totem", "config-whatsapp",
];
```

### Lógica do `nextStep` (resumida)

```text
if (stepIndex < steps.length - 1) → stepIndex++
else:
  procurar próxima seção na ordem (a partir da atual + 1) que tenha steps
  se encontrou:
    chamar sectionChanger(novaSecao)
    setActiveSectionId(novaSecao); setStepIndex(0)
  senão:
    endTour()  // chegou ao fim
```

Abas sem passos cadastrados são **puladas** silenciosamente.

### Lógica do `prevStep`

- Recua dentro da aba; ao chegar em `stepIndex 0`, só recua para a aba anterior **se** essa aba estiver dentro do range já percorrido nesta sessão (entre `startSectionIndex` e `currentSectionIndex - 1`). Caso contrário, fica no passo 0.

### Estilo do anel (TourOverlay)

```tsx
const ringStyle = {
  position: "fixed",
  top: rect.top - 6,
  left: rect.left - 6,
  width: rect.width + 12,
  height: rect.height + 12,
  borderRadius: 8,
  border: "2px solid #F97316",
  boxShadow: "0 0 0 4px rgba(249, 115, 22, 0.18)",
  pointerEvents: "none",
  zIndex: 9998,
  transition: "all 200ms ease-out",
  animation: "tourRingPulse 1.6s ease-in-out infinite",
};
```

Keyframe `tourRingPulse` adicionado inline via `<style>` no portal (alterando `box-shadow` spread sutilmente).

### Registro do trocador de aba

Em `RestaurantAdmin.tsx`, dentro do `TourProvider`:

```tsx
const { setSectionChanger } = useTour();
useEffect(() => {
  setSectionChanger((sectionId) => setActiveSection(sectionId));
}, [setSectionChanger]);
```

Como `RestaurantAdmin` já está envolto pelo `TourProvider`, basta um sub-componente "TourBridge" para chamar o hook (ou expor `setSectionChanger` no contexto e chamá-lo).

---

## Fora do escopo

- Não altera os textos / estrutura dos passos em `tourSteps.ts` (só o comportamento de navegação).
- Não adiciona novos `data-tour="..."` em componentes.
- Não modifica a lógica de "tour completed" no localStorage (continuará marcando a seção inicial; opcionalmente, podemos marcar todas as percorridas — pendente decisão; por padrão, marca todas).