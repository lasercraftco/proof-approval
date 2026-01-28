-- Add print process settings to app_settings
-- Run this in Supabase SQL Editor

ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS print_processes JSONB DEFAULT '["UV Printing", "Sublimation", "Screen Print", "Vinyl", "Laser Engraving", "Embroidery", "DTG (Direct to Garment)", "Heat Transfer"]'::jsonb;

-- Update existing record with default processes
UPDATE app_settings 
SET print_processes = '["UV Printing", "Sublimation", "Screen Print", "Vinyl", "Laser Engraving", "Embroidery", "DTG (Direct to Garment)", "Heat Transfer"]'::jsonb
WHERE print_processes IS NULL;
