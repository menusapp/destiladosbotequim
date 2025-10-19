-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'ceo', 'restaurant_admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  UNIQUE (user_id, role, restaurant_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is restaurant admin
CREATE OR REPLACE FUNCTION public.is_restaurant_admin(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'restaurant_admin'
      AND restaurant_id = _restaurant_id
  )
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- User roles RLS policies
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "CEOs can manage all roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Update RLS policies for secure tables
DROP POLICY IF EXISTS "Qualquer um pode ver credenciais" ON public.restaurant_credentials;
DROP POLICY IF EXISTS "Qualquer um pode atualizar credenciais" ON public.restaurant_credentials;
DROP POLICY IF EXISTS "Qualquer um pode criar credenciais" ON public.restaurant_credentials;
DROP POLICY IF EXISTS "Qualquer um pode excluir credenciais" ON public.restaurant_credentials;

-- Disable public access to credentials (will be managed via Edge Functions)
CREATE POLICY "Only system can access credentials"
ON public.restaurant_credentials FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

-- Update orders RLS
DROP POLICY IF EXISTS "Qualquer um pode ver pedidos" ON public.orders;
DROP POLICY IF EXISTS "Qualquer um pode atualizar pedidos" ON public.orders;
DROP POLICY IF EXISTS "Qualquer um pode criar pedidos" ON public.orders;
DROP POLICY IF EXISTS "Qualquer um pode deletar pedidos" ON public.orders;

CREATE POLICY "Public can view orders for open restaurants"
ON public.orders FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.tables t
    JOIN public.restaurants r ON r.id = t.restaurant_id
    WHERE t.id = table_id AND r.is_open = true
  )
);

CREATE POLICY "Public can create orders for open restaurants"
ON public.orders FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tables t
    JOIN public.restaurants r ON r.id = t.restaurant_id
    WHERE t.id = table_id AND r.is_open = true
  )
);

CREATE POLICY "Restaurant admins can manage orders"
ON public.orders FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = table_id
    AND public.is_restaurant_admin(auth.uid(), t.restaurant_id)
  )
);

-- Update products RLS
DROP POLICY IF EXISTS "Qualquer um pode atualizar produtos" ON public.products;
DROP POLICY IF EXISTS "Qualquer um pode criar produtos" ON public.products;
DROP POLICY IF EXISTS "Qualquer um pode deletar produtos" ON public.products;

CREATE POLICY "Restaurant admins can manage products"
ON public.products FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
);

CREATE POLICY "Restaurant admins can update products"
ON public.products FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
);

CREATE POLICY "Restaurant admins can delete products"
ON public.products FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.id = category_id
    AND public.is_restaurant_admin(auth.uid(), c.restaurant_id)
  )
);

-- Update financial tables RLS
DROP POLICY IF EXISTS "Qualquer um pode ver movimentações de caixa" ON public.cash_movements;
DROP POLICY IF EXISTS "Qualquer um pode criar movimentações de caixa" ON public.cash_movements;
DROP POLICY IF EXISTS "Qualquer um pode atualizar movimentações de caixa" ON public.cash_movements;

CREATE POLICY "Restaurant admins can view cash movements"
ON public.cash_movements FOR SELECT
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant admins can create cash movements"
ON public.cash_movements FOR INSERT
TO authenticated
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant admins can update cash movements"
ON public.cash_movements FOR UPDATE
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));

-- Cash register sessions RLS
DROP POLICY IF EXISTS "Qualquer um pode ver sessões de caixa" ON public.cash_register_sessions;
DROP POLICY IF EXISTS "Qualquer um pode criar sessões de caixa" ON public.cash_register_sessions;
DROP POLICY IF EXISTS "Qualquer um pode atualizar sessões de caixa" ON public.cash_register_sessions;

CREATE POLICY "Restaurant admins can view cash sessions"
ON public.cash_register_sessions FOR SELECT
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant admins can create cash sessions"
ON public.cash_register_sessions FOR INSERT
TO authenticated
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));

CREATE POLICY "Restaurant admins can update open cash sessions"
ON public.cash_register_sessions FOR UPDATE
TO authenticated
USING (
  public.is_restaurant_admin(auth.uid(), restaurant_id)
  AND status = 'open'
);

-- Bills RLS
DROP POLICY IF EXISTS "Qualquer um pode ver contas" ON public.bills;
DROP POLICY IF EXISTS "Qualquer um pode criar contas" ON public.bills;
DROP POLICY IF EXISTS "Qualquer um pode atualizar contas" ON public.bills;

CREATE POLICY "Restaurant admins can view bills"
ON public.bills FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = table_id
    AND public.is_restaurant_admin(auth.uid(), t.restaurant_id)
  )
);

CREATE POLICY "Restaurant admins can create bills"
ON public.bills FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = table_id
    AND public.is_restaurant_admin(auth.uid(), t.restaurant_id)
  )
);

CREATE POLICY "Restaurant admins can update bills"
ON public.bills FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tables t
    WHERE t.id = table_id
    AND public.is_restaurant_admin(auth.uid(), t.restaurant_id)
  )
);

-- Restaurants RLS for management
DROP POLICY IF EXISTS "Qualquer um pode atualizar restaurantes" ON public.restaurants;
DROP POLICY IF EXISTS "Qualquer um pode criar restaurantes" ON public.restaurants;
DROP POLICY IF EXISTS "Qualquer um pode excluir restaurantes" ON public.restaurants;

CREATE POLICY "CEOs can manage restaurants"
ON public.restaurants FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ceo'));

CREATE POLICY "Restaurant admins can update own restaurant"
ON public.restaurants FOR UPDATE
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), id));

-- Categories RLS
DROP POLICY IF EXISTS "Qualquer um pode atualizar categorias" ON public.categories;
DROP POLICY IF EXISTS "Qualquer um pode criar categorias" ON public.categories;
DROP POLICY IF EXISTS "Qualquer um pode deletar categorias" ON public.categories;

CREATE POLICY "Restaurant admins can manage categories"
ON public.categories FOR ALL
TO authenticated
USING (public.is_restaurant_admin(auth.uid(), restaurant_id))
WITH CHECK (public.is_restaurant_admin(auth.uid(), restaurant_id));