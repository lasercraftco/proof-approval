# Feature Reachability Map

This document maps every major feature to its UI access path.

---

## Admin Features

| Feature | URL | How to Reach |
|---------|-----|--------------|
| Dashboard | /admin | Header → Dashboard |
| Orders List | /admin/orders | Header → Orders |
| Order Detail | /admin/orders/[id] | Orders List → Click row |
| New Order | /admin/orders/new | Orders → "New Order" button, OR Quick Actions (+) → New Order |
| Production Board | /admin/production | Header → Production |
| Customers List | /admin/customers | Header → Customers |
| New Customer | /admin/customers/new | Customers → "Add Customer" button |
| Products | /admin/products | Header → Products |
| Inventory | /admin/inventory | Header → More → Inventory |
| Reports | /admin/reports | Header → More → Reports, OR Quick Actions (+) → View Reports |
| Bulk Actions | /admin/bulk | Header → More → Bulk Actions, OR Dashboard Quick Actions, OR Quick Actions (+) |
| Settings | /admin/settings | Header → Settings |
| Users & Roles | /admin/users | Settings → "Users & Roles" tab |
| Audit Trail | /admin/audit | Settings → "Audit Trail" tab |
| Assets | /admin/assets | *Not in main nav* - Direct URL only |

---

## Customer Features

| Feature | URL | How to Reach |
|---------|-----|--------------|
| Proof Portal | /p/[token] | Email link sent by admin |
| Proof Review | /p/[token] | Direct link |
| Submit Decision | /p/[token] | Proof Portal → Select decision → Submit |

---

## Quick Access Points

### Header Navigation (Desktop)
```
[Logo] [Dashboard] [Orders] [Production] [Customers] [Products] [More ▾] [Settings] [🔍] [🔔] [+] [Logout]
```

### "More" Dropdown
- Inventory
- Reports  
- Bulk Actions

### Quick Actions (+) Dropdown
- New Order
- Bulk Actions
- View Reports

### Dashboard Quick Actions Panel
- Create Order → /admin/orders/new
- Bulk Actions → /admin/bulk
- View Reports → /admin/reports

---

## Click Depth Analysis

| Feature | Clicks from Dashboard |
|---------|----------------------|
| Orders List | 1 |
| New Order | 1 |
| Order Detail | 2 (Orders → Row) |
| Production | 1 |
| Customers | 1 |
| New Customer | 2 (Customers → Add) |
| Products | 1 |
| Inventory | 2 (More → Inventory) |
| Reports | 2 (More → Reports) OR 1 via Quick Actions |
| Bulk Actions | 2 (More → Bulk) OR 1 via Dashboard/Quick Actions |
| Settings | 1 |
| Users | 2 (Settings → Tab) |
| Audit | 2 (Settings → Tab) |
| Logout | 1 |

---

## Mobile Navigation

On screens < 1024px, hamburger menu shows:
1. Dashboard
2. Orders
3. Production
4. Customers
5. Products
6. Inventory
7. Reports
8. Bulk Actions
9. Settings
10. --- (divider)
11. Logout

---

## Contextual Links

### From Dashboard
- Stats cards link to filtered orders
- "View all →" links to orders list
- "Needs Attention" items link to order details
- Status breakdown links to filtered orders

### From Order Detail
- Back arrow → Orders list
- Customer email → mailto link
- Copy Link → Clipboard
- Edit Order → (placeholder)
- Send Reminder → (placeholder)
- Delete Order → (placeholder)

### From Settings
- Tab navigation to Users and Audit

---

## Features NOT in Navigation

These features exist but require direct URL access:

| Feature | URL | Recommended Action |
|---------|-----|-------------------|
| Assets | /admin/assets | Could add to "More" dropdown if needed |

---

## Empty State CTAs

When data is empty, these pages show action buttons:

| Page | Empty State CTA |
|------|-----------------|
| Orders | N/A (shows "No orders found") |
| Customers | "Add Customer" button |
| Products | Depends on implementation |
| Production | "No orders in production" (informational) |
| Assets | "Upload" button |
