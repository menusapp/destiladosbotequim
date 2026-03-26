

## Plan: Fix NFC-e Emission — 3 Missing Fields + Production Mode

### Problem (from logs)
The Nuvem Fiscal API returns 400 with 3 validation errors:
1. **`infNFe.ide.nNF`** — invoice number is missing (required sequential number)
2. **`infNFe.ide.dhEmi`** — emission date/time is missing
3. **`infNFe.emit.enderEmit.xMun`** — municipality name is empty string (hardcoded as `""`)
4. **Bonus**: `ambiente` is hardcoded to `"homologacao"` but you're using production credentials

### Changes

**1. Database migration** — Add 2 columns to `fiscal_configs`:
- `municipio_nome TEXT` — store municipality name (e.g. "ASSIS")
- `nfce_serie INTEGER DEFAULT 1` — NFC-e series number
- `nfce_numero INTEGER DEFAULT 1` — auto-incrementing invoice number (nNF)

**2. Edge function `nuvem-fiscal-emit/index.ts`** — Fix the 3 missing fields:
- Add `nNF: config.nfce_numero` to `ide` block
- Add `dhEmi: new Date().toISOString()` (formatted as required: `YYYY-MM-DDThh:mm:ss-03:00`)
- Replace `xMun: ""` with `xMun: config.municipio_nome || ""`
- Change `ambiente: "producao"` and `tpAmb: 1` for production
- After successful emission, increment `nfce_numero` in the database

**3. FiscalSettingsTab.tsx** — Add municipality name input field so admins can fill it when configuring fiscal data (alongside the existing `municipio_codigo` field)

### Technical details
- `nNF` must be sequential per series. We store and auto-increment it in `fiscal_configs.nfce_numero`
- `dhEmi` format for NFC-e: `2026-03-26T15:30:00-03:00` (ISO with timezone offset)
- `xMun` must match the IBGE municipality name (min 2 chars)
- No new dependencies needed

