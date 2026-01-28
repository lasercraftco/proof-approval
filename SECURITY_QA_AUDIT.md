# Proof Approval App - Full Security & QA Audit

**Audit Date:** January 2025  
**Auditor Role:** Senior QA Engineer + Staff Software Engineer  
**App Stack:** Next.js 14, Supabase, Resend, Vercel  

---

## Executive Summary

This application has **critical security vulnerabilities** that must be fixed before production use. The most severe issue is the **complete absence of authentication** on all admin routes and API endpoints. Additionally, there are multiple data integrity issues, missing validations, and UX problems that will cause real customer issues.

**Verdict: NOT PRODUCTION READY**

---

## Table of Contents
1. [Critical Issues (Blockers)](#1-critical-issues-blockers)
2. [High Severity Issues](#2-high-severity-issues)
3. [Medium Severity Issues](#3-medium-severity-issues)
4. [Low Severity Issues](#4-low-severity-issues)
5. [Fix First List (Top 10)](#5-fix-first-list-top-10)
6. [Hardening Checklist](#6-hardening-checklist)
7. [Nice-to-Have Improvements](#7-nice-to-have-improvements)

---

## 1. Critical Issues (Blockers)

### CRIT-001: No Authentication on Admin Routes
- **Location:** `app/admin/layout.tsx` (lines 13-28)
- **What breaks:** ALL admin pages and ALL admin API routes are publicly accessible. Anyone can view/modify orders, settings, customer data.
- **How triggered:** Navigate directly to `/admin` - no login required
- **Severity:** 🔴 BLOCKER
- **Fix:**
```typescript
// app/admin/layout.tsx - Add auth check
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }) {
  const cookieStore = cookies();
  const session = cookieStore.get('admin_session');
  
  if (!session || !verifySession(session.value)) {
    redirect('/login');
  }
  // ... rest of layout
}
```

### CRIT-002: No Authentication on API Routes
- **Location:** ALL files in `app/api/` directory
- **What breaks:** Any attacker can:
  - Create/modify orders (`POST /api/orders`)
  - Change settings (`PUT /api/admin/settings`)
  - Upload files (`POST /api/proofs/upload`)
  - Mark orders approved (`POST /api/admin/bulk-actions`)
  - Access all customer data
- **How triggered:** Direct API calls with curl/Postman
- **Severity:** 🔴 BLOCKER
- **Fix:** Add authentication middleware to all `/api/admin/*` routes:
```typescript
// lib/auth.ts
export async function requireAdmin(request: NextRequest) {
  const session = request.cookies.get('admin_session');
  if (!session || !await verifySession(session.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null; // Proceed
}

// In each admin API route:
export async function POST(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;
  // ... rest of handler
}
```

### CRIT-003: Cron Endpoint Unprotected
- **Location:** `app/api/cron/reminders/route.ts` (lines 4-69)
- **What breaks:** Anyone can trigger reminder emails by hitting `/api/cron/reminders`
- **How triggered:** `GET /api/cron/reminders` - no auth
- **Severity:** 🔴 BLOCKER
- **Fix:**
```typescript
export async function GET(request: NextRequest) {
  // Verify Vercel cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // ... rest of handler
}
```
Also add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/reminders",
    "schedule": "0 9 */3 * *"
  }]
}
```
And set `CRON_SECRET` in Vercel environment variables.

### CRIT-004: Magic Link Token Stored Unhashed
- **Location:** `app/api/proofs/send/route.ts` (lines 43-47)
- **What breaks:** If database is compromised, all magic link tokens are exposed in plain text
- **Code:**
```typescript
// CURRENT - INSECURE:
token_hash: token, // Store unhashed for URL
```
- **How triggered:** Database breach exposes all tokens
- **Severity:** 🔴 BLOCKER
- **Fix:**
```typescript
// app/api/proofs/send/route.ts
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

await supabaseAdmin
  .from('magic_links')
  .upsert({
    order_id: orderId,
    token_hash: tokenHash, // Store HASH in DB
  });

// URL uses plaintext token: /p/{token}
// Verification hashes token and compares to stored hash
```
Then update `app/p/[token]/page.tsx`:
```typescript
const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
const { data: link } = await supabaseAdmin
  .from('magic_links')
  .select('order_id, expires_at')
  .eq('token_hash', hashedToken) // Compare hashes
  .single();
```

### CRIT-005: Service Key Exposed to Client Risk
- **Location:** `lib/supabase.ts` (lines 3-4)
- **What breaks:** If `SUPABASE_SERVICE_KEY` env var accidentally has `NEXT_PUBLIC_` prefix, it leaks to client
- **Current code:**
```typescript
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
```
- **Severity:** 🔴 BLOCKER
- **Fix:**
```typescript
// lib/supabase.ts
if (typeof window !== 'undefined') {
  throw new Error('supabaseAdmin cannot be imported on client side');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}
```

---

## 2. High Severity Issues

### HIGH-001: No File Type Validation on Upload
- **Location:** `app/api/proofs/upload/route.ts` (lines 46-61)
- **What breaks:** Users can upload any file type (executables, scripts, etc.)
- **How triggered:** Upload a `.exe` or `.html` file as a "proof"
- **Severity:** 🔴 HIGH
- **Fix:**
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

for (const file of files) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Invalid file type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `File too large: ${file.name}` }, { status: 400 });
  }
}
```

### HIGH-002: No File Size Limits
- **Location:** `app/api/proofs/upload/route.ts`
- **What breaks:** Users can upload arbitrarily large files, exhausting storage and bandwidth
- **How triggered:** Upload a 1GB file
- **Severity:** 🔴 HIGH
- **Fix:** See HIGH-001

### HIGH-003: Upload Errors Silently Ignored
- **Location:** `app/api/proofs/upload/route.ts` (lines 58-61)
- **What breaks:** If file upload fails, version is created but file is missing
- **Code:**
```typescript
if (uploadError) {
  console.error('Upload error:', uploadError);
  continue; // SILENTLY CONTINUES
}
```
- **Severity:** 🔴 HIGH
- **Fix:**
```typescript
const uploadResults = [];
for (const file of files) {
  const { error } = await supabaseAdmin.storage.from('proofs').upload(...);
  if (error) {
    // Rollback: delete the version we just created
    await supabaseAdmin.from('proof_versions').delete().eq('id', version.id);
    return NextResponse.json({ error: `Upload failed: ${file.name}` }, { status: 500 });
  }
  uploadResults.push(file.name);
}
```

### HIGH-004: Customer Submit Uses Wrong Field Name
- **Location:** `app/api/actions/submit/route.ts` (line 6) vs `app/p/[token]/ProofPortal.tsx` (line 38)
- **What breaks:** Customer notes are never saved
- **API expects:** `note`
- **Client sends:** `notes`
```typescript
// ProofPortal.tsx line 38:
body: JSON.stringify({ token, decision, notes }),  // SENDS 'notes'

// route.ts line 6:
const { token, decision, note } = await request.json(); // EXPECTS 'note'
```
- **Severity:** 🔴 HIGH
- **Fix:** Change client to send `note`:
```typescript
body: JSON.stringify({ token, decision, note: notes }),
```

### HIGH-005: Missing Rate Limiting
- **Location:** All API routes
- **What breaks:** No protection against brute force attacks on magic links, API abuse
- **How triggered:** Script to try thousands of tokens at `/p/{token}`
- **Severity:** 🔴 HIGH
- **Fix:** Add rate limiting middleware (use `@upstash/ratelimit` or similar):
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
});

// In API route:
const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
const { success } = await ratelimit.limit(ip);
if (!success) {
  return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
}
```

### HIGH-006: Settings API Accepts Any Fields
- **Location:** `app/api/admin/settings/route.ts` (lines 6-14)
- **What breaks:** Attacker can set arbitrary database columns
- **Code:**
```typescript
const { error } = await supabaseAdmin
  .from('app_settings')
  .update({
    ...body, // DANGEROUS: accepts any fields
    updated_at: new Date().toISOString(),
  })
```
- **Severity:** 🔴 HIGH
- **Fix:**
```typescript
const ALLOWED_FIELDS = ['company_name', 'accent_color', 'email_from_name', 
  'email_from_email', 'staff_notify_email', 'reminder_config', 'logo_data_url'];

const updates: Record<string, any> = { updated_at: new Date().toISOString() };
for (const field of ALLOWED_FIELDS) {
  if (body[field] !== undefined) {
    updates[field] = body[field];
  }
}
```

### HIGH-007: No Email Validation
- **Location:** `app/api/orders/route.ts` (line 39), `app/admin/orders/new/page.tsx`
- **What breaks:** Invalid emails accepted, proof links fail silently
- **Code:** Only checks `if (!customer_email)` - no format validation
- **Severity:** 🔴 HIGH
- **Fix:**
```typescript
import { z } from 'zod';

const orderSchema = z.object({
  order_number: z.string().min(1),
  customer_email: z.string().email(),
  customer_name: z.string().optional(),
  // ... other fields
});

const result = orderSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ error: result.error.issues }, { status: 400 });
}
```

### HIGH-008: Search API SQL Injection Risk
- **Location:** `app/api/search/route.ts` (lines 22-28)
- **What breaks:** Potential SQL injection via malformed search query
- **Code:**
```typescript
const searchTerm = `%${query}%`;
// ... used directly in .or() filter
.or(`order_number.ilike.${searchTerm},...`)
```
- **Severity:** 🔴 HIGH
- **Fix:** Supabase's `ilike` should escape, but sanitize input anyway:
```typescript
const sanitizedQuery = query.replace(/[%_]/g, ''); // Remove SQL wildcards from input
if (sanitizedQuery.length < 2) return NextResponse.json({ results: [] });
const searchTerm = `%${sanitizedQuery}%`;
```

---

## 3. Medium Severity Issues

### MED-001: No Magic Link Expiration
- **Location:** `app/p/[token]/page.tsx` (lines 17-19), Database schema
- **What breaks:** Magic links never expire (schema has optional `expires_at` but it's not set)
- **Code:**
```typescript
if (link.expires_at && new Date(link.expires_at) < new Date()) {
  return { expired: true };
}
// expires_at is never set in /api/proofs/send/route.ts
```
- **Severity:** 🟡 MEDIUM
- **Fix:** Set expiration when creating magic link:
```typescript
// app/api/proofs/send/route.ts
const expiresAt = new Date();
expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiration

await supabaseAdmin.from('magic_links').upsert({
  order_id: orderId,
  token_hash: tokenHash,
  expires_at: expiresAt.toISOString(),
});
```

### MED-002: No Proof Version Cleanup on Failed Upload
- **Location:** `app/api/proofs/upload/route.ts`
- **What breaks:** Empty proof versions left in database if all files fail to upload
- **Severity:** 🟡 MEDIUM
- **Fix:** Wrap in transaction or cleanup on failure (see HIGH-003)

### MED-003: Dashboard Fetches ALL Orders
- **Location:** `app/admin/page.tsx` (lines 12-15)
- **What breaks:** Dashboard will become slow with 10k+ orders
- **Code:**
```typescript
const { data: orders } = await supabaseAdmin
  .from('orders')
  .select('*')
  .order('created_at', { ascending: false });
// NO LIMIT!
```
- **Severity:** 🟡 MEDIUM
- **Fix:**
```typescript
const { data: orders } = await supabaseAdmin
  .from('orders')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1000); // Or use aggregation queries
```

### MED-004: Missing Empty/Error States in UI
- **Location:** Multiple components
- **What breaks:** Users see blank screens on errors or initial load
- **Affected files:**
  - `app/admin/customers/page.tsx` - no loading state
  - `app/admin/products/ProductsClient.tsx` - modal doesn't actually save products
  - `app/admin/reports/page.tsx` - unknown state
- **Severity:** 🟡 MEDIUM

### MED-005: Form Submission Errors Swallowed
- **Location:** `app/admin/orders/new/page.tsx` (lines 44-45)
- **What breaks:** User thinks order created but it failed
- **Code:**
```typescript
} catch {
  // handle error  <-- DOES NOTHING
}
```
- **Severity:** 🟡 MEDIUM
- **Fix:**
```typescript
} catch (err) {
  setError('Failed to create order. Please try again.');
}
// Add error state display in UI
```

### MED-006: No Server-Side Validation on Order Creation
- **Location:** `app/api/orders/route.ts` (lines 37-44)
- **What breaks:** Malformed data can be inserted
- **Missing validations:**
  - `order_number` max length
  - `customer_email` format
  - `quantity` must be positive
  - `sku` format/length
- **Severity:** 🟡 MEDIUM

### MED-007: Reminder Cron Doesn't Actually Send Emails
- **Location:** `app/api/cron/reminders/route.ts` (lines 41-59)
- **What breaks:** Reminders are "counted" but never sent
- **Code:** Updates `reminder_count` but doesn't call Resend
- **Severity:** 🟡 MEDIUM
- **Fix:** Add email sending logic similar to `/api/proofs/send`

### MED-008: Products Modal Doesn't Save
- **Location:** `app/admin/products/ProductsClient.tsx` (lines 106-145)
- **What breaks:** "Add Product" button does nothing
- **Code:** Modal has no submit handler, inputs not connected to state
- **Severity:** 🟡 MEDIUM
- **Fix:** Add form state and API call to create product

### MED-009: Quick Actions Buttons Non-Functional
- **Location:** `app/admin/orders/[orderId]/OrderDetail.tsx` (lines 342-359)
- **What breaks:** "Edit Order", "Send Reminder", "Delete Order" buttons do nothing
- **Code:** Buttons have no onClick handlers
- **Severity:** 🟡 MEDIUM

### MED-010: Search References Non-Existent Tables
- **Location:** `app/api/search/route.ts` (lines 44-67)
- **What breaks:** Search crashes or returns empty for customers/assets
- **Code:** Queries `customers` and `assets` tables that don't exist in main schema
- **Severity:** 🟡 MEDIUM
- **Fix:** Remove or conditionally handle missing tables:
```typescript
try {
  const { data: customers } = await supabaseAdmin
    .from('customers')
    .select(...)
} catch {
  // Table doesn't exist, skip
}
```

### MED-011: Duplicate Code Structure
- **Location:** `/app` and `/src/app` directories
- **What breaks:** Confusion about which code is actually being used
- **Severity:** 🟡 MEDIUM
- **Fix:** Remove `/src` directory - it appears to be old/duplicate code

### MED-012: Window.location Used in Server Component Context
- **Location:** `app/admin/customers/page.tsx` (line 46), `app/admin/page.tsx` (line 139)
- **What breaks:** `window.location.href` in table row onClick won't work on server
- **Code:**
```typescript
onClick={() => window.location.href = `/admin/customers/${c.id}`}
```
- **Severity:** 🟡 MEDIUM
- **Fix:** Use Next.js router or Link component

---

## 4. Low Severity Issues

### LOW-001: No Pagination on Orders List
- **Location:** `app/admin/orders/page.tsx` (line 11)
- **What breaks:** Performance degrades with many orders
- **Severity:** 🟢 LOW

### LOW-002: Hardcoded Limit Values
- **Location:** Various files
- **What breaks:** Inconsistent limits (100, 200, 500) across different pages
- **Affected:**
  - `app/admin/orders/page.tsx`: 500
  - `app/admin/customers/page.tsx`: 200
  - `app/admin/bulk/page.tsx`: 200
  - `app/api/orders/route.ts`: 100
- **Severity:** 🟢 LOW

### LOW-003: No Input Sanitization for XSS
- **Location:** Various places where user input is rendered
- **What breaks:** Potential XSS via customer name, product name, notes
- **Severity:** 🟢 LOW (React escapes by default, but audit needed)

### LOW-004: Missing Accessibility Attributes
- **Location:** Various UI components
- **What breaks:** Screen readers can't navigate properly
- **Missing:** aria-labels, roles, focus management
- **Severity:** 🟢 LOW

### LOW-005: No Logging/Monitoring
- **Location:** All API routes
- **What breaks:** Can't debug production issues
- **Severity:** 🟢 LOW
- **Fix:** Add structured logging (e.g., Pino, Winston)

### LOW-006: Bulk Actions "Send Reminders" Is Placeholder
- **Location:** `app/api/admin/bulk-actions/route.ts` (lines 15-17)
- **Code:**
```typescript
case 'send_reminders':
  // Just log for now - would send emails in production
  processed = orderIds.length;
  break;
```
- **Severity:** 🟢 LOW

### LOW-007: Toast Notification Race Condition
- **Location:** `app/admin/orders/[orderId]/OrderDetail.tsx` (lines 44-47)
- **What breaks:** Multiple toasts can overlap
- **Severity:** 🟢 LOW

### LOW-008: Color Contrast Issues
- **Location:** `app/globals.css`, various badge classes
- **What breaks:** Some status badges may not meet WCAG contrast requirements
- **Severity:** 🟢 LOW

### LOW-009: Missing TypeScript Strict Mode
- **Location:** `tsconfig.json`
- **What breaks:** Potential null/undefined errors at runtime
- **Severity:** 🟢 LOW
- **Fix:** Add `"strict": true` to tsconfig.json

### LOW-010: No Error Boundary
- **Location:** `app/layout.tsx`
- **What breaks:** Uncaught errors crash entire app
- **Severity:** 🟢 LOW
- **Fix:** Add React Error Boundary component

---

## 5. Fix First List (Top 10)

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | CRIT-001: Add admin authentication | 4-8 hrs | Critical |
| 2 | CRIT-002: Auth middleware for API routes | 2-4 hrs | Critical |
| 3 | CRIT-003: Protect cron endpoint | 30 min | Critical |
| 4 | CRIT-004: Hash magic link tokens | 1-2 hrs | Critical |
| 5 | HIGH-001/002: File validation + size limits | 1 hr | High |
| 6 | HIGH-004: Fix notes/note field mismatch | 10 min | High |
| 7 | HIGH-005: Add rate limiting | 2-4 hrs | High |
| 8 | HIGH-006: Whitelist settings fields | 30 min | High |
| 9 | HIGH-007: Add email validation | 30 min | High |
| 10 | MED-001: Add magic link expiration | 30 min | Medium |

**Estimated total for critical fixes: 2-3 days**

---

## 6. Hardening Checklist

Apply these patterns across the entire codebase:

### Authentication
- [ ] Add auth check to every `/admin/*` page
- [ ] Add auth middleware to every `/api/admin/*` route
- [ ] Add auth middleware to every `/api/proofs/*` route
- [ ] Add auth middleware to every `/api/orders/*` route
- [ ] Add auth to `/api/production/*` routes
- [ ] Protect cron endpoints with secret header

### Validation
- [ ] Use Zod schemas for ALL API request bodies
- [ ] Validate file types and sizes on upload
- [ ] Validate email formats
- [ ] Sanitize search inputs
- [ ] Whitelist allowed fields on update operations

### Error Handling
- [ ] Add try/catch to every async operation
- [ ] Return user-friendly error messages
- [ ] Log errors to monitoring service
- [ ] Add error boundaries to React components
- [ ] Show loading states during async operations

### Security
- [ ] Hash all tokens before storing
- [ ] Add expiration to magic links
- [ ] Implement rate limiting on all public endpoints
- [ ] Add CSRF protection
- [ ] Set secure cookie attributes
- [ ] Review Supabase RLS policies

### Performance
- [ ] Add pagination to all list views
- [ ] Limit query results
- [ ] Add indexes for common queries
- [ ] Cache settings data

---

## 7. Nice-to-Have Improvements

These are NOT blockers but would improve the product:

### UX Improvements
- Add keyboard shortcuts (already started with Cmd+K)
- Implement optimistic UI updates
- Add skeleton loading states
- Add confirmation dialogs for destructive actions
- Implement proper pagination with page numbers
- Add sort controls to tables
- Add batch select/deselect functionality

### Features
- Email template customization in settings
- Audit log viewer in admin
- Customer-facing order history
- Proof comparison view (version diff)
- Export orders to CSV
- Webhook integrations for external systems
- Dark mode support

### Technical Debt
- Remove duplicate `/src` directory
- Add unit tests for API routes
- Add E2E tests for critical flows
- Set up CI/CD pipeline
- Add TypeScript strict mode
- Add ESLint rules for security
- Add database migrations workflow

### Monitoring
- Add Sentry or similar error tracking
- Add performance monitoring (Vercel Analytics)
- Add uptime monitoring
- Set up alerts for failures

---

## Appendix: Files Reviewed

```
app/
├── admin/
│   ├── layout.tsx ✓
│   ├── page.tsx ✓
│   ├── orders/
│   │   ├── page.tsx ✓
│   │   ├── OrdersClient.tsx ✓
│   │   ├── [orderId]/
│   │   │   ├── page.tsx ✓
│   │   │   └── OrderDetail.tsx ✓
│   │   └── new/page.tsx ✓
│   ├── settings/
│   │   ├── page.tsx ✓
│   │   └── SettingsForm.tsx ✓
│   ├── customers/page.tsx ✓
│   ├── products/ProductsClient.tsx ✓
│   ├── production/page.tsx ✓
│   └── bulk/page.tsx ✓
├── api/
│   ├── orders/route.ts ✓
│   ├── proofs/
│   │   ├── upload/route.ts ✓
│   │   └── send/route.ts ✓
│   ├── actions/submit/route.ts ✓
│   ├── admin/
│   │   ├── settings/route.ts ✓
│   │   └── bulk-actions/route.ts ✓
│   ├── cron/reminders/route.ts ✓
│   ├── search/route.ts ✓
│   ├── notifications/route.ts ✓
│   ├── products/route.ts ✓
│   └── production/update/route.ts ✓
├── p/[token]/
│   ├── page.tsx ✓
│   └── ProofPortal.tsx ✓
├── layout.tsx ✓
└── page.tsx ✓

components/
├── AdminHeader.tsx ✓
├── GlobalSearch.tsx ✓
└── NotificationsCenter.tsx ✓

lib/
└── supabase.ts ✓

Configuration:
├── package.json ✓
├── vercel.json ✓
├── supabase_schema.sql ✓
└── supabase/migrations/*.sql ✓
```

---

**End of Audit Report**
