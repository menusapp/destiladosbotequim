## Reformular cadastro em wizard de 4 passos

Transformar `src/pages/RestaurantRegistration.tsx` num fluxo guiado de 4 etapas, mais leve e persuasivo, sem alterar nenhuma rota, edge function, integração de pagamento ou redirecionamento existentes.

### O que muda na experiência

```text
①  Negócio   ─── ②  Localização   ─── ③  Acesso   ─── ④  Plano
nome+tipo+fone   CEP+endereço+CNPJ    nome+email+slug+senha   3 cards + criar conta
```

- Topo fixo com logo do Menu's centralizada e barra de progresso (4 círculos com nome embaixo + barra fina de 0–100%).
- Um único “card” por step ocupa a viewport (`max-w-lg mx-auto`), com título motivacional e subtítulo de valor.
- Transição suave: o step atual desliza para a esquerda e o próximo entra da direita ao avançar; inverso ao voltar (`translateX` + `opacity`, 300ms).
- Mobile-first, totalmente responsivo, sem mostrar todos os campos de uma vez.

### Step 1 — “Vamos começar!”
- **Nome do restaurante** (input grande, autoFocus).
- **Tipo de estabelecimento**: grid de cards clicáveis com ícones (Restaurante, Hamburgueria, Pizzaria, Bar, Marmitaria, Sorveteria, Cafeteria, Outro) — usando ícones de `lucide-react` já instalados (Utensils, Sandwich, Pizza, Beer, Salad, IceCream, Coffee, Store). O tipo selecionado destaca com borda/preenchimento primário e troca o ícone exibido no topo do card.
- **Telefone/WhatsApp** com máscara `(00) 00000-0000`.
- Validação para avançar: nome ≥ 2 chars, tipo selecionado, telefone ≥ 10 dígitos.

### Step 2 — “Onde você está?”
- **CEP** (8 dígitos): ao completar, faz `fetch` para `https://viacep.com.br/ws/{cep}/json/` e auto-preenche rua, bairro e cidade. Mostra spinner enquanto consulta e erro inline se CEP inválido.
- **Rua e número** (rua preenchida pelo ViaCEP; número editável manual).
- **Bairro e Cidade/UF** (preenchidos automaticamente, editáveis).
- **CNPJ** com label “Opcional — para emissão de nota fiscal”.
- Validação para avançar: CEP válido (8 dígitos) + rua + número + cidade preenchidos. CNPJ opcional.
- O endereço final é montado em `address = "{rua}, {numero} - {bairro}, {cidade}/{uf}"` para enviar à edge function (mesmo campo `address` atual).

### Step 3 — “Crie seu acesso”
- **Nome do responsável** (novo campo apenas exibido; será usado como `adminUsername` por padrão, podendo ser editado abaixo se quiser).
- **Email** com instrução: “Use o mesmo email do Mercado Pago para ativar seu plano automaticamente”.
- **Nome de usuário** (slug): live-preview `menusapp.com.br/{slug}` atualizado em tempo real, com debounce de 500ms para checar disponibilidade via `supabase.from('restaurants').select('id').eq('slug', x).maybeSingle()`. Indicador visual: spinner / check verde / “Indisponível”.
- **Senha** (PasswordInput) e **Confirmar senha** (PasswordInput).
- Validação para avançar: email válido, slug ≥ 3 chars + disponível + sem caracteres especiais (já sanitizado), senhas iguais e ≥ 6 chars.
- Internamente o wizard reutiliza o mesmo valor de senha para `password` e `adminPassword`, e o slug para `username`, mantendo a edge function recebendo todos os campos atuais sem mudanças.

### Step 4 — “Escolha seu plano”
- Três cards (Básico R$69,90 / Intermediário R$149,90 / Avançado R$249,90) lado a lado em desktop, empilhados em mobile. Avançado vem com selo “Mais escolhido” e já vem **pré-selecionado** quando vier de `/registro/avancado`, idem para os outros (`/registro/basico`, `/registro/intermediario`, `/registro/trial`). A tela permite trocar o plano mesmo se vier pré-selecionado.
- Card selecionado ganha borda primária + checkmark.
- Resumo do cadastro abaixo (card cinza claro): nome do restaurante, usuário (`menusapp.com.br/{slug}`) e plano escolhido.
- Botão principal: “Criar minha conta grátis 🚀” + linha “7 dias grátis · Sem cartão · Cancele quando quiser”.
- Botão secundário “← Voltar”.

### Validação e UX

- Erros inline por campo (texto vermelho abaixo do input) — não bloqueiam digitação, mas impedem `goNext()` se houver falha.
- `Enter` no input avança para o próximo campo / próximo step quando válido.
- A barra de progresso é clicável apenas em steps já completados (permite voltar rápido).

### Manter 100% da funcionalidade

Ao submeter o Step 4, chamar exatamente a mesma edge function `register-restaurant` com o mesmo payload de hoje:

```ts
{ name, slug, cnpj, phone, address, email, username, password,
  adminUsername, adminPassword, planSlug }
```

- `planSlug` agora vem do plano selecionado no Step 4 (sobrescreve o da URL se o usuário trocou).
- Telas de sucesso (`success`) e redirecionamento para o Mercado Pago (`redirectingToPayment`) permanecem idênticas.
- Eventos do Meta Pixel (`Lead`, `CompleteRegistration`, `InitiateCheckout`) continuam disparando nos mesmos pontos.
- Persistência em `localStorage` (restaurant_id/name/slug, staff_*) inalterada.
- Validações server-side e RLS continuam intocadas; o wizard apenas adiciona validação client-side (zod) por step.

### Detalhes técnicos

- Arquivo único: reescrevo `src/pages/RestaurantRegistration.tsx`. Nenhum outro arquivo é tocado.
- Estado: um único `form` (mantém os mesmos campos de hoje) + `step (1-4)`, `direction ('forward'|'back')`, `selectedType`, `cepLoading`, `slugChecking/slugAvailable`, `errors` (registro de erros por step).
- Animação: container com `overflow-hidden`, conteúdo do step com classe condicional `translate-x-*` e `opacity-*` baseada em `direction`, usando utilitários Tailwind + `transition-[transform,opacity] duration-300 ease-out`.
- ViaCEP: `fetch` direto, sem dependência nova; tratamento de erro com toast.
- Schema de validação por step com `zod` (já usado no projeto) — uma função `validateStep(step)` decide se pode avançar.
- Debounce do slug com um `useEffect` + `setTimeout` simples (sem nova dependência).
- Telefone e CEP recebem máscara via função utilitária local (sem libs novas).
- Acessibilidade: `aria-current="step"` no círculo ativo, `aria-invalid` em campos com erro, foco automático no primeiro campo de cada step.

### Fora de escopo (intocado)

- Edge function `register-restaurant`.
- Rotas (`/registro/:planSlug` continua igual).
- Lógica de pagamento e redirect para Mercado Pago.
- Telas de “sucesso” e “redirecionando para pagamento”.
- Qualquer outra página do app.
