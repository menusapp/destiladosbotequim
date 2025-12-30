-- Add activated_at column to loyalty_programs to track when program was activated
ALTER TABLE public.loyalty_programs 
ADD COLUMN activated_at timestamp with time zone DEFAULT NULL;

-- Backfill existing active programs with updated_at as fallback
UPDATE public.loyalty_programs 
SET activated_at = updated_at 
WHERE is_active = true AND activated_at IS NULL;