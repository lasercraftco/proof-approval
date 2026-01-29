# The Lasercraft Company Proof Approval (Enhanced)

This is a white-label proof approval app with advanced features for managing customer proofs efficiently. 

## Features

### Core Features
- **Customer Proof Portal**: Secure magic-link access for customers to review and approve proofs
- **Watermarked Previews**: All customer-facing previews are watermarked for protection
- **Version Management**: Track multiple proof versions with notes
- **Status Tracking**: Complete order lifecycle management (draft → open → proof_sent → approved/rejected)

### New Enhanced Features ✨

#### 1. **Dashboard Analytics**
- Real-time statistics on order performance
- Approval rates and pending counts
- Average response time tracking
- Status breakdown visualization
- Quick access to orders needing attention

#### 2. **Automated Email Notifications**
- Customer confirmation emails on approval/rejection
- Staff notifications with direct admin links
- Customizable email templates
- Template variables for personalization

#### 3. **Configurable Reminder System**
- Automatic reminder emails based on configurable schedule
- Default: First reminder at 3 days, second at 7 days
- Maximum reminder limit per order
- Tracks reminder count and timestamps
- Can be enabled/disabled in settings

#### 4. **Bulk Operations**
- Select multiple orders for batch processing
- Bulk actions: Send reminders, update status, delete
- Export selected orders to CSV
- Audit logging for all bulk actions

#### 5. **Complete Audit Trail**
- Full history of all system events
- Track customer, staff, and system actions
- Filter by order or date
- Export audit logs to CSV
- IP address and user agent tracking

#### 6. **Version Comparison**
- Side-by-side comparison of proof versions
- Visual diff for images
- View staff notes for each version
- Available in admin interface

#### 7. **Enhanced Settings**
- Reminder configuration (timing, frequency)
- Email template customization
- Branding and logo management
- Staff notification preferences

## Routes

* `/admin` - Dashboard with analytics
* `/admin/orders` - Order management
* `/admin/orders/[id]` - Order details
* `/admin/orders/[id]/compare` - Version comparison
* `/admin/bulk` - Bulk operations
* `/admin/audit` - Audit trail viewer
* `/admin/settings` - Configuration
* `/p/[token]` - Customer magic link

## Setup

### One-time Supabase Setup

1. **Initial Schema**  
   Supabase Dashboard → **SQL Editor** → New query  
   Paste the contents of `supabase_schema.sql` and run

2. **Or Migration (if upgrading)**  
   If you already have the old schema:
   - Run `supabase/sql/002_reminder_config.sql` to add new fields

### Environment Variables

Required in your `.env` or deployment environment:

```env
# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key

# Email (Resend)
RESEND_API_KEY=your_resend_key

# Admin Auth
ADMIN_PASSWORD=your_secure_password

# App Config
APP_PUBLIC_BASE_URL=https://your-domain.com
COMPANY_NAME=Your Company Name
```

## Automated Reminders

Set up a cron job or Vercel Cron to call:
```
GET /api/cron/reminders
```

Recommended: Run daily or every 12 hours

Configure reminder timing in Admin → Settings → Automatic Reminders

## Email Templates

All email templates are customizable in Admin → Settings. Available variables:

- `{order_number}` - Order number
- `{customer_name}` - Customer name
- `{customer_email}` - Customer email
- `{proof_link}` - Magic link URL
- `{company_name}` - Your company name
- `{customer_note}` - Customer feedback
- `{admin_link}` - Admin order URL
- `{decision}` - Customer decision (approved/changes/etc)

## Database Schema Updates

The enhanced version adds:
- `orders.reminder_count` - Track number of reminders sent
- `orders.last_reminder_sent_at` - Timestamp of last reminder
- `app_settings.reminder_config` - Reminder configuration JSON

## Notes

* Customers only see watermarked previews
* Downloads are watermarked-only
* All actions are logged in audit trail
* Bulk operations include safety confirmations
* Version comparison requires 2+ versions

## Support

For issues or questions, check:
- Diagnostics page for system health
- Audit trail for action history
- Settings for configuration options
