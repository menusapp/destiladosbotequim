

## Analysis

The issue is that `<Label>` elements above the Secure Field containers are overlapping the top portion of the container divs, intercepting click events. Additionally, the iframe may not fill the full container height.

## Plan — `src/components/menu/checkout/OnlinePaymentStep.tsx`

Three surgical CSS changes:

1. **Labels above Secure Fields**: Add `w-fit` class to the three `<Label>` elements for "Número do Cartão", "Validade", and "CVV" so they don't stretch full width and block clicks on the container below.

2. **Secure Field containers**: The containers already have `flex items-stretch` and iframe overrides. No further changes needed — the existing `[&>iframe]:!w-full [&>iframe]:!h-full` classes already force full coverage.

3. **SDK style object**: Already has `width: "100%"` and `height: "100%"`. No padding to remove — it's clean.

### Specific edits:

- Line ~428: `<Label>Número do Cartão *</Label>` → `<Label className="w-fit">Número do Cartão *</Label>`
- Line ~443: `<Label>Validade *</Label>` → `<Label className="w-fit">Validade *</Label>`
- Line ~447: `<Label>CVV *</Label>` → `<Label className="w-fit">CVV *</Label>`

