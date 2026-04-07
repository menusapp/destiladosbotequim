
-- 1. Drop existing open policy
DROP POLICY IF EXISTS "Allow all operations on fiscal_configs" ON public.fiscal_configs;

-- 2. Block direct access
CREATE POLICY "block_direct_access" ON public.fiscal_configs
  FOR ALL USING (false) WITH CHECK (false);

-- 3. RPC: get fiscal config
CREATE OR REPLACE FUNCTION public.admin_get_fiscal_config(p_restaurant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT to_jsonb(fc.*) INTO result
  FROM fiscal_configs fc
  WHERE fc.restaurant_id = p_restaurant_id;
  
  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- 4. RPC: upsert fiscal config
CREATE OR REPLACE FUNCTION public.admin_upsert_fiscal_config(p_restaurant_id uuid, p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO fiscal_configs (
    restaurant_id, cnpj, razao_social, nome_fantasia, inscricao_estadual, inscricao_municipal,
    email, telefone, cep, logradouro, numero, complemento, bairro,
    municipio_codigo, municipio_nome, uf, csc_id, csc_code,
    certificate_password, certificate_file_path
  ) VALUES (
    p_restaurant_id,
    COALESCE(p_data->>'cnpj', ''),
    COALESCE(p_data->>'razao_social', ''),
    COALESCE(p_data->>'nome_fantasia', ''),
    COALESCE(p_data->>'inscricao_estadual', ''),
    COALESCE(p_data->>'inscricao_municipal', ''),
    COALESCE(p_data->>'email', ''),
    COALESCE(p_data->>'telefone', ''),
    COALESCE(p_data->>'cep', ''),
    COALESCE(p_data->>'logradouro', ''),
    COALESCE(p_data->>'numero', ''),
    COALESCE(p_data->>'complemento', ''),
    COALESCE(p_data->>'bairro', ''),
    COALESCE(p_data->>'municipio_codigo', ''),
    COALESCE(p_data->>'municipio_nome', ''),
    COALESCE(p_data->>'uf', 'SP'),
    COALESCE(p_data->>'csc_id', ''),
    COALESCE(p_data->>'csc_code', ''),
    COALESCE(p_data->>'certificate_password', ''),
    COALESCE(p_data->>'certificate_file_path', '')
  )
  ON CONFLICT (restaurant_id) DO UPDATE SET
    cnpj = COALESCE(p_data->>'cnpj', fiscal_configs.cnpj),
    razao_social = COALESCE(p_data->>'razao_social', fiscal_configs.razao_social),
    nome_fantasia = COALESCE(p_data->>'nome_fantasia', fiscal_configs.nome_fantasia),
    inscricao_estadual = COALESCE(p_data->>'inscricao_estadual', fiscal_configs.inscricao_estadual),
    inscricao_municipal = COALESCE(p_data->>'inscricao_municipal', fiscal_configs.inscricao_municipal),
    email = COALESCE(p_data->>'email', fiscal_configs.email),
    telefone = COALESCE(p_data->>'telefone', fiscal_configs.telefone),
    cep = COALESCE(p_data->>'cep', fiscal_configs.cep),
    logradouro = COALESCE(p_data->>'logradouro', fiscal_configs.logradouro),
    numero = COALESCE(p_data->>'numero', fiscal_configs.numero),
    complemento = COALESCE(p_data->>'complemento', fiscal_configs.complemento),
    bairro = COALESCE(p_data->>'bairro', fiscal_configs.bairro),
    municipio_codigo = COALESCE(p_data->>'municipio_codigo', fiscal_configs.municipio_codigo),
    municipio_nome = COALESCE(p_data->>'municipio_nome', fiscal_configs.municipio_nome),
    uf = COALESCE(p_data->>'uf', fiscal_configs.uf),
    csc_id = COALESCE(p_data->>'csc_id', fiscal_configs.csc_id),
    csc_code = COALESCE(p_data->>'csc_code', fiscal_configs.csc_code),
    certificate_password = COALESCE(p_data->>'certificate_password', fiscal_configs.certificate_password),
    certificate_file_path = COALESCE(p_data->>'certificate_file_path', fiscal_configs.certificate_file_path),
    updated_at = now();
END;
$$;

-- 5. RPC: update specific fields (for disconnect)
CREATE OR REPLACE FUNCTION public.admin_update_fiscal_config(p_restaurant_id uuid, p_updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  UPDATE fiscal_configs SET
    nuvem_fiscal_status = CASE WHEN p_updates ? 'nuvem_fiscal_status' THEN p_updates->>'nuvem_fiscal_status' ELSE nuvem_fiscal_status END,
    csc_id = CASE WHEN p_updates ? 'csc_id' THEN p_updates->>'csc_id' ELSE csc_id END,
    csc_code = CASE WHEN p_updates ? 'csc_code' THEN p_updates->>'csc_code' ELSE csc_code END,
    certificate_password = CASE WHEN p_updates ? 'certificate_password' THEN p_updates->>'certificate_password' ELSE certificate_password END,
    certificate_file_path = CASE WHEN p_updates ? 'certificate_file_path' THEN p_updates->>'certificate_file_path' ELSE certificate_file_path END,
    updated_at = now()
  WHERE restaurant_id = p_restaurant_id;
END;
$$;
