

## Diagnosis

Two problems found:

1. **Edge Function returns non-200 status codes**: The `mercadopago-charge` function returns `status: 400` or `status: 500` when errors occur. The Supabase client's `functions.invoke()` interprets any non-2xx response as a generic error, hiding the actual error details (e.g., `bin_not_found`). The function should always return HTTP 200 and include `{ success: false, error: "..." }` in the body.

2. **`bin_not_found` persists**: This specific MP error means the card number's BIN is not recognized. With test credentials, only [test card numbers](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/test/cards) work (e.g., `5031 4332 1540 6351`). Real card numbers will always fail with test keys.

## Plan

### Step 1 — Fix `mercadopago-charge` to always return HTTP 200

Change all `return new Response(..., { status: 400 })` and `status: 500` to `status: 200`, wrapping error responses in `{ success: false, error: "message" }` format. This ensures the frontend receives the actual error message instead of a generic exception.

### Step 2 — Update frontend error handling

In `OnlinePaymentStep.tsx`, update error handling to check `data?.success === false` or `data?.error` instead of relying on thrown exceptions from `supabase.functions.invoke`.

