

## Fix: Certificate Upload Format + Add Inscrição Municipal

### Problem
Two issues:
1. **Certificate upload fails (415)**: The Nuvem Fiscal API expects `application/json` with the certificate as **base64**, NOT `multipart/form-data`. The correct format per their docs:
```json
PUT /empresas/{cpf_cnpj}/certificado
Content-Type: application/json
{
    "certificado": "base64_encoded_pfx_content",
    "password": "senha123"
}
```

2. **Missing `inscricao_municipal`**: The company payload doesn't include municipal inscription, which is needed for NFC-e.

### Changes

**1. Edge function `nuvem-fiscal-company/index.ts`**:
- Replace `FormData` certificate upload with JSON body containing base64-encoded `.pfx` file + password
- Add `inscricao_municipal` field to the company creation payload (from `fiscal_configs`)

**2. Database migration**: Add `inscricao_municipal TEXT` column to `fiscal_configs`

**3. `FiscalSettingsTab.tsx`**: Add input field for "Inscrição Municipal" in the fiscal settings form

### Technical detail
```typescript
// BEFORE (broken — 415 error)
const formData = new FormData();
formData.append("file", new Blob([...]), "certificate.pfx");
formData.append("password", certPassword);
// Content-Type: multipart/form-data ← REJECTED

// AFTER (correct per Nuvem Fiscal docs)
const certBytes = new Uint8Array(await fileData.arrayBuffer());
const certBase64 = btoa(String.fromCharCode(...certBytes));

await fetch(`.../${cpfCnpj}/certificado`, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    certificado: certBase64,
    password: certPassword,
  }),
});
```

### Files to modify
- `supabase/functions/nuvem-fiscal-company/index.ts` — fix certificate upload format + add inscricao_municipal
- `src/components/admin/FiscalSettingsTab.tsx` — add Inscrição Municipal input
- Database migration — add `inscricao_municipal` column

