-- Add is_open column to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN is_open boolean DEFAULT true;

-- Update RLS policies to allow checking restaurant status
CREATE POLICY "Qualquer um pode ver status do restaurante"
ON public.restaurants
FOR SELECT
USING (true);