-- =====================================================================
-- FIX: storage + RPCs administrativas sob o modelo de sessão por token
-- ---------------------------------------------------------------------
-- No modelo de sessão no servidor (x-app-token) o papel do Postgres da
-- requisição continua sendo `anon` — a identidade do staff vem do token no
-- header, validado pelos helpers is_staff()/current_restaurant_id().
--
-- As politicas de STORAGE e os GRANTs das RPCs admin foram criados como
-- `TO authenticated`, mas o staff NUNCA é `authenticated` neste modelo. Logo:
--   * upload de imagem de produto/mesa/logo falhava (RLS de storage negava);
--   * RPCs admin_* davam "permission denied" para o staff.
-- Correção: liberar para `public`/`anon`, mas com o GATE REAL = is_staff()/
-- is_ceo() (anon sem token → helpers retornam false/NULL → acesso negado).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) STORAGE — escrita nos buckets de imagem para a sessão de staff.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "auth_write_product_images"  ON storage.objects;
DROP POLICY IF EXISTS "auth_update_product_images" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_product_images" ON storage.objects;
DROP POLICY IF EXISTS "auth_write_table_images"    ON storage.objects;
DROP POLICY IF EXISTS "auth_update_table_images"   ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_table_images"   ON storage.objects;

-- product-images (também usado por logo/dados da empresa). Escrita = staff logado.
CREATE POLICY "staff_write_product_images" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'product-images' AND public.is_staff());
CREATE POLICY "staff_update_product_images" ON storage.objects
  FOR UPDATE TO public USING (bucket_id = 'product-images' AND public.is_staff())
  WITH CHECK (bucket_id = 'product-images' AND public.is_staff());
CREATE POLICY "staff_delete_product_images" ON storage.objects
  FOR DELETE TO public USING (bucket_id = 'product-images' AND public.is_staff());

-- table-images. Escrita = staff logado.
CREATE POLICY "staff_write_table_images" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'table-images' AND public.is_staff());
CREATE POLICY "staff_update_table_images" ON storage.objects
  FOR UPDATE TO public USING (bucket_id = 'table-images' AND public.is_staff())
  WITH CHECK (bucket_id = 'table-images' AND public.is_staff());
CREATE POLICY "staff_delete_table_images" ON storage.objects
  FOR DELETE TO public USING (bucket_id = 'table-images' AND public.is_staff());

-- Leitura das imagens continua pública via CDN (buckets public=true), sem
-- necessidade de política SELECT.
--
-- (As RPCs admin_* são tratadas na migration seguinte — precisam de um GATE
--  is_staff()/is_ceo() interno antes de poderem ser executáveis por anon.)
