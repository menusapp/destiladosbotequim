-- Criar tabela de restaurantes
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#FF6B35',
  secondary_color TEXT DEFAULT '#1A1A1A',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de credenciais dos restaurantes
CREATE TABLE public.restaurant_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de categorias
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de produtos
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de mesas
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, table_number)
);

-- Criar tabela de pedidos
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'preparing', 'ready', 'delivered')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de itens do pedido
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_order DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de contas/comandas
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES public.tables(id),
  subtotal DECIMAL(10,2) NOT NULL,
  service_fee DECIMAL(10,2) NOT NULL,
  service_fee_removed BOOLEAN DEFAULT false,
  service_fee_removed_at TIMESTAMPTZ,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('pix', 'card', 'cash')),
  change_amount DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'requested', 'paid')),
  bill_requested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Enable RLS em todas as tabelas
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Permitir leitura pública para cardápios (clientes precisam ver)
CREATE POLICY "Restaurantes são públicos" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Categorias são públicas" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Produtos são públicos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Mesas são públicas" ON public.tables FOR SELECT USING (true);

-- Políticas RLS: Permitir inserção pública de pedidos (clientes fazem pedidos)
CREATE POLICY "Qualquer um pode criar pedidos" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Qualquer um pode ver pedidos" ON public.orders FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode atualizar pedidos" ON public.orders FOR UPDATE USING (true);

CREATE POLICY "Qualquer um pode criar itens de pedido" ON public.order_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Qualquer um pode ver itens de pedido" ON public.order_items FOR SELECT USING (true);

CREATE POLICY "Qualquer um pode criar contas" ON public.bills FOR INSERT WITH CHECK (true);
CREATE POLICY "Qualquer um pode ver contas" ON public.bills FOR SELECT USING (true);
CREATE POLICY "Qualquer um pode atualizar contas" ON public.bills FOR UPDATE USING (true);

-- Políticas RLS: Credenciais são privadas (somente leitura para validação de login)
CREATE POLICY "Credenciais são visíveis publicamente para login" ON public.restaurant_credentials FOR SELECT USING (true);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para remover taxa de serviço automaticamente após 5 minutos
CREATE OR REPLACE FUNCTION public.check_service_fee_timeout()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'requested' AND NEW.bill_requested_at IS NOT NULL THEN
    IF (EXTRACT(EPOCH FROM (now() - NEW.bill_requested_at)) / 60) >= 5 AND NEW.service_fee_removed = false THEN
      NEW.service_fee_removed = true;
      NEW.service_fee_removed_at = now();
      NEW.total_amount = NEW.subtotal;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_bill_timeout BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.check_service_fee_timeout();