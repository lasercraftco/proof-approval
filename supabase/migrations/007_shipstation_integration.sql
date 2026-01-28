-- Migration 007: ShipStation Integration Support
-- Run this in Supabase SQL Editor

-- ============================================================================
-- ORDERS: Add ShipStation-specific columns
-- ============================================================================

-- External ID from ShipStation (orderId)
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Platform source (shipstation, manual, etc.)
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS platform TEXT;

-- Order total amount
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS order_total DECIMAL(10,2);

-- Product information
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS product_name TEXT;

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS product_image_url TEXT;

-- Customization options (JSON)
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS customization_options JSONB;

-- Raw ShipStation data for reference
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS raw_data JSONB;

-- Updated timestamp
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================================
-- INDEXES for ShipStation lookups
-- ============================================================================

-- Unique constraint on external_id + platform to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_platform 
  ON orders(external_id, platform) 
  WHERE external_id IS NOT NULL AND platform IS NOT NULL;

-- Index for platform filtering
CREATE INDEX IF NOT EXISTS idx_orders_platform 
  ON orders(platform) 
  WHERE platform IS NOT NULL;

-- ============================================================================
-- APP SETTINGS: Add sync tracking columns
-- ============================================================================

ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS last_shipstation_sync TIMESTAMPTZ;

ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS last_shipstation_sync_attempt TIMESTAMPTZ;

ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS last_shipstation_sync_error TEXT;

ALTER TABLE app_settings 
  ADD COLUMN IF NOT EXISTS shipstation_sync_stats JSONB DEFAULT '{}'::jsonb;

-- ============================================================================
-- DONE
-- ============================================================================
