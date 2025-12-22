-- Add accepted_brands column to payment_methods table
ALTER TABLE payment_methods 
ADD COLUMN accepted_brands text[] DEFAULT '{}';