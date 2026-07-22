# 🔐 Runbook de Correção de Segurança — Destilado Botequim

Este documento explica **o que foi feito**, **por que**, e **como aplicar com segurança**
(passo a passo, com testes e rollback). Ele fecha os achados de segurança do Lovable
(RLS aberto, funções `SECURITY DEFINER` públicas, escrita anônima em storage, PII/financeiro
legível por qualquer um com a chave pública) **sem quebrar o funcionamento**.

> ⚠️ **Nada aqui é aplicado automaticamente.** As mudanças estão na branch
> `claude/destilados-botequim-access-y38q3n`. Você revisa, aplica as migrations no
> **seu** Supabase e testa, seguindo a ordem abaixo.

---

## 1. Entenda o problema (resumo de 1 minuto)

- O app inteiro (painel, PDV, staff **e** clientes do cardápio) falava com o banco usando a
  chave **pública `anon`**. O login de restaurante/staff era só uma RPC + `localStorage`,
  **sem sessão autenticada de verdade**.
- Como a chave `anon` é **pública por design** (o Vite a embute no site — ela **sempre**
  aparece no DevTools e isso é normal), e não havia um "crachá" provando quem era o
  funcionário, o banco **não conseguia diferenciar** um funcionário legítimo de um atacante
  com a chave pública. Por isso tudo estava com `USING(true)`.
- **A chave pública no `.env` NÃO é o vazamento.** Quem protege os dados é o **RLS**.
  (O único segredo que vazava de verdade no frontend era o `CEO/CEO123` hardcoded, já removido.)

### A solução (o que foi construído)
1. **Identidade autenticada por token JWT.** No login, uma edge function (`issue-session-token`)
   valida as credenciais e devolve um **JWT assinado** com `restaurant_id`/`staff_id`/`role`.
   O app anexa esse token em todas as requisições → passa a operar como `authenticated`.
   **Todas as ~200 queries existentes continuam funcionando** — agora com identidade.
2. **RLS reescrito** para escopar tudo por restaurante/autenticação, mantendo o mínimo
   necessário de acesso anônimo para o cardápio público funcionar (ver pedido, fazer pedido).
3. **Storage, funções e credenciais** protegidos.

---

## 2. O que mudou nos arquivos

**Frontend**
- `src/pages/RestaurantLogin.tsx` — removido o vazamento `CEO/CEO123`.
- `supabase/functions/issue-session-token/index.ts` — **NOVA** edge function que emite o token.
- `src/lib/authSession.ts` — **NOVO**, guarda/limpa o token de sessão.
- `src/integrations/supabase/client.ts` — anexa o token como `Authorization: Bearer` e
  sincroniza o Realtime (`applyRealtimeAuth`).
- `src/pages/StaffLogin.tsx`, `src/pages/CEOLogin.tsx` — passam a obter o token no login.
- `src/lib/sessionExpiry.ts` — limpa o token no logout/expiração.
- `src/pages/Reservations.tsx`, `src/components/menu/ReservationsView.tsx` — leem a config
  pública do WhatsApp via RPC (sem expor o `api_token`).

**Banco (migrations, em ordem)**
- `..._security_1_helpers_and_schema.sql` — helpers de identidade + cria `customer_cards` +
  adiciona `customer_addresses.restaurant_id` + índices.
- `..._security_2_rls_policies.sql` — políticas RLS (Estágio A).
- `..._security_3_storage_and_grants.sql` — storage + revogação de EXECUTE de funções.
- `..._security_4_customer_rpcs.sql` — RPCs seguras do fluxo do cliente (Estágio B).
- `..._security_5_close_anon_reads.sql` — fecha a leitura anônima de PII (**Estágio B, aplicar por último**).

---

## 3. Pré-requisito CRÍTICO: o segredo de assinatura do token

A edge function assina o JWT com **HS256** usando o **JWT Secret do projeto**. Sem configurá-lo,
ninguém consegue logar no painel.

1. No Supabase: **Project Settings → API → JWT Keys** (ou "JWT Settings") → copie o **JWT Secret**
   (o segredo HS256 "legacy"; a maioria dos projetos ainda o tem ativo).
2. Configure-o como secret da function:
   ```bash
   supabase secrets set JWT_SECRET="<cole_o_jwt_secret_aqui>"
   ```
   (Ou pelo Dashboard → Edge Functions → Secrets.)

> **Verificação nº 1 (a mais importante):** projetos com chaves novas (`sb_publishable_...`)
> podem ter migrado para chaves **assimétricas** e desativado o segredo HS256. Se o login
> falhar com "invalid JWT/signature" após tudo configurado, **reative o legacy JWT secret**
> no dashboard (ou me avise para assinar com a chave nova). O teste está no passo 5.

---

## 4. Itens do banco AO VIVO para conferir antes (2 minutos)

As migrations foram escritas de forma defensiva (revogações por nome de função existente,
`IF EXISTS` etc.), mas confirme:

1. **Bucket `fiscal-certificates`** (guarda chaves A1 — prioridade máxima). Rode:
   ```sql
   SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects';
   ```
   A Parte 3 já dropa políticas que referenciem esse bucket. Confirme que, ao final,
   `fiscal-certificates` **não tem** política de cliente (só service_role/edge function).
2. **Quantos restaurantes existem?** Como agora é 1 estabelecimento, o RLS usa
   `default_restaurant_id()` = o restaurante mais antigo. Se houver mais de um na cópia:
   ```sql
   SELECT id, name, created_at FROM restaurants ORDER BY created_at;
   ```
   Se o "Destilado Botequim" **não** for o mais antigo, me avise (ajusto o helper para fixar o id certo).
3. **`customer_cards`** já existe? A Parte 1 usa `CREATE TABLE IF NOT EXISTS` — se já existir
   com colunas diferentes, confira que bate com `src/integrations/supabase/types.ts`.

---

## 5. Deploy do ESTÁGIO A (o grande ganho — seguro)

Fecha a maioria dos "Critical" (todas as tabelas só-de-staff: caixa, fornecedores, estoque,
custos, fiscal, créditos de funcionário, notas, whatsapp interno, marketing interno,
assinaturas...), a adulteração de preços/config, o storage e as funções. **Não fecha ainda**
a leitura de PII do cliente (isso é o Estágio B).

**Ordem (importante):**

1. **Configure `JWT_SECRET`** (passo 3).
2. **Deploy da edge function:**
   ```bash
   supabase functions deploy issue-session-token
   ```
   Ela precisa ser **pública** (é um endpoint de login, chamado antes de existir sessão).
   Isso já está configurado em `supabase/config.toml` (`verify_jwt = false`). Se você faz
   deploy pelo Dashboard, confirme que "Verify JWT" está **desligado** para esta function.
3. **Deploy do frontend** (a branch inteira).
4. **Aplique as migrations 1 a 4** (nessa ordem). A Parte 4 (RPCs) é inerte até o frontend
   chamá-la — pode aplicar já. **NÃO aplique a Parte 5 ainda.**

**Testes do Estágio A:**
- [ ] **Verificação nº 1 (token aceito):** faça login de staff. Depois, no painel, abra qualquer
      tela que leia dados (ex.: Pedidos, Caixa). Se aparecem dados → o JWT foi aceito ✅.
      Se der erro de permissão/JWT → veja o aviso do passo 3.
- [ ] Login de restaurante → staff → painel abre normalmente.
- [ ] PDV: abrir/fechar caixa, criar pedido, imprimir.
- [ ] Relatórios, estoque, fiscal, marketing carregam.
- [ ] Realtime do painel (pedidos/mesas atualizando ao vivo).
- [ ] **Cliente (anônimo):** abrir o cardápio, montar carrinho, aplicar cupom, **fazer um pedido**,
      ver a confirmação e o status, histórico de pedidos, reserva de mesa.
- [ ] Login de CEO (em `/login/ceo`) funciona.

> Se algo no **painel** da "permissão negada", quase sempre é o token não estar sendo aceito
> (passo 3) ou a tela ter subscrito Realtime antes do login — recarregue a página logado.

**Rollback do Estágio A:** as migrations recriam políticas; para reverter, reaplique as políticas
antigas (ou restaure um backup do schema). No frontend, basta reverter o commit. Como o token
apenas *adiciona* identidade, reverter o frontend volta o app ao comportamento anônimo anterior.

---

## 6. Deploy do ESTÁGIO B (fecha a leitura de PII do cliente)

Aqui fechamos a leitura anônima das tabelas que o cliente toca (`customers`, `orders`, `loyalty*`,
`coupons`, `comandas`, `bills`, `customer_addresses`, `customer_cards`, `online_payments`,
`reservations`, `marketing_scheduled_messages`). As RPCs seguras (Parte 4) já estão prontas;
falta **trocar as leituras diretas do frontend por essas RPCs** e então aplicar a **Parte 5**.

> **Por que faseado:** essas trocas mexem no fluxo de checkout/histórico do cliente. Fiz o Estágio A
> de forma que ele **não depende** dessas trocas (mantive um SELECT anônimo temporário —
> políticas `zz_temp_anon_read*`). Assim você valida o Estágio A com calma antes de mexer aqui.

### Mapa das trocas de frontend (leitura → RPC)

| Arquivo | Hoje (leitura direta) | Trocar por (RPC já criada) |
|---|---|---|
| `OrderConfirmation.tsx` | `.from("orders").eq("id")` + Realtime | `get_order_details(id)` + polling `get_order_status(id)` |
| `menu/PedidosHistory.tsx` | `.from("orders").eq("customer_cpf")` + Realtime | `get_customer_orders(cpf, phone)` (polling) |
| `menu/ProfileView.tsx` | `.from("customers"/"orders"/"customer_addresses"/"coupons"/"marketing_scheduled_messages")` | `get_customer_by_cpf`, `get_customer_orders`, `list_customer_addresses`, `get_customer_coupons` |
| `menu/CustomerInfoDialog.tsx`, `kiosk/KioskPhoneCollection.tsx`, `kiosk/KioskIdentification.tsx` | `.from("customers").eq("cpf")` | `get_customer_by_cpf(cpf)` |
| `checkout/AddressStep.tsx`, `kiosk/KioskDeliveryAddress.tsx` | `.from("customer_addresses").eq("customer_cpf")` | `list_customer_addresses(cpf, phone)` |
| `checkout/PaymentStep.tsx` | `.from("customers").eq("cpf")` | `get_customer_by_cpf(cpf)` |
| `checkout/CouponInput.tsx`, `kiosk/KioskCart.tsx` | `.from("coupons").eq("code")` | `validate_coupon(code)` |
| `checkout/OnlinePaymentStep.tsx` | `.from("online_payments").select("status")` e `.from("customer_cards")` | `get_payment_status(id)`, `get_saved_cards(cpf, phone)`, `delete_saved_card(id, cpf)` |
| `checkout/LoyaltyPointsDisplay.tsx`, `CheckoutDrawer.tsx` (leitura de saldo) | `.from("loyalty_points").select` | `get_loyalty_balance(cpf)` |
| `checkout/LoyaltyRewardNotification.tsx` | `.from("marketing_scheduled_messages")`, `.from("coupons")` | `get_customer_coupons(cpf)`, `validate_coupon(code)` |
| `Menu.tsx`, `Comanda.tsx` (leitura/realtime de comanda) | `.from("comandas"/"bills")` + Realtime | polling `get_comanda_status(table_id, cpf)` |
| `DeliveryMenu.tsx`, `Kiosk.tsx`, `KioskConfirmation.tsx` | `.from("customers")` / `.from("orders")` (leitura) | `get_customer_by_cpf`, `get_order_details` |
| `Reservations.tsx`, `menu/ReservationsView.tsx` (leitura) | `.from("reservations")` + Realtime | `get_reservation_availability(date)`, `get_my_reservations(cpf, phone)` (polling) |

> Notas: (a) todas as RPCs novas devem ser chamadas com `(supabase as any).rpc(...)` até
> regenerar os tipos; (b) onde havia **Realtime** em tabela de cliente, troque por **polling**
> da RPC (ex.: a cada 15s), pois o Realtime depende de SELECT anônimo que será removido;
> (c) as **escritas** do checkout (inserir pedido, ocupar mesa, abrir comanda, usar cupom,
> criar/atualizar cliente/endereço) **continuam funcionando** — não precisam ser trocadas
> no Estágio B (as políticas de escrita escopadas foram mantidas).

### Aplicar
1. Faça as trocas de leitura acima e faça deploy do frontend.
2. Teste todo o fluxo do cliente (pedido, confirmação/status, histórico, endereços, cupom,
   fidelidade, reserva, comanda de mesa).
3. **Só então** aplique a **Parte 5** (`..._security_5_close_anon_reads.sql`).
4. Reteste o fluxo do cliente. Confirme (com a chave `anon` "pura") que
   `select * from customers` / `orders` **não** retorna linhas.

---

## 7. Riscos residuais / recomendações

- **Escrita anônima escopada permanece** (inserir pedido, ocupação de mesa, comanda, upsert de
  cliente, uso de cupom). Não é `USING(true)` (é escopada ao estabelecimento) e é o mínimo para
  o checkout público. Um "Estágio C" futuro pode movê-las para RPCs `place_order`/`open_comanda`.
- **Rotacione a chave publishable** depois de tudo estável — ela funcionou como "god mode" por
  muito tempo e pode ter vazado. (Isso invalida a chave antiga em qualquer lugar onde ela esteja.)
- **Segredos fiscais** (`fiscal_configs.certificate_password`, `csc_*`): agora só staff lê a tabela.
  Idealmente, mova esses campos para o Vault/tabela service_role e leia via edge function.
- **CEO** (`CEO/CEO123`) foi removido do frontend; o acesso continua em `/login/ceo` com
  credenciais reais (`ceo_users`). Para 1 estabelecimento, o painel CEO é opcional.
- Rode `bun run build` e `bun run lint` no ambiente da Lovable (o registry privado é acessível lá)
  para confirmar o type-check — aqui no sandbox o registry estava bloqueado.

---

## 8. Checklist rápido

- [ ] `JWT_SECRET` configurado na function `issue-session-token`.
- [ ] `issue-session-token` deployada e pública.
- [ ] Frontend deployado.
- [ ] Migrations 1–4 aplicadas.
- [ ] Estágio A testado (painel + cliente + CEO). **Token aceito confirmado.**
- [ ] (Depois) Trocas de leitura do Estágio B feitas e testadas.
- [ ] Parte 5 aplicada e fluxo do cliente revalidado.
- [ ] Chave publishable rotacionada.
- [ ] Re-scan do Lovable: 0028/0029 e RLS aberto zerados.
