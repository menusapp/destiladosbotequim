-- Criar categorias de estoque
CREATE TABLE public.stock_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de insumos/ingredientes
CREATE TABLE public.stock_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.stock_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit TEXT NOT NULL, -- kg, g, ml, l, unidade, etc
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  current_quantity NUMERIC NOT NULL DEFAULT 0,
  minimum_quantity NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Relacionamento produto-ingrediente (receita)
CREATE TABLE public.product_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0, -- quantidade do ingrediente usada
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(product_id, stock_item_id)
);

-- Histórico de movimentação de estoque
CREATE TABLE public.stock_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  movement_type TEXT NOT NULL, -- 'in' (entrada), 'out' (saída), 'adjustment' (ajuste)
  quantity NUMERIC NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.stock_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para stock_categories
CREATE POLICY "Categorias de estoque são públicas"
ON public.stock_categories FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode criar categorias de estoque"
ON public.stock_categories FOR INSERT WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar categorias de estoque"
ON public.stock_categories FOR UPDATE USING (true);

CREATE POLICY "Qualquer um pode deletar categorias de estoque"
ON public.stock_categories FOR DELETE USING (true);

-- Políticas RLS para stock_items
CREATE POLICY "Insumos são públicos"
ON public.stock_items FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode criar insumos"
ON public.stock_items FOR INSERT WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar insumos"
ON public.stock_items FOR UPDATE USING (true);

CREATE POLICY "Qualquer um pode deletar insumos"
ON public.stock_items FOR DELETE USING (true);

-- Políticas RLS para product_ingredients
CREATE POLICY "Ingredientes de produtos são públicos"
ON public.product_ingredients FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode criar ingredientes de produtos"
ON public.product_ingredients FOR INSERT WITH CHECK (true);

CREATE POLICY "Qualquer um pode atualizar ingredientes de produtos"
ON public.product_ingredients FOR UPDATE USING (true);

CREATE POLICY "Qualquer um pode deletar ingredientes de produtos"
ON public.product_ingredients FOR DELETE USING (true);

-- Políticas RLS para stock_movements
CREATE POLICY "Movimentações são públicas"
ON public.stock_movements FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode criar movimentações"
ON public.stock_movements FOR INSERT WITH CHECK (true);

-- Triggers para updated_at
CREATE TRIGGER update_stock_categories_updated_at
BEFORE UPDATE ON public.stock_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_stock_items_updated_at
BEFORE UPDATE ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_stock_items_restaurant ON public.stock_items(restaurant_id);
CREATE INDEX idx_stock_items_category ON public.stock_items(category_id);
CREATE INDEX idx_product_ingredients_product ON public.product_ingredients(product_id);
CREATE INDEX idx_product_ingredients_stock ON public.product_ingredients(stock_item_id);
CREATE INDEX idx_stock_movements_item ON public.stock_movements(stock_item_id);
CREATE INDEX idx_stock_movements_order ON public.stock_movements(order_id);