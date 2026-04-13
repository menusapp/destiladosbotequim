

## Plano: Corrigir Status WhatsApp + Nome da Instância + QR Mais Rápido

### Problemas identificados

1. **Nome da instância** usa `rest-{uuid[:8]}` — deveria usar o slug do restaurante (ex: `rest-rods`)
2. **QR lento** — espera 3s antes de tentar + 10 tentativas com 3s de delay = até 33s
3. **Status mostra "desconectado"** mesmo quando Evolution está conectado — o polling do frontend tem timeout de 2 minutos e pode expirar antes da conexão; além disso, ao recarregar a página, o `fetchConfig` lê o DB (que pode estar desatualizado) e não consulta o Evolution API

### Alterações

**1. `supabase/functions/whatsapp-instance/index.ts`**

- Buscar o `slug` do restaurante no banco antes de montar o `instanceName`:
  ```
  const { data: restaurant } = await supabase.from('restaurants').select('slug').eq('id', restaurantId).single();
  const instanceName = `rest-${restaurant.slug}`;
  ```
- Reduzir espera inicial de 3s para 1s
- Reduzir `retryDelay` de 3000ms para 1500ms
- Reduzir `maxAttempts` de 10 para 6
- Manter compatibilidade: ao fazer GET, se não achar a instância com o novo nome, tentar com o nome antigo (`rest-{uuid[:8]}`)

**2. `src/components/admin/settings/WhatsAppSettings.tsx`**

- No `useEffect` inicial, após carregar config do DB, chamar `checkStatus()` automaticamente para sincronizar com Evolution em tempo real
- Aumentar timeout do polling de conexão de 2min para 5min
- No `checkStatus`, ao receber `connected`, também chamar `fetchConfig()` para recarregar config completa

**3. Migration para atualizar instância existente**

- Nenhuma migration necessária — o `instance_name` já existe no `whatsapp_config` e será atualizado automaticamente pelo edge function na próxima chamada

### Resultado esperado

- Instância aparecerá como `rest-rods` na Evolution (usa o slug)
- QR code gerado em ~5-10s em vez de ~30s
- Status sincronizado corretamente ao abrir a página e após escanear QR

