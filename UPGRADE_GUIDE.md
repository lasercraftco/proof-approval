# Upgrade Guide: MVP → Enhanced Version

This guide helps you upgrade from the original MVP to the enhanced version with all new features.

## ⚠️ Before You Start

1. **Backup your Supabase database** (Project Settings → Database → Create backup)
2. **Test in a staging environment** if possible
3. **Note your current settings** from the Settings page

## 🔄 Upgrade Steps

### Step 1: Database Migration

Run the migration SQL in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of: supabase/sql/002_reminder_config.sql
-- This adds the new fields needed for enhanced features

-- Add reminder tracking columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reminder_sent_at timestamptz;

-- Add reminder configuration to app_settings
ALTER TABLE app_settings 
ADD COLUMN IF NOT EXISTS reminder_config jsonb NOT NULL DEFAULT '{"enabled": true, "first_reminder_days": 3, "second_reminder_days": 7, "max_reminders": 2}'::jsonb;

-- Update existing settings row with reminder config if it doesn't have it
UPDATE app_settings 
SET reminder_config = '{"enabled": true, "first_reminder_days": 3, "second_reminder_days": 7, "max_reminders": 2}'::jsonb
WHERE id = 'default' AND reminder_config IS NULL;
```

**Verify**: After running, check that:
- `orders` table has `reminder_count` and `last_reminder_sent_at` columns
- `app_settings` table has `reminder_config` column

### Step 2: Deploy New Code

#### Option A: Vercel (Recommended)
1. Push code to your GitHub repository
2. Vercel will auto-deploy
3. Wait for deployment to complete
4. Check deployment logs for any errors

#### Option B: Manual Deployment
1. Build the application: `npm run build`
2. Deploy build files to your hosting platform
3. Ensure environment variables are set

### Step 3: Verify Installation

Visit these URLs to confirm everything works:

1. **Dashboard**: `https://your-domain.com/admin`
   - Should show analytics dashboard
   - Check that statistics load correctly

2. **Audit Trail**: `https://your-domain.com/admin/audit`
   - Should show existing events (if any)
   - No errors in console

3. **Bulk Operations**: `https://your-domain.com/admin/bulk`
   - Should show your orders with checkboxes
   - Try selecting an order (don't execute yet)

4. **Settings**: `https://your-domain.com/admin/settings`
   - Should show new "Automatic Reminders" section
   - Configure reminder settings

### Step 4: Configure New Features

#### Configure Reminders
1. Go to **Admin → Settings**
2. Scroll to **Automatic Reminders**
3. Set your preferred schedule:
   - First reminder: 3-7 days (default: 3)
   - Second reminder: 7-14 days (default: 7)
   - Max reminders: 1-5 (default: 2)
4. Click **Save settings**

#### Update Cron Job (If using Vercel Cron)
Update `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/reminders",
    "schedule": "0 9 * * *"
  }]
}
```
This runs daily at 9 AM.

#### Test Email Notifications
1. Create a test order
2. Upload a proof
3. Send proof to a test email (your email)
4. Approve/reject the proof
5. Check that:
   - Customer receives confirmation email
   - Staff receives notification email
   - Both emails look correct

### Step 5: Train Your Team

#### New Admin Features
1. **Dashboard**: First stop for daily overview
2. **Bulk Operations**: For processing multiple orders
3. **Audit Trail**: For tracking and compliance
4. **Version Comparison**: For reviewing proof changes

#### New Workflows
1. **Daily Check**: Visit dashboard to see pending orders
2. **Weekly Review**: Use audit trail to review activity
3. **Bulk Reminders**: Use bulk page to send reminders
4. **Version Review**: Use comparison when customer requests changes

## 🆕 What's New

### You Now Have:

✅ **Dashboard** with real-time analytics  
✅ **Automated email confirmations** to customers  
✅ **Configurable reminder system**  
✅ **Bulk operations** for efficiency  
✅ **Complete audit trail** for compliance  
✅ **Version comparison** tool  
✅ **Enhanced settings** with reminder config  

### Breaking Changes

⚠️ **None!** This upgrade is fully backward compatible.

- All existing data is preserved
- All existing features work the same
- New features are additive only
- Old URLs still work

## 🐛 Troubleshooting

### Issue: Migration SQL fails

**Solution**: 
- Check you're running it in the correct Supabase project
- Ensure you have sufficient permissions
- Try running each statement separately

### Issue: Dashboard shows errors

**Solution**:
- Check browser console for errors
- Verify migration completed successfully
- Check that `orders` table has new columns

### Issue: Reminders not sending

**Solution**:
- Check reminder config in Settings
- Ensure "enabled" is checked
- Verify cron job is running
- Check Resend API key is valid
- Test with `/api/cron/reminders` manually

### Issue: Email notifications not working

**Solution**:
- Check Resend API key in environment variables
- Verify email templates in Settings
- Check email addresses are valid
- Look for errors in deployment logs

### Issue: Bulk operations fail

**Solution**:
- Check browser console for errors
- Verify you selected at least one order
- Check network tab for API errors
- Try with fewer orders first

## 📊 Post-Upgrade Checklist

- [ ] Database migration completed successfully
- [ ] New code deployed without errors
- [ ] Dashboard loads and shows correct data
- [ ] Audit trail accessible and showing events
- [ ] Bulk operations page works
- [ ] Settings page shows reminder configuration
- [ ] Reminder settings configured and saved
- [ ] Test email sent and received correctly
- [ ] Customer confirmation emails working
- [ ] Staff notification emails working
- [ ] Version comparison works (if you have 2+ versions)
- [ ] Cron job configured for reminders
- [ ] Team trained on new features

## 🎓 Best Practices

### Dashboard
- Check daily for "Needs Attention" orders
- Monitor approval rate trends
- Track average response time

### Reminders
- Start conservative (3 and 7 days)
- Adjust based on your customer response patterns
- Monitor reminder effectiveness in audit trail

### Bulk Operations
- Use for weekly cleanup
- Send reminders in batches
- Export data regularly for records

### Audit Trail
- Review weekly for unusual activity
- Export monthly for compliance
- Filter by order for customer inquiries

## 📞 Need Help?

1. Check the updated README.md for documentation
2. Review CHANGELOG.md for feature details
3. Check audit trail for system events
4. Review browser console for errors

## 🎉 You're All Set!

Your proof approval system now has enterprise-grade features:
- Better visibility with analytics
- Automation with reminders
- Efficiency with bulk operations
- Compliance with audit trail
- Better customer communication

Enjoy the enhanced system!
