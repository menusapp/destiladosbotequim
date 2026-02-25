

## Correção: Secure Fields "Container not found"

O problema é um race condition clássico: o `mount()` executa antes das `div` containers existirem no DOM porque o formulário é renderizado condicionalmente e a espera fixa de 300ms não é suficiente.

---

### Arquivo: `src/components/menu/checkout/OnlinePaymentStep.tsx`

**3 correções no `useEffect` de Secure Fields (linhas ~140-207):**

1. **Polling do DOM em vez de delay fixo** — Substituir o `await new Promise(r => setTimeout(r, 300))` por uma função `waitForContainers()` que verifica `document.getElementById("mp-card-number")` a cada 150ms, até 20 tentativas (3s max). Só monta os campos quando o container realmente existe.

2. **Unmount na limpeza** — Armazenar as instâncias dos campos (`cardNumber`, `expirationDate`, `securityCode`) em um `useRef<any[]>([])` chamado `secureFieldInstancesRef`. No cleanup do `useEffect`, chamar `.unmount()` em cada instância antes de nullificar, evitando iframes duplicados se o efeito re-executar.

3. **Unmount antes de re-mount** — Antes de criar novos campos, fazer unmount dos anteriores (se existirem) para garantir idempotência.

**Código resultante (substituir linhas 140-207):**

```typescript
const secureFieldInstancesRef = useRef<any[]>([]);

useEffect(() => {
  if (method !== "credit_card" || selectedSavedCard !== "new") return;
  
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout>;

  const waitForContainers = (): Promise<boolean> => {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        if (document.getElementById("mp-card-number")) {
          resolve(true);
        } else if (attempts < 20) {
          retryTimer = setTimeout(check, 150);
        } else {
          console.error("[OnlinePayment] Containers not found after retries");
          resolve(false);
        }
      };
      check();
    });
  };

  const initSecureFields = async () => {
    try {
      const { data: config } = await supabase
        .from("online_payment_config")
        .select("mp_public_key")
        .eq("restaurant_id", restaurantId)
        .maybeSingle();

      if (cancelled || !config?.mp_public_key) return;

      const containersReady = await waitForContainers();
      if (cancelled || !containersReady) return;

      // Unmount previous instances
      secureFieldInstancesRef.current.forEach((f) => { try { f.unmount(); } catch {} });
      secureFieldInstancesRef.current = [];

      const mp = new (window as any).MercadoPago(config.mp_public_key);
      mpInstanceRef.current = mp;

      const style = { height: "100%", width: "100%", fontSize: "16px", fontFamily: "inherit", color: "#333", "::placeholder": { color: "#999" } };

      const cardNumber = mp.fields.create("cardNumber", { placeholder: "0000 0000 0000 0000", style });
      const expirationDate = mp.fields.create("expirationDate", { placeholder: "MM/AA", style });
      const securityCode = mp.fields.create("securityCode", { placeholder: "CVV", style });

      secureFieldInstancesRef.current = [cardNumber, expirationDate, securityCode];

      cardNumber.mount("#mp-card-number");
      expirationDate.mount("#mp-expiration-date");
      securityCode.mount("#mp-security-code");

      cardNumber.on("binChange", (data: any) => { /* brand detection logic unchanged */ });

      secureFieldsReadyRef.current = true;
      setSecureFieldsLoaded(true);
    } catch (err) {
      console.error("[OnlinePayment] Secure Fields init error:", err);
    }
  };

  initSecureFields();
  return () => {
    cancelled = true;
    clearTimeout(retryTimer);
    secureFieldInstancesRef.current.forEach((f) => { try { f.unmount(); } catch {} });
    secureFieldInstancesRef.current = [];
    secureFieldsReadyRef.current = false;
    setSecureFieldsLoaded(false);
    mpInstanceRef.current = null;
  };
}, [method, selectedSavedCard, restaurantId]);
```

**IDs no JSX (linhas ~592-622)** — Já estão corretos (`mp-card-number`, `mp-expiration-date`, `mp-security-code`). Nenhuma alteração necessária no JSX.

---

### Resumo das mudanças

- 1 arquivo modificado: `OnlinePaymentStep.tsx`
- Polling inteligente substitui delay fixo — campos só montam quando o DOM está pronto
- Cleanup com `unmount()` evita duplicação de iframes
- Sem alterações no JSX ou CSS

