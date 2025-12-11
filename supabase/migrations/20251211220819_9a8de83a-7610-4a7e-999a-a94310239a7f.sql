-- Add login configuration columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN login_require_name BOOLEAN DEFAULT true,
ADD COLUMN login_require_phone BOOLEAN DEFAULT false;