# Testing Guide

## Prerequisites

```bash
npm ci
npm run build
npm run start
```

Required environment variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_PASSWORD` (min 8 chars)
- `SESSION_SECRET` (min 32 chars)

---

## Phase 1: Build Verification

```bash
npm run build
```

**Expected:** Build completes with no errors. TypeScript type checking passes.

---

## Phase 2: Basic Functionality

### 2.1 Login Flow
1. Open http://localhost:3000
2. Should redirect to /admin which redirects to /login (if not authenticated)
3. Enter admin password
4. Should redirect to /admin dashboard
5. **Verify:** Dashboard loads with stats, recent orders, quick actions

### 2.2 Logout Flow
1. From any admin page, click "Logout" button in header
2. Should redirect to /login
3. Try to access /admin directly
4. **Verify:** Redirected back to /login

---

## Phase 3: Navigation Verification

### 3.1 Main Navigation (Desktop)
From dashboard, verify these are clickable in header:
- [ ] Dashboard → /admin
- [ ] Orders → /admin/orders
- [ ] Production → /admin/production
- [ ] Customers → /admin/customers
- [ ] Products → /admin/products
- [ ] "More" dropdown opens with:
  - [ ] Inventory → /admin/inventory
  - [ ] Reports → /admin/reports
  - [ ] Bulk Actions → /admin/bulk
- [ ] Settings → /admin/settings

### 3.2 Settings Sub-navigation
From /admin/settings, verify tabs:
- [ ] General (active by default)
- [ ] Users & Roles → /admin/users
- [ ] Audit Trail → /admin/audit

### 3.3 Quick Actions (+)
Click the "+" button, verify:
- [ ] New Order → /admin/orders/new
- [ ] Bulk Actions → /admin/bulk
- [ ] View Reports → /admin/reports

### 3.4 Mobile Navigation
1. Resize browser to mobile width (<1024px)
2. Click hamburger menu
3. **Verify:** All nav items visible including:
   - Dashboard, Orders, Production, Customers, Products
   - Inventory, Reports, Bulk Actions
   - Settings
   - Logout button at bottom

---

## Phase 4: Feature Flow Testing

### 4.1 Orders List
1. Go to /admin/orders
2. **Verify loading state:** Skeleton shows briefly
3. **Verify empty state:** If no orders, shows "No orders found" with icon
4. **Verify filters:** Status dropdown, search box, quick filter pills work
5. Click an order row → should go to order detail

### 4.2 Order Detail
1. Open any order detail (/admin/orders/[id])
2. **Verify:** Back button works
3. **Verify:** Customer info card shows
4. **Verify:** Status badge displays
5. **Verify:** "Send to Customer" button present
6. **Verify:** Copy Link button works (if proof link exists)

### 4.3 New Customer
1. Go to /admin/customers
2. Click "Add Customer"
3. Should go to /admin/customers/new
4. Fill form:
   - Name: Test Customer
   - Email: test@example.com (required)
   - Company: Test Co
5. Click "Create Customer"
6. **Verify:** Redirects to customers list
7. **Verify:** New customer appears in list

### 4.4 Production Board
1. Go to /admin/production
2. **Verify:** Kanban view shows 4 columns (Ready, In Production, QC, Ship)
3. Toggle to "List" view
4. **Verify:** Table displays
5. **Verify empty state:** If no approved orders, shows "No orders in production"

### 4.5 Settings
1. Go to /admin/settings
2. **Verify:** Form loads with current settings
3. Change company name
4. Click Save
5. Refresh page
6. **Verify:** Change persisted

---

## Phase 5: Customer Proof Portal

### 5.1 Valid Proof Link
1. Create an order with a proof (via admin)
2. Send proof to customer (generates magic link)
3. Open the /p/[token] link
4. **Verify:** Product info shows
5. **Verify:** Proof images display (if uploaded)
6. **Verify:** Decision buttons work (Approve, Approve with Notes, Request Changes)

### 5.2 Proof Submission
1. Select "Approve" decision
2. Click "Submit Decision"
3. **Verify:** Button shows spinner and "Submitting..."
4. **Verify:** Success screen shows after submission
5. Refresh the page
6. **Verify:** Still shows success screen (decision persisted)

### 5.3 Double-Submit Protection
1. Open a fresh proof link
2. Click "Submit Decision" rapidly multiple times
3. **Verify:** Only one submission occurs (button disables)

### 5.4 Changes Requested Flow
1. Open a fresh proof link
2. Select "Request Changes"
3. **Verify:** Text area appears with required indicator
4. Try to submit without notes
5. **Verify:** Button remains disabled
6. Enter notes and submit
7. **Verify:** Success screen shows "Changes Requested" message

### 5.5 Invalid/Expired Link
1. Open /p/invalidtoken123
2. **Verify:** 404 page shows
3. Open an expired link (if testable)
4. **Verify:** "Link Expired" message shows

---

## Phase 6: Error Handling

### 6.1 Admin Error Boundary
1. Temporarily break a page (e.g., invalid data)
2. Navigate to that page
3. **Verify:** Error boundary shows with:
   - Error message
   - "Try Again" button
   - "Go to Dashboard" button

### 6.2 Network Errors
1. Open browser DevTools → Network → Offline
2. Try to submit a form
3. **Verify:** Error message displays
4. Go back online
5. **Verify:** Can retry successfully

---

## Phase 7: Loading States

### 7.1 Dashboard Loading
1. Throttle network in DevTools (Slow 3G)
2. Navigate to /admin
3. **Verify:** Loading skeleton shows
4. **Verify:** Content replaces skeleton when loaded

### 7.2 Orders Loading
1. Throttle network
2. Navigate to /admin/orders
3. **Verify:** Loading skeleton shows

---

## Phase 8: Responsive Design

### 8.1 Mobile Viewport (375px)
Test these pages at mobile width:
- [ ] /login - Form centered, usable
- [ ] /admin - Stats stack vertically
- [ ] /admin/orders - Table scrolls horizontally
- [ ] /admin/production - Kanban columns stack or scroll
- [ ] /p/[token] - Decision buttons stack

### 8.2 Tablet Viewport (768px)
- [ ] Navigation still uses hamburger menu
- [ ] Content areas adapt appropriately

### 8.3 Desktop Viewport (1280px+)
- [ ] Full horizontal navigation visible
- [ ] All columns display

---

## Checklist Summary

### Critical Paths
- [ ] Login → Dashboard → Orders → Order Detail → Back
- [ ] Login → Customers → New Customer → Create → List
- [ ] Login → Production → Toggle views
- [ ] Login → Settings → Save changes
- [ ] Customer proof link → Submit decision → Success

### Navigation Reachability
- [ ] All main nav items accessible
- [ ] All "More" dropdown items accessible
- [ ] Settings sub-tabs accessible
- [ ] Quick actions work
- [ ] Logout works

### Error/Edge Cases
- [ ] Empty states show CTAs
- [ ] Errors display user-friendly messages
- [ ] Loading states prevent interaction issues
- [ ] Double-submit prevented

---

## Commands Reference

```bash
# Install dependencies
npm ci

# Run build (must pass)
npm run build

# Run production server
npm run start

# Run development server
npm run dev

# Type check only
npx tsc --noEmit
```
