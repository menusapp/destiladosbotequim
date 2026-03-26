

## Plan: Fix Certificate Upload to Nuvem Fiscal + Delete Company on Disconnect

### Root Cause
The logs show `CertificateNotFound` because the `.pfx` file is only uploaded to your storage — it's never sent to Nuvem Fiscal. The Nuvem Fiscal API requires a separate `PUT /empresas/{cpf_cnpj}/certificado` call with the `.pfx` binary + password via `multipart/form-data`.

Similarly, the "Desconectar" button only clears local data — it never calls `DELETE /empresas/{cpf_cnpj}` on Nuvem Fiscal.

### Changes

**1. Edge function `nuvem-fiscal-company/index.ts`** — Add 2 operations:

After creating/updating the company, automatically:
- Download the `.pfx` from Supabase Storage (`fiscal-certificates/{restaurantId}/certificate.pfx`)
- Upload it to Nuvem Fiscal via `PUT /empresas/{cpf_cnpj}/certificado` with `multipart/form-data` (fields: `file` = binary, `password` = certificate password from `fiscal_configs`)
- Only mark as `synced` if certificate upload also succeeds

Add a new action `disconnect`:
- Call `DELETE /empresas/{cpf_cnpj}` on Nuvem Fiscal to remove the company
- Then delete the certificate via `DELETE /empresas/{cpf_cnpj}/certificado`

**2. Frontend `FiscalSettingsTab.tsx`** — Update disconnect handler:

- Call `nuvem-fiscal-company` with `{ restaurantId, action: "disconnect" }` before clearing local data
- Show appropriate toast on success/failure

**3. Edge function `nuvem-fiscal-company/index.ts`** — Handle `EmpresaAlreadyExists`:

- When company creation returns `EmpresaAlreadyExists`, treat it as success (company exists, proceed to certificate upload)
- This prevents the error you saw in logs when re-syncing

### Technical details
- Nuvem Fiscal certificate endpoint: `PUT https://api.nuvemfiscal.com.br/empresas/{cpf_cnpj}/certificado`
- Content-Type: `multipart/form-data` with `file` (binary) and `password` (string)
- Delete company endpoint: `DELETE https://api.nuvemfiscal.com.br/empresas/{cpf_cnpj}`
- Certificate must be in `.pfx` or `.p12` format
- The `certificate_password` field already exists in `fiscal_configs` — we just need to send it along

