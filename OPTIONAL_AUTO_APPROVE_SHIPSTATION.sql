-- Optional: Auto-approve ShipStation orders so they appear in production queue
-- Run this in Supabase SQL Editor if you want imported orders to go straight to production

-- Option 1: Approve ALL ShipStation orders that are currently 'open'
UPDATE orders 
SET status = 'approved'
WHERE platform = 'shipstation' 
  AND status = 'open';

-- Option 2: Or just set production_status to 'ready' without changing order status
-- This makes them appear in production queue without marking as "approved"
-- UPDATE orders 
-- SET production_status = 'ready'
-- WHERE platform = 'shipstation';

-- After running this, your ShipStation orders will appear in /admin/production
