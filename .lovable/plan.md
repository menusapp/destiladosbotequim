Diagnóstico

A causa mais provável não é cookie em si. O painel usa uma sessão customizada salva no `localStorage` por 7 dias (`restaurant_id`, `staff_id`, `restaurant_slug`, etc.). Quem já tinha esses dados salvos consegue entrar direto. Quem nunca logou precisa passar pelo fluxo completo, e esse fluxo tem alguns pontos frágeis que podem deixar a tela presa em carregamento ou em branco.

Pontos encontrados:

1. `ProtectedRoute` espera `supabase.auth.getSession()` antes de liberar/redirectar, mas o painel admin não usa essa autenticação nativa; ele usa `localStorage` + RPCs customizadas. Se essa inicialização demorar/travar em algum navegador, o admin fica no spinner infinito.

2. `RestaurantLogin` salva `restaurant_id` e `restaurant_name`, mas busca o `restaurant_slug` em paralelo sem esperar (`void cacheRestaurantSlug(...)`) e navega imediatamente para `/login/staff`. Em conexão lenta/dispositivo novo, o staff login pode prosseguir antes do slug estar salvo.

3. `StaffLogin` fica em `checkingStaff` enquanto faz duas consultas em paralelo. Se alguma consulta ficar pendente ou falhar de forma não tratada no carregamento inicial, ele pode nunca sair do loader.

4. `StaffLogin` redireciona usando `navigate()` durante o render quando não há restaurante salvo. Isso pode causar comportamento instável/tela branca em rotas como `/login/staff` acessadas diretamente por navegador novo.

O que vamos fazer sem quebrar o sistema

1. Ajustar `ProtectedRoute` para o admin customizado
   - Remover a dependência de `supabase.auth.getSession()` para liberar a rota admin.
   - Validar somente a sessão customizada existente: `restaurant_id`, `staff_id` e expiração de 7 dias.
   - Manter o comportamento atual: sem restaurante vai para `/login`; sem funcionário vai para `/login/staff`; sessão vencida limpa dados e volta para `/login`.

2. Corrigir a corrida do slug no login do restaurante
   - No login do restaurante, buscar e salvar `restaurant_slug` antes de navegar para `/login/staff`.
   - Se a busca do slug falhar, manter fallback seguro, mas sem navegar para uma URL quebrada.

3. Tornar `StaffLogin` tolerante a falhas
   - Trocar o `navigate('/login')` feito durante render por um `useEffect`, evitando tela branca.
   - Colocar `try/catch/finally` ao redor do carregamento inicial para garantir que `checkingStaff` sempre termine.
   - Se a consulta de logo falhar, continuar usando o logo padrão.
   - Se a checagem de funcionários falhar, mostrar o formulário normal em vez de travar.

4. Melhorar logout/limpeza de sessão
   - Garantir que logout limpe também `staff_can_manage_orders`, `staff_receives_order_notifications` e timestamp de sessão quando apropriado.
   - Preservar o fluxo de 7 dias para quem logou corretamente.

5. Adicionar um fallback visual de erro no carregamento crítico
   - Se alguma etapa essencial do login/admin demorar demais, mostrar uma mensagem clara com botão para voltar ao login/limpar sessão, em vez de spinner infinito.

Resultado esperado

- Dispositivo novo abre `/login` normalmente.
- Após login do restaurante, `/login/staff` carrega sempre, mesmo em conexão lenta.
- Após login do funcionário, entra em `/{slug}/admin` de forma consistente.
- Quem já está logado continua entrando direto por até 7 dias.
- O painel deixa de depender de uma sessão nativa que ele não usa, eliminando a principal fonte do carregamento infinito.

Arquivos que serão alterados

- `src/components/ProtectedRoute.tsx`
- `src/pages/RestaurantLogin.tsx`
- `src/pages/StaffLogin.tsx`
- possivelmente `src/lib/sessionExpiry.ts` apenas para centralizar limpeza de sessão e reduzir repetição

Não pretendo alterar banco de dados nem mexer nas regras de acesso agora. A correção é no fluxo frontend de sessão/login.