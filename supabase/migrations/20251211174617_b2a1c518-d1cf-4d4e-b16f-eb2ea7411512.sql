-- Add promotional_price column to products table
ALTER TABLE products 
ADD COLUMN promotional_price numeric DEFAULT NULL;