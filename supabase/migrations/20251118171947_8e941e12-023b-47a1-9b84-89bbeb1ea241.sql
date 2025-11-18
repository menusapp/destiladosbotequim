-- Adicionar colunas para controle da seção de destaques na tabela restaurants
ALTER TABLE public.restaurants
ADD COLUMN featured_section_enabled BOOLEAN DEFAULT true,
ADD COLUMN featured_section_title TEXT DEFAULT 'Destaques';

-- Adicionar colunas para marcar produtos como destaque
ALTER TABLE public.products
ADD COLUMN is_featured BOOLEAN DEFAULT false,
ADD COLUMN featured_display_order INTEGER DEFAULT 0;

-- Criar índice para melhor performance nas consultas de produtos em destaque
CREATE INDEX idx_products_featured ON public.products(is_featured, featured_display_order) 
WHERE is_featured = true;

-- Comentários para documentação
COMMENT ON COLUMN public.restaurants.featured_section_enabled IS 'Controla se a seção de destaques aparece no cardápio digital';
COMMENT ON COLUMN public.restaurants.featured_section_title IS 'Título customizável da seção de destaques (ex: Destaques, Promoções, Mais Vendidos)';
COMMENT ON COLUMN public.products.is_featured IS 'Marca se o produto está na seção de destaques';
COMMENT ON COLUMN public.products.featured_display_order IS 'Ordem de exibição do produto na seção de destaques (0 = não está nos destaques)';