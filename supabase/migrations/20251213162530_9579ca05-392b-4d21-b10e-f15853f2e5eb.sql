
-- Add radius-based delivery zone support
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS zone_type TEXT DEFAULT 'zip_codes';
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS center_lat NUMERIC;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS center_lng NUMERIC;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS radius_km NUMERIC;

-- Add comment for documentation
COMMENT ON COLUMN delivery_zones.zone_type IS 'Type of zone: zip_codes (CEP/neighborhood) or radius (map circle)';
COMMENT ON COLUMN delivery_zones.center_lat IS 'Latitude of center point for radius zones';
COMMENT ON COLUMN delivery_zones.center_lng IS 'Longitude of center point for radius zones';
COMMENT ON COLUMN delivery_zones.radius_km IS 'Radius in kilometers for radius zones';
