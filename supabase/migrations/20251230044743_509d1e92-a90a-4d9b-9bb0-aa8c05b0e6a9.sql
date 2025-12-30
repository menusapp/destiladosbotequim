-- Adicionar coluna para armazenar a variação específica do produto grátis no cupom
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS target_extra_id uuid REFERENCES extra_category_items(id) ON DELETE SET NULL;

-- Comentário explicativo
COMMENT ON COLUMN coupons.target_extra_id IS 'ID do item de categoria extra (variação) selecionado para cupons de produto grátis com variantes';