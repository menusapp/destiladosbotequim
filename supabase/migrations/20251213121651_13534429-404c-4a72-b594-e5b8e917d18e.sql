
-- Tabela para horários de funcionamento
CREATE TABLE public.business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Domingo, 1=Segunda, etc.
  is_open BOOLEAN DEFAULT true,
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, day_of_week)
);

-- Tabela para regiões de entrega
CREATE TABLE public.delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  zone_name TEXT NOT NULL,
  zip_codes TEXT[] DEFAULT '{}',
  neighborhoods TEXT[] DEFAULT '{}',
  delivery_fee NUMERIC DEFAULT 0,
  min_order_value NUMERIC DEFAULT 0,
  estimated_time_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para formas de pagamento
CREATE TABLE public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  method_type TEXT NOT NULL, -- 'cash', 'credit', 'debit', 'pix', 'meal_voucher'
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar coluna para abertura/fechamento automático
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS auto_open_close BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on business_hours" ON public.business_hours FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on delivery_zones" ON public.delivery_zones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on payment_methods" ON public.payment_methods FOR ALL USING (true) WITH CHECK (true);
