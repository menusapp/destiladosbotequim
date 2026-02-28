

## Plano Atualizado: Módulo Fiscal (NFC-e) - Base de Configuração

Confirmado: todos os campos solicitados foram incorporados ao escopo.

### 1. Migração SQL - Tabela `fiscal_configs`

```sql
CREATE TABLE public.fiscal_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  -- Dados da empresa
  cnpj text,
  razao_social text,
  nome_fantasia text,
  inscricao_estadual text,
  email text,
  telefone text,
  -- Endereço desmembrado
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  municipio_codigo text,
  uf text DEFAULT 'SP',
  -- NFC-e / Certificado
  csc_id text,
  csc_code text,
  certificate_password text,
  certificate_file_path text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fiscal_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on fiscal_configs" ON public.fiscal_configs FOR ALL USING (true) WITH CHECK (true);
```

Storage bucket `fiscal-certificates` (privado) com policy para authenticated users.

### 2. Sidebar - `AppSidebar.tsx`

Adicionar `{ id: "fiscal", label: "Fiscal", icon: FileText }` ao array `menuStructure.main` após "marketing".

### 3. Roteamento - `RestaurantAdmin.tsx`

Importar `FiscalSettingsTab` e adicionar case `"fiscal"` no `renderContent()`.

### 4. Novo componente - `FiscalSettingsTab.tsx`

Formulário com seções:
- **Dados da Empresa**: CNPJ (máscara), Razão Social, Nome Fantasia, Inscrição Estadual, Email, Telefone
- **Endereço Fiscal**: CEP, Logradouro, Número, Complemento, Bairro, Município (código IBGE), UF
- **Certificado Digital**: ID do CSC, Código do CSC, Senha do Certificado, Upload .pfx
- Botão "Salvar" faz upsert em `fiscal_configs`

### Escopo

- 1 migração SQL (tabela + bucket + policies)
- 1 novo componente (`FiscalSettingsTab.tsx`)
- 2 arquivos modificados (`AppSidebar.tsx`, `RestaurantAdmin.tsx`)
- Zero integrações com APIs externas

