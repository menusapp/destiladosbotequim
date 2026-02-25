

## Diagnostico: Iframes do Secure Fields bloqueados pelo Vaul Drawer

O problema real nao e CSS nem timing — e o **Vaul (drawer library)** interceptando todos os eventos de pointer/touch nos iframes para implementar o gesto de "arrastar para fechar".

O Vaul adiciona event listeners de `pointerdown`/`pointermove` no container do drawer. Quando o usuario tenta clicar no iframe do Secure Field, o Vaul captura o evento antes do iframe receber, tornando-os efetivamente "congelados".

---

### Correcao (2 arquivos)

**1. `src/components/menu/CheckoutDrawer.tsx` (linha 690)**

Adicionar a prop `handleOnly` no componente `<Drawer>`. Isso diz ao Vaul para so capturar gestos de drag na "handle bar" (a barrinha cinza no topo), em vez de capturar em todo o conteudo:

```tsx
<Drawer open={open} onOpenChange={onClose} handleOnly>
```

Isso libera imediatamente os eventos de pointer para todos os elementos dentro do drawer, incluindo os iframes do Mercado Pago.

**2. `src/components/menu/checkout/OnlinePaymentStep.tsx` (containers JSX, linhas 623-653)**

Adicionar `pointer-events-auto` e `z-10` nas divs dos Secure Fields como camada extra de seguranca, garantindo que nenhum ancestral CSS bloqueie interacao:

```tsx
<div
  id="mp-card-number"
  className="relative z-10 pointer-events-auto h-10 w-full min-h-[40px] rounded-md border border-input bg-background [&>iframe]:h-full [&>iframe]:w-full"
></div>
```

Aplicar o mesmo nos containers `#mp-expiration-date` e `#mp-security-code`.

---

### Por que as correcoes anteriores nao funcionaram

- **Estilo do SDK, overflow-hidden, Tailwind syntax** — Esses ajustes estavam corretos mas nao atacavam a raiz: o Vaul interceptando eventos antes do iframe.
- **Polling/timing** — Mesmo com o container existindo no DOM, o iframe montava corretamente mas os cliques eram capturados pelo Vaul.
- O campo "Nome no Cartao" funciona porque e um `<input>` nativo do React, nao um iframe — o Vaul trata inputs nativos de forma diferente.

---

### Resumo

| Arquivo | Mudanca |
|---------|---------|
| `CheckoutDrawer.tsx` | Adicionar `handleOnly` no `<Drawer>` |
| `OnlinePaymentStep.tsx` | Adicionar `pointer-events-auto z-10` nos 3 containers |

