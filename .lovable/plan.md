

## Analysis

The current `OnlinePaymentStep.tsx` credit card mode has:
1. **"Dados do Titular" section** (lines 494-545) with manual CPF, Email, Phone, CEP, Address Number inputs — these should be removed since data comes from props
2. **No saved cards logic** — the `customer_cards` table already exists with `card_id`, `last_four_digits`, `payment_method_id`, `first_six_digits`, `customer_cpf`, `restaurant_id`, etc.
3. **handleCreditCardPayment** validates holder fields that will no longer exist

The Secure Fields injection (style tag, useEffect, and container divs) must remain untouched.

## Plan — `src/components/menu/checkout/OnlinePaymentStep.tsx`

### 1. Add new imports
- `Checkbox` from `@/components/ui/checkbox`
- `RadioGroup`, `RadioGroupItem` from `@/components/ui/radio-group`
- `Trash2` icon from lucide-react

### 2. Add new state variables (after existing credit card state)
```typescript
const [savedCards, setSavedCards] = useState<any[]>([]);
const [selectedCardId, setSelectedCardId] = useState<string>("new");
const [isLoadingCards, setIsLoadingCards] = useState(false);
const [saveNewCard, setSaveNewCard] = useState(false);
```

### 3. Remove unused state variables
Remove: `cardHolderCpf`, `cardHolderEmail`, `cardHolderPhone`, `cardHolderPostalCode`, `cardHolderAddressNumber` — no longer needed since props are used directly.

### 4. Add useEffect to fetch saved cards
When `method === "credit_card"`, query `customer_cards` table filtering by `customer_cpf` and `restaurant_id`. Set `savedCards` state. If cards exist, default `selectedCardId` to the first card's ID.

### 5. Add handleDeleteCard function
Delete from `customer_cards` by ID, then remove from local `savedCards` state. If deleted card was selected, reset to `"new"`.

### 6. Update handleCreditCardPayment
- Remove validations for removed fields (CPF, CEP, address number)
- **If `selectedCardId === "new"`**: tokenize via Secure Fields using `customerCPF` prop directly, call edge function with `card_token`, `save_card: saveNewCard`
- **If saved card selected**: call edge function with `action: "pay_with_saved_card"`, `saved_card_id: selectedCardId` (no tokenization needed)

### 7. Update Credit Card UI (lines 452-568)
Replace the entire section between the error card and the action buttons:

**A. Saved Cards List** (rendered if `savedCards.length > 0`):
- RadioGroup with each saved card as a selectable option showing payment method icon + `•••• {last_four_digits}` + delete button
- Plus a "Adicionar Novo Cartão" radio option

**B. Conditional New Card Form** (only when `selectedCardId === "new"`):
- Keep existing Secure Fields divs (card number, expiration, CVV) and card holder name input — UNTOUCHED
- Add Checkbox "Salvar este cartão para compras futuras" below the name input
- Remove the entire "Dados do Titular" section (Separator + CPF/Email/Phone/CEP/Address fields)

**C. When saved card selected**: Hide Secure Fields and name input entirely, show only the Pay button

### Files changed
- `src/components/menu/checkout/OnlinePaymentStep.tsx` (single file)

### What stays untouched
- `<style>` tag for iframe overrides
- `useEffect` for MP SDK initialization
- Container divs `#mp-card-number`, `#mp-expiration-date`, `#mp-security-code` with their exact classes
- PIX flow
- Confirmed/Loading states

