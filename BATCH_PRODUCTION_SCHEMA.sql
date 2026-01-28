-- Add batch production fields
-- Run this in Supabase SQL Editor

ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS production_print_process TEXT,
  ADD COLUMN IF NOT EXISTS production_batch_group TEXT;

-- Create index for batch grouping
CREATE INDEX IF NOT EXISTS idx_orders_batch_group 
  ON orders(production_batch_group) 
  WHERE production_batch_group IS NOT NULL;

-- Create index for print process filtering
CREATE INDEX IF NOT EXISTS idx_orders_print_process 
  ON orders(production_print_process) 
  WHERE production_print_process IS NOT NULL;

-- Done! Now you can group orders by print process and batch them together
