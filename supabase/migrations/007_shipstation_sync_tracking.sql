-- Migration 007: ShipStation Integration & Sync Tracking
-- Run this in Supabase SQL Editor BEFORE deploying the app changes

-- ============================================================================
-- ORDERS TABLE: Add ShipStation-specific columns (if not exist)
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS external_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS platform TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_total DECIMAL(10,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_image_url TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customization_options JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS raw_data JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Unique constraint to prevent duplicate imports
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_external_platform 
  ON orders(external_id, platform) 
  WHERE external_id IS NOT NULL AND platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(platform) WHERE platform IS NOT NULL;

-- ============================================================================
-- SHIPSTATION SYNC RUNS TABLE: Track all sync attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS shipstation_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failed')),
  
  -- Sync statistics
  fetched_count INTEGER DEFAULT 0,
  inserted_count INTEGER DEFAULT 0,
  updated_count INTEGER DEFAULT 0,
  skipped_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  
  -- Error details (safe summary, no secrets)
  error_summary TEXT,
  error_details JSONB,
  
  -- Sync parameters
  sync_type TEXT DEFAULT 'incremental', -- 'incremental', '24h', '7d', '30d', 'full'
  modified_after TIMESTAMPTZ,
  
  -- Trigger info
  triggered_by TEXT DEFAULT 'manual', -- 'manual', 'cron', 'api'
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_runs_created ON shipstation_sync_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_runs_status ON shipstation_sync_runs(status);

-- ============================================================================
-- APP SETTINGS: Add ShipStation tracking columns
-- ============================================================================

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS last_shipstation_sync TIMESTAMPTZ;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS last_shipstation_sync_attempt TIMESTAMPTZ;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS last_shipstation_sync_error TEXT;

-- ============================================================================
-- HELPER FUNCTION: Get recent sync runs
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_sync_runs(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status TEXT,
  fetched_count INTEGER,
  inserted_count INTEGER,
  updated_count INTEGER,
  skipped_count INTEGER,
  error_count INTEGER,
  error_summary TEXT,
  sync_type TEXT,
  triggered_by TEXT,
  duration_seconds NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.started_at,
    r.finished_at,
    r.status,
    r.fetched_count,
    r.inserted_count,
    r.updated_count,
    r.skipped_count,
    r.error_count,
    r.error_summary,
    r.sync_type,
    r.triggered_by,
    CASE 
      WHEN r.finished_at IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (r.finished_at - r.started_at))::NUMERIC
      ELSE NULL
    END as duration_seconds
  FROM shipstation_sync_runs r
  ORDER BY r.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- DONE - Migration complete
-- ============================================================================
