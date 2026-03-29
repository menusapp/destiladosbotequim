

# Fix: Campos Misto não visíveis no PDV

## Diagnóstico Real

O código JSX está correto — a seção `{paymentMethod === "mixed" && (...)}` (linhas 502-574) está dentro do container scrollável. A lógica de estado também funciona. O problema é de **visibilidade/scroll**: quando o usuário seleciona "Misto", os campos são renderizados abaixo da área visível do painel esquerdo (que tem `max-h-[calc(100vh-180px)]` e `overflow-y-auto`), mas o scroll não acontece automaticamente, então o usuário não vê os campos.

## Correção

### Arquivo: `src/components/admin/CreateOrderDrawer.tsx`

1. **Adicionar `useRef` + `useEffect` para auto-scroll**: Quando `paymentMethod` muda para `"mixed"`, fazer scroll automático até a seção de pagamento misto usando `scrollIntoView()`.

2. **Adicionar ref no container do mixed payment**: Colocar um `ref` no `<div>` da seção misto (linha 503) para servir de alvo do scroll.

3. **Implementação**:
   - Criar `const mixedSectionRef = useRef<HTMLDivElement>(null)` 
   - Adicionar `useEffect` que observa `paymentMethod` — quando for `"mixed"`, chamar `mixedSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })`
   - Adicionar `ref={mixedSectionRef}` no div da linha 503

Isso garante que ao selecionar "Misto", a tela rola automaticamente para mostrar os campos de divisão de pagamento.

