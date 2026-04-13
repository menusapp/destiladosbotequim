

## Plano: Corrigir Landing Page — CTAs e Fluxo de Registro Trial

### Problema atual
1. Botões dos planos (Básico, Intermediário, Avançado) dizem "Começar grátis" — errado, esses devem levar ao pagamento
2. Botões de CTA genéricos ("Começar agora") navegam para `/register` que não existe — causa erro "restaurante não encontrado"
3. A rota correta é `/registro/:planSlug` mas `trial` não está no `planDisplayMap` da página de registro

### Alterações

**1. `src/pages/LandingPage.tsx`**

- Planos (Básico, Intermediário, Avançado): mudar CTA de "Começar grátis" para "Escolher este plano" — mantém o `onClick` que abre `mpLink` do MercadoPago
- Botão do header "Começar agora" → navega para `/registro/trial`
- Botão do hero "Começar agora" → navega para `/registro/trial`  
- Botão da seção "Teste grátis" "Começar grátis agora" → navega para `/registro/trial`
- Texto abaixo dos planos "7 dias grátis" permanece

**2. `src/pages/RestaurantRegistration.tsx`**

- Adicionar `trial` ao `planDisplayMap`: `{ name: "Básico (7 dias grátis)", color: "text-green-600" }`
- Na tela de sucesso, ao invés de redirecionar para `/login`, redirecionar para `/${slug}/admin` e já salvar as credenciais no localStorage (como o StaffLogin faz) para o usuário entrar direto no painel
- Mostrar countdown "Seu período gratuito termina em 7 dias" na tela de sucesso

**3. Nenhuma outra alteração** — o backend (register-restaurant) já aceita `planSlug = "trial"` e cria subscription com `is_trial = true`.

### Impacto zero
- Fluxo de pagamento via MercadoPago dos planos pagos não muda
- Nenhum outro componente é afetado
- Backend já está preparado para trial

