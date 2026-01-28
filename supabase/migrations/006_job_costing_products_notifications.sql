-- Migration 006: Job Costing, Product Catalog, and Notifications
-- Run this in Supabase SQL Editor

-- ============================================================================
-- LABOR RATES (for job costing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS labor_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name TEXT NOT NULL, -- 'Default', 'Designer', 'Operator', etc.
  hourly_rate DECIMAL(10,2) NOT NULL,
  
  -- Optional: link to specific user or role
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  role TEXT, -- 'designer', 'operator', etc.
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed a default rate
INSERT INTO labor_rates (name, hourly_rate, is_default)
VALUES ('Default', 25.00, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- JOB COSTS (calculated per order)
-- ============================================================================

CREATE TABLE IF NOT EXISTS order_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
  
  -- Revenue
  order_revenue DECIMAL(10,2), -- From order_total
  
  -- Costs
  labor_cost DECIMAL(10,2) DEFAULT 0, -- Calculated from time entries
  material_cost DECIMAL(10,2) DEFAULT 0, -- Calculated from order_materials
  shipping_cost DECIMAL(10,2) DEFAULT 0, -- If tracked
  other_cost DECIMAL(10,2) DEFAULT 0, -- Manual adjustments
  
  -- Calculated
  total_cost DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(labor_cost, 0) + COALESCE(material_cost, 0) + 
    COALESCE(shipping_cost, 0) + COALESCE(other_cost, 0)
  ) STORED,
  
  gross_profit DECIMAL(10,2) GENERATED ALWAYS AS (
    COALESCE(order_revenue, 0) - (
      COALESCE(labor_cost, 0) + COALESCE(material_cost, 0) + 
      COALESCE(shipping_cost, 0) + COALESCE(other_cost, 0)
    )
  ) STORED,
  
  profit_margin DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(order_revenue, 0) > 0 THEN
        ((COALESCE(order_revenue, 0) - (
          COALESCE(labor_cost, 0) + COALESCE(material_cost, 0) + 
          COALESCE(shipping_cost, 0) + COALESCE(other_cost, 0)
        )) / order_revenue * 100)
      ELSE 0
    END
  ) STORED,
  
  -- Metadata
  labor_minutes INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMPTZ DEFAULT now(),
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_costs_order ON order_costs(order_id);
CREATE INDEX IF NOT EXISTS idx_order_costs_profit ON order_costs(gross_profit);
CREATE INDEX IF NOT EXISTS idx_order_costs_margin ON order_costs(profit_margin);

-- ============================================================================
-- PRODUCT CATALOG / TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  
  -- Categorization
  category TEXT,
  tags TEXT[],
  
  -- Pricing
  base_price DECIMAL(10,2),
  
  -- Time estimates (in minutes)
  estimated_design_time INTEGER,
  estimated_production_time INTEGER,
  estimated_total_time INTEGER,
  
  -- Default materials (JSON array of {material_id, quantity})
  default_materials JSONB DEFAULT '[]',
  
  -- Images
  image_url TEXT,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

-- Product pricing tiers (for quantity breaks)
CREATE TABLE IF NOT EXISTS product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  
  min_quantity INTEGER NOT NULL DEFAULT 1,
  max_quantity INTEGER, -- NULL means unlimited
  unit_price DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_pricing_product ON product_pricing(product_id);

-- ============================================================================
-- NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who receives this
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  -- If NULL, it's a global/broadcast notification
  
  -- Content
  title TEXT NOT NULL,
  message TEXT,
  
  -- Type for styling/icons
  type TEXT DEFAULT 'info', -- 'info', 'success', 'warning', 'error', 'order', 'customer', 'inventory'
  
  -- Link to related entity
  link_url TEXT,
  entity_type TEXT, -- 'order', 'customer', 'inventory', etc.
  entity_id UUID,
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  
  -- For dismissable notifications
  is_dismissed BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Notification preferences per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  
  -- Email notifications
  email_order_approved BOOLEAN DEFAULT true,
  email_order_changes_requested BOOLEAN DEFAULT true,
  email_low_stock BOOLEAN DEFAULT true,
  email_daily_summary BOOLEAN DEFAULT false,
  
  -- In-app notifications
  inapp_order_approved BOOLEAN DEFAULT true,
  inapp_order_changes_requested BOOLEAN DEFAULT true,
  inapp_low_stock BOOLEAN DEFAULT true,
  inapp_new_order BOOLEAN DEFAULT true,
  
  -- Push notifications (for future)
  push_enabled BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to calculate job costs for an order
CREATE OR REPLACE FUNCTION calculate_order_costs(p_order_id UUID)
RETURNS order_costs AS $$
DECLARE
  v_order RECORD;
  v_labor_minutes INTEGER;
  v_labor_cost DECIMAL(10,2);
  v_material_cost DECIMAL(10,2);
  v_default_rate DECIMAL(10,2);
  v_result order_costs;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Get default labor rate
  SELECT hourly_rate INTO v_default_rate FROM labor_rates WHERE is_default = true LIMIT 1;
  IF v_default_rate IS NULL THEN
    v_default_rate := 25.00; -- Fallback
  END IF;
  
  -- Calculate labor cost from time entries
  SELECT 
    COALESCE(SUM(duration_minutes), 0),
    COALESCE(SUM(duration_minutes), 0) / 60.0 * v_default_rate
  INTO v_labor_minutes, v_labor_cost
  FROM time_entries
  WHERE order_id = p_order_id AND duration_minutes IS NOT NULL;
  
  -- Calculate material cost
  SELECT COALESCE(SUM(om.quantity * COALESCE(om.unit_cost_at_time, m.unit_cost, 0)), 0)
  INTO v_material_cost
  FROM order_materials om
  JOIN materials m ON m.id = om.material_id
  WHERE om.order_id = p_order_id;
  
  -- Upsert order_costs
  INSERT INTO order_costs (
    order_id, order_revenue, labor_cost, material_cost, labor_minutes, last_calculated_at
  )
  VALUES (
    p_order_id, v_order.order_total, v_labor_cost, v_material_cost, v_labor_minutes, now()
  )
  ON CONFLICT (order_id) DO UPDATE SET
    order_revenue = v_order.order_total,
    labor_cost = v_labor_cost,
    material_cost = v_material_cost,
    labor_minutes = v_labor_minutes,
    last_calculated_at = now(),
    updated_at = now()
  RETURNING * INTO v_result;
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to create a notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'info',
  p_link_url TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, title, message, type, link_url, entity_type, entity_id)
  VALUES (p_user_id, p_title, p_message, p_type, p_link_url, p_entity_type, p_entity_id)
  RETURNING id INTO v_notification_id;
  
  RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Function to notify all staff (managers and admins)
CREATE OR REPLACE FUNCTION notify_staff(
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_type TEXT DEFAULT 'info',
  p_link_url TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM users WHERE role IN ('admin', 'manager') AND is_active = true
  LOOP
    PERFORM create_notification(v_user.id, p_title, p_message, p_type, p_link_url, p_entity_type, p_entity_id);
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-create notification when customer approves order
CREATE OR REPLACE FUNCTION notify_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'approved_with_notes') THEN
    PERFORM notify_staff(
      'Order Approved',
      'Order #' || NEW.order_number || ' was approved by customer' || 
        CASE WHEN NEW.status = 'approved_with_notes' THEN ' (with notes)' ELSE '' END,
      'success',
      '/admin/orders/' || NEW.id,
      'order',
      NEW.id
    );
  END IF;
  
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'changes_requested' THEN
    PERFORM notify_staff(
      'Changes Requested',
      'Customer requested changes on Order #' || NEW.order_number,
      'warning',
      '/admin/orders/' || NEW.id,
      'order',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_on_approval ON orders;
CREATE TRIGGER trigger_notify_on_approval
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_approval();

-- Auto-create notification for low stock
CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.current_stock <= NEW.reorder_point AND 
     (OLD.current_stock IS NULL OR OLD.current_stock > OLD.reorder_point) THEN
    PERFORM notify_staff(
      'Low Stock Alert',
      NEW.name || ' (' || NEW.sku || ') is below reorder point. Current: ' || NEW.current_stock || ', Reorder at: ' || NEW.reorder_point,
      'warning',
      '/admin/inventory',
      'material',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON materials;
CREATE TRIGGER trigger_notify_low_stock
  AFTER UPDATE ON materials
  FOR EACH ROW
  WHEN (NEW.reorder_point IS NOT NULL)
  EXECUTE FUNCTION notify_low_stock();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Profitability by product (SKU)
CREATE OR REPLACE VIEW product_profitability AS
SELECT 
  o.sku,
  o.product_name,
  COUNT(*) as order_count,
  SUM(oc.order_revenue) as total_revenue,
  SUM(oc.total_cost) as total_cost,
  SUM(oc.gross_profit) as total_profit,
  AVG(oc.profit_margin) as avg_margin,
  AVG(oc.labor_minutes) as avg_labor_minutes
FROM orders o
JOIN order_costs oc ON oc.order_id = o.id
WHERE o.sku IS NOT NULL
GROUP BY o.sku, o.product_name
ORDER BY total_profit DESC;

-- Profitability by customer
CREATE OR REPLACE VIEW customer_profitability AS
SELECT 
  c.id as customer_id,
  c.name as customer_name,
  c.primary_email,
  COUNT(o.id) as order_count,
  SUM(oc.order_revenue) as total_revenue,
  SUM(oc.total_cost) as total_cost,
  SUM(oc.gross_profit) as total_profit,
  AVG(oc.profit_margin) as avg_margin
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_costs oc ON oc.order_id = o.id
GROUP BY c.id, c.name, c.primary_email
ORDER BY total_profit DESC;

-- ============================================================================
-- DONE
-- ============================================================================
