# Security Fixes Applied

This document summarizes all security fixes applied to make the application production-ready.

## Summary

All **5 CRITICAL** and **8 HIGH** severity issues from the security audit have been addressed.

---

## CRITICAL Fixes

### CRIT-001: Admin Authentication for Pages ✅
**Issue:** No authentication on admin routes - all `/admin/*` pages were publicly accessible.

**Fix:**
- `app/admin/layout.tsx`: Added `getSession()` check with redirect to `/login` if not authenticated
- `app/login/page.tsx`: Created login page with password-based authentication
- `app/api/auth/login/route.ts`: Created login API with rate limiting
- `app/api/auth/logout/route.ts`: Created logout API that clears session cookie

**Implementation:**
- Session tokens are HMAC-signed with `SESSION_SECRET`
- Sessions stored in httpOnly, secure cookies
- 7-day session duration
- Rate limiting: 5 login attempts per 15 minutes

### CRIT-002: Admin Authentication for APIs ✅
**Issue:** All `/api/*` endpoints were unprotected.

**Fix:** Added `requireAdmin(request)` to ALL admin API routes:
- `app/api/orders/route.ts` (GET, POST)
- `app/api/admin/settings/route.ts` (GET, PUT)
- `app/api/admin/bulk-actions/route.ts` (POST)
- `app/api/proofs/send/route.ts` (POST)
- `app/api/proofs/upload/route.ts` (POST)
- `app/api/production/update/route.ts` (POST)
- `app/api/products/route.ts` (GET, POST)
- `app/api/products/[productId]/route.ts` (GET, PUT, DELETE)
- `app/api/notifications/route.ts` (GET, POST)
- `app/api/notifications/read-all/route.ts` (POST)
- `app/api/notifications/[notificationId]/read/route.ts` (POST)
- `app/api/job-costing/[orderId]/route.ts` (GET, PUT)
- `app/api/job-costing/[orderId]/calculate/route.ts` (POST)
- `app/api/search/route.ts` (GET)

### CRIT-003: Cron Endpoint Protection ✅
**Issue:** `/api/cron/reminders` was publicly accessible.

**Fix:**
- `app/api/cron/reminders/route.ts`: Added `requireCronAuth(request)` 
- Requires `Authorization: Bearer ${CRON_SECRET}` header
- Returns 401 with clear error message if unauthorized
- Vercel cron jobs automatically send the configured secret

### CRIT-004: Magic Link Token Security ✅
**Issue:** Tokens stored as plaintext in database.

**Fix:**
- `app/api/proofs/send/route.ts`: 
  - Generates random token with `crypto.randomBytes(32)`
  - Stores SHA-256 hash in database (`token_hash` column)
  - URL contains plaintext token; database stores only hash
  - Added `expires_at` (30 days from creation)
- `app/api/actions/submit/route.ts`:
  - Hashes incoming token before database lookup
  - Checks `expires_at` and returns 410 if expired
- `app/p/[token]/page.tsx`:
  - Validates token format before database query
  - Shows expired message for expired links

### CRIT-005: Service Key Protection ✅
**Issue:** `lib/supabase.ts` could expose service key to client.

**Fix:**
- `lib/supabase.ts`: Added runtime check that throws error if imported client-side
- Removed fallback to `NEXT_PUBLIC_*` environment variables
- Service key only accessible in server-side code

---

## HIGH Fixes

### HIGH-001 & HIGH-002: File Upload Validation ✅
**Issue:** No file type or size validation on uploads.

**Fix in `lib/validation.ts`:**
```typescript
export const ALLOWED_FILE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'
];
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_FILES_PER_UPLOAD = 20;
```

**Fix in `app/api/proofs/upload/route.ts`:**
- Validates all files BEFORE uploading any
- Rejects invalid MIME types with clear error
- Rejects files over 10MB
- Limits to 20 files per request

### HIGH-003: Upload Atomicity ✅
**Issue:** Failed uploads could leave orphaned records.

**Fix in `app/api/proofs/upload/route.ts`:**
- Added `rollbackUpload()` function
- On any failure: deletes uploaded files from storage, deletes version record
- Returns non-200 status with clear error message
- Wrapped in try/catch with rollback on unexpected errors

### HIGH-004: Notes Field Mismatch ✅
**Issue:** Client sent "notes" but API expected "note".

**Verification:** `app/p/[token]/ProofPortal.tsx` already sends `note` (line 38).
The validation schema in `lib/validation.ts` expects `note`.
No change needed - this was already correct.

### HIGH-005: Rate Limiting ✅
**Issue:** No rate limiting on sensitive endpoints.

**Fix in `lib/rate-limit.ts`:**
- Implemented in-memory rate limiter
- Different limits for different endpoint types:
  - Login: 5 attempts per 15 minutes
  - Customer submit: 10 per minute
  - Admin API: 60 per minute
  - Upload: 10 per minute
  - Search: 30 per minute

Applied to all API routes via `rateLimit(request, endpoint, config)`.

### HIGH-006: Settings Whitelist ✅
**Issue:** Settings API accepted arbitrary fields.

**Fix in `lib/validation.ts`:**
```typescript
export const updateSettingsSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  accent_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // ... other allowed fields
}).strict(); // Rejects unknown fields
```

**Fix in `app/api/admin/settings/route.ts`:**
- Uses Zod schema with `.strict()` to reject unknown fields
- Returns 400 with validation errors for invalid input

### HIGH-007: Email Validation ✅
**Issue:** No email validation on order creation.

**Fix in `lib/validation.ts`:**
```typescript
export const createOrderSchema = z.object({
  customer_email: z.string().email('Invalid email address'),
  // ... other fields
});
```

### HIGH-008: Search Input Sanitization ✅
**Issue:** SQL wildcards in user input could cause issues.

**Fix in `app/api/search/route.ts`:**
- Sanitizes query: `query.replace(/[%_\\]/g, '')`
- Validates length (2-200 characters)
- Added auth check (`requireAdmin`)
- Gracefully handles missing tables with try/catch

---

## Additional Fixes

### Window.location in Server Components ✅
**Issue:** Server components using `window.location`.

**Fixes:**
- `app/admin/page.tsx`: Created `DashboardTable.tsx` client component
- `app/admin/customers/page.tsx`: Changed to use `<Link>` instead of onClick handler

### Duplicate Directory ✅
**Issue:** Both `/app` and `/src/app` existed.

**Fix:** Removed `/src` directory (was empty/unused).

### Dashboard Query Optimization ✅
**Issue:** Dashboard fetched ALL orders without limit.

**Fix:** Added `.limit(500)` to dashboard query.

---

## Environment Variables Required

```bash
# Authentication (REQUIRED)
SESSION_SECRET=         # At least 32 characters
ADMIN_PASSWORD=         # At least 8 characters
CRON_SECRET=           # At least 16 characters

# Supabase (REQUIRED)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Email (OPTIONAL)
RESEND_API_KEY=

# Application (REQUIRED for email links)
APP_PUBLIC_BASE_URL=
```

---

## Behavior Changes

1. **Login Required:** All `/admin/*` routes now require authentication
2. **API Authentication:** All admin APIs return 401 if not authenticated
3. **Cron Protection:** `/api/cron/reminders` requires Bearer token
4. **Magic Link Expiration:** Links expire after 30 days
5. **File Upload Limits:** Max 10MB per file, only images and PDFs allowed
6. **Rate Limiting:** Login attempts limited to 5 per 15 minutes

---

## Testing Checklist

- [ ] Login with correct password → redirects to /admin
- [ ] Login with wrong password → shows error
- [ ] Access /admin without session → redirects to /login
- [ ] Logout → redirects to /login
- [ ] API call without session → returns 401
- [ ] Upload invalid file type → returns 400
- [ ] Upload >10MB file → returns 400
- [ ] Cron endpoint without token → returns 401
- [ ] Cron endpoint with valid token → succeeds
- [ ] Magic link after 30 days → shows expired message
- [ ] Settings with unknown field → returns 400 (rejected)
