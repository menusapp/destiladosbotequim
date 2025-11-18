-- Add rating and review_count columns to restaurants table
ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 4.8,
ADD COLUMN IF NOT EXISTS review_count integer DEFAULT 12;