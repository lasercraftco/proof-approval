# CHANGELOG - ShipStation Integration UI Controls

## Summary

Added unmistakable ShipStation sync UI controls to the Orders page with full status display, sync history, and a dedicated integrations debug page.

---

## UI Location Map

### 1. Orders Page (`/admin/orders`)
**File:** `app/admin/orders/OrdersClient.tsx`
**Location in code:** Lines 186-350 (ShipStation panel at top of component)

**What you will see:**
- White panel at the TOP of the Orders page with:
  - **Status badge**: "Configured" (green) or "Not Configured" (amber)
  - **Last sync timestamp**: "Last sync: 2 hours ago"
  - **Order count**: "Orders: 142"
  - **"Test Connection" button**: Tests API credentials
  - **"Sync Log" button**: Shows last 10 sync runs
  - **"Sync ShipStation Orders" button**: Blue, prominent, main action

### 2. Integrations Debug Page (`/admin/integrations`)
**Files:** 
- `app/admin/integrations/page.tsx`
- `app/admin/integrations/IntegrationsClient.tsx`

**What you will see:**
- Full ShipStation integration dashboard
- Test Connection button
- Stats: ShipStation orders, Manual orders, Total, Sync runs
- Last successful sync / Last attempt / Last error display
- Sync buttons: Incremental, Last 24h, Last 7 Days, Last 30 Days
- Full sync history table (last 20 runs)
- Environment variables help section

---

## Files Changed/Added

| Path | Type | Description |
|------|------|-------------|
| `app/admin/orders/OrdersClient.tsx` | **Modified** | ShipStation sync panel embedded at top |
| `app/admin/integrations/page.tsx` | **New** | Integrations debug page (server) |
| `app/admin/integrations/IntegrationsClient.tsx` | **New** | Integrations UI (client) |
| `app/api/shipstation/sync/route.ts` | **Modified** | Sync with DB logging |
| `app/api/shipstation/status/route.ts` | **New** | Config status + history |
| `app/api/shipstation/test/route.ts` | **New** | Connection test |
| `supabase/migrations/007_shipstation_sync_tracking.sql` | **New** | DB schema |

---

## Step-by-Step Verification

### Pre-Requisites

1. **Run the database migration:**
   - Open Supabase dashboard → SQL Editor
   - Paste contents of `supabase/migrations/007_shipstation_sync_tracking.sql`
   - Click "Run"

2. **Extract files:**
   ```bash
   cd your-project
   unzip shipstation-ui-controls.zip -o
   ```

3. **Run the app:**
   ```bash
   npm run dev
   ```

### Verification Checklist

#### ✅ Step 1: Orders Page - Not Configured State
1. Go to `http://localhost:3000/admin/orders`
2. Look at the TOP of the page
3. Verify you see a white panel with:
   - Amber "Not Configured" badge
   - Text: "Missing: SHIPSTATION_API_KEY, SHIPSTATION_API_SECRET"
   - Grayed out "Sync ShipStation Orders" button

#### ✅ Step 2: Integrations Page
1. Go to `http://localhost:3000/admin/integrations`
2. Verify you see:
   - ShipStation card with stats
   - "Test Connection" button
   - Sync history table (empty initially)
   - Environment variables help at bottom

#### ✅ Step 3: Add Environment Variables
In Vercel (Settings → Environment Variables) or `.env.local`:
```
SHIPSTATION_API_KEY=your_api_key
SHIPSTATION_API_SECRET=your_api_secret
```
Restart/redeploy the app.

#### ✅ Step 4: Configured State
1. Go to `/admin/orders`
2. Verify:
   - Green "Configured" badge
   - Blue "Sync ShipStation Orders" button (enabled)

#### ✅ Step 5: Test Connection
1. Click "Test Connection"
2. Verify success message with connected stores

#### ✅ Step 6: Run Sync
1. Click "Sync ShipStation Orders"
2. Verify:
   - Button shows "Syncing..." with spinner
   - Success panel appears with stats (Fetched, New, Updated, Skipped)
   - Table refreshes automatically

#### ✅ Step 7: View Sync Log
1. Click "Sync Log" button
2. Verify table shows your sync run with timestamp and stats

#### ✅ Step 8: Idempotency Test
1. Run sync again
2. Verify no duplicate orders created (check "New" count)

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `SHIPSTATION_API_KEY` | Your ShipStation API Key |
| `SHIPSTATION_API_SECRET` | Your ShipStation API Secret |
| `CRON_SECRET` | For automated cron sync (min 16 chars) |

### Getting ShipStation Credentials
1. Log in to ShipStation
2. Go to **Settings** → **Account** → **API Settings**
3. Click **Generate API Keys**
4. Copy the **API Key** and **API Secret**

### Setting in Vercel
1. Go to Vercel project dashboard
2. Settings → Environment Variables
3. Add variables for Production environment
4. Redeploy

---

## Troubleshooting

### "Not Configured" shows after setting env vars
- Redeploy the app after adding variables
- Check for typos in variable names
- Verify correct environment (Production/Preview)

### Sync button disabled
- Status must show "Configured"
- Check `/admin/integrations` for details

### "Invalid credentials" error
- Verify API Key and Secret are correct
- Check if API key was revoked in ShipStation

### Orders not appearing
- Check sync stats for fetched count
- Look at sync history for errors
- Check browser console for JS errors

### Duplicate orders
- Ensure migration was run (creates unique index)
- Check `external_id` column exists in orders table

---

## Database Changes

### New Table: `shipstation_sync_runs`
Tracks every sync with: timestamp, status, counts, errors

### New Columns on `orders`:
- `external_id` - ShipStation orderId (unique with platform)
- `platform` - 'shipstation' or null
- `order_total`, `product_name`, etc.

### New Columns on `app_settings`:
- `last_shipstation_sync`
- `last_shipstation_sync_attempt`
- `last_shipstation_sync_error`
