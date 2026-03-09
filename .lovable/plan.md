

## Alterar background da seção Social Proof

Mudança simples na linha 356 de `src/pages/LandingPage.tsx`:

**De:**
```tsx
<section className="py-16 sm:py-20 bg-foreground text-primary-foreground">
```

**Para:**
```tsx
<section className="py-16 sm:py-20 text-foreground" style={{ backgroundColor: '#fff0e5' }}>
```

Troca o fundo escuro (`bg-foreground`) pelo `#fff0e5` (laranja bem claro) e ajusta a cor do texto para `text-foreground` (escuro) para manter a legibilidade.

