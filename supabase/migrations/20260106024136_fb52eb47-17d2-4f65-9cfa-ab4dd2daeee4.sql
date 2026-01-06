-- Adicionar coluna reservations_enabled na tabela restaurants
ALTER TABLE public.restaurants 
ADD COLUMN reservations_enabled BOOLEAN DEFAULT false;

-- Criar tabela de mesas para reserva
CREATE TABLE public.reservation_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  min_capacity INTEGER NOT NULL DEFAULT 1,
  max_capacity INTEGER NOT NULL DEFAULT 4,
  is_available BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Criar tabela de reservas
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  reservation_table_id UUID NOT NULL REFERENCES public.reservation_tables(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_cpf TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  party_size INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_by TEXT,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.reservation_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- Políticas para reservation_tables
CREATE POLICY "Mesas de reserva são públicas para leitura"
ON public.reservation_tables
FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar mesas de reserva"
ON public.reservation_tables
FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Políticas para reservations
CREATE POLICY "Reservas podem ser criadas publicamente"
ON public.reservations
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Reservas podem ser lidas publicamente"
ON public.reservations
FOR SELECT
USING (true);

CREATE POLICY "Admins podem gerenciar reservas"
ON public.reservations
FOR ALL
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_reservation_tables_updated_at
BEFORE UPDATE ON public.reservation_tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_reservations_restaurant_date ON public.reservations(restaurant_id, reservation_date);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservation_tables_restaurant ON public.reservation_tables(restaurant_id);