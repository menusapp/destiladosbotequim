

## Analise Completa: Secure Fields nao clicaveis

Apos analisar o codigo do componente, o CSS global e a documentacao oficial do SDK do Mercado Pago (`mercadopago/sdk-js/docs/fields.md`), identifiquei **4 problemas** que, combinados, impedem a interacao com os iframes dos Secure Fields.

---

### Problema 1: Estilo `"::placeholder"` invalido

O objeto `style` passado ao SDK contem `"::placeholder": { color: "#999" }`, que **nao e uma propriedade aceita** pelo SDK. A documentacao oficial lista apenas `placeholderColor` como propriedade valida para cor do placeholder. Propriedades invalidas podem causar falha silenciosa no SDK ao renderizar o iframe internamente.

**Tambem**: `fontFamily: "inherit"` nao faz sentido dentro de um iframe (ele nao herda do DOM pai). Sera trocado por uma font concreta.

---

### Problema 2: `overflow-hidden` nos containers

As divs `#mp-card-number`, `#mp-expiration-date` e `#mp-security-code` possuem a classe `overflow-hidden`. Isso pode recortar a area clicavel do iframe se ele tiver qualquer posicionamento ou dimensao ligeiramente diferente do container.

---

### Problema 3: Tailwind invalido `[&>iframe]{h-full w-full}`

Na linha 624, a classe `[&>iframe]{h-full w-full}` e **sintaxe Tailwind invalida**. O correto seria `[&>iframe]:h-full [&>iframe]:w-full`. Essa classe e simplesmente ignorada pelo compilador, entao o iframe nao recebe dimensoes via Tailwind.

---

### Problema 4: Falta de `position: relative` e padding interno

O iframe precisa de um contexto de posicionamento no container pai. Sem `relative`, o iframe pode nao se alinhar corretamente. Alem disso, o padding do campo deve ser aplicado **dentro** do iframe via o objeto `style` do SDK (e nao no container), pois o input esta dentro do iframe.

---

### Correcoes no Arquivo: `src/components/menu/checkout/OnlinePaymentStep.tsx`

**1. Objeto `style` do SDK (linhas 187-194):**
- Substituir `"::placeholder": { color: "#999" }` por `placeholderColor: "#999"` (propriedade documentada)
- Trocar `fontFamily: "inherit"` por `fontFamily: "Arial, sans-serif"`
- Adicionar `padding: "8px 12px"` para espacamento interno no input do iframe

**2. Containers JSX (linhas 622-625, 642-644, 649-651):**
- Remover `overflow-hidden`
- Remover a classe invalida `[&>iframe]{h-full w-full}`
- Adicionar `relative` para contexto de posicionamento
- Manter `h-10 w-full min-h-[40px] rounded-md border border-input bg-background`

**3. CSS global (`src/index.css`, linhas existentes):**
- As regras `#mp-card-number iframe { height: 100% !important; ... }` ja existem e estao corretas. Nenhuma mudanca necessaria.

---

### Resumo de mudancas

- **1 arquivo**: `src/components/menu/checkout/OnlinePaymentStep.tsx`
  - Fix do objeto `style` do SDK (3 propriedades)
  - Fix das 3 divs container (remover overflow-hidden, fix Tailwind, adicionar relative)
- **0 arquivos CSS**: `index.css` ja esta correto

