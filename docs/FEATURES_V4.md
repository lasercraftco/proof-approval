# Features V4 - Job Costing, Product Catalog & Notifications

## New Features

### 1. 💰 Job Costing
See actual profit and margin on every order.

**Features:**
- Automatic labor cost calculation (time × hourly rate)
- Automatic material cost calculation
- Add shipping/other costs manually
- Real-time profit & margin display
- Product profitability reports
- Customer profitability reports

**Component:** Add `<JobCostingCard orderId={id} orderTotal={total} />` to order detail page

**API Endpoints:**
- `GET /api/job-costing/[orderId]` - Get costs for an order
- `PUT /api/job-costing/[orderId]` - Update shipping/other costs
- `POST /api/job-costing/[orderId]/calculate` - Recalculate costs

---

### 2. 📦 Product Catalog
Save product templates for faster order creation.

**Features:**
- Product templates with SKU, price, description
- Estimated design & production times
- Categories for organization
- "Use Template" to pre-fill new orders

**New Page:** `/admin/products`

---

### 3. 🔔 Notifications Center
Real-time alerts without checking email.

**Auto-generated notifications:**
- Order approved → Notifies all admins/managers
- Order changes requested → Notifies all admins/managers
- Material falls below reorder point → Notifies all admins/managers

**Component:** Already integrated into AdminHeader.tsx

---

## Database Migration

Run `supabase/migrations/006_job_costing_products_notifications.sql` in Supabase SQL Editor.

**New Tables:**
- `labor_rates` - Hourly rates for job costing
- `order_costs` - Calculated costs per order
- `products` - Product catalog/templates
- `product_pricing` - Quantity pricing tiers
- `notifications` - In-app notifications
- `notification_preferences` - User notification settings

---

## Integration Steps

1. Run the database migration
2. Upload files to GitHub
3. Add JobCostingCard to order detail page
4. Set up labor rates in settings
