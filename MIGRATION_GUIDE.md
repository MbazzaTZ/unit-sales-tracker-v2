# 🚀 Quick Migration Guide

## Apply Database Migration to Supabase

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project: **Unit Sales Tracker**
3. Navigate to **SQL Editor** in the left sidebar

### Step 2: Copy Migration File
Location: `supabase/migrations/comprehensive_update.sql`

### Step 3: Execute Migration
1. Click "New Query" in SQL Editor
2. Paste the entire contents of `comprehensive_update.sql`
3. Click "Run" button (or press Ctrl+Enter)
4. Wait for completion (should take ~5-10 seconds)

### Step 4: Verify Migration Success
Run these verification queries:

```sql
-- Check new tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('dstv_packages', 'commission_rates', 'dsr_bonuses', 'notifications');

-- Verify DSTV packages inserted
SELECT package_code, package_name, monthly_price 
FROM dstv_packages 
ORDER BY monthly_price;

-- Check commission rates
SELECT product_type, upfront_amount, activation_amount, package_commission_rate 
FROM commission_rates;

-- Verify view created
SELECT * FROM dsr_earnings_view LIMIT 1;

-- Check triggers exist
SELECT trigger_name 
FROM information_schema.triggers 
WHERE trigger_schema = 'public' 
AND trigger_name IN ('trigger_calculate_commission', 'trigger_sale_notification', 'trigger_check_bonus');
```

### Expected Results:

#### Tables Created:
- ✅ dstv_packages (5 rows)
- ✅ commission_rates (3 rows)
- ✅ dsr_bonuses (0 rows initially)
- ✅ notifications (0 rows initially)

#### DSTV Packages:
```
ACCESS    | DStv Access        | 6,000
FAMILY    | DStv Family        | 25,000
COMPACT   | DStv Compact       | 42,000
COMPACT_+ | DStv Compact Plus  | 75,000
PREMIUM   | DStv Premium       | 105,000
```

#### Commission Rates:
```
FS  | 5,000 | 3,000 | 10.00%
DO  | 2,000 | 1,500 | 8.00%
DVS | 1,500 | 1,000 | 5.00%
```

#### Triggers:
- ✅ trigger_calculate_commission
- ✅ trigger_sale_notification
- ✅ trigger_check_bonus

### Step 5: Test the System
1. Login as DSR
2. Navigate to "Add Sale"
3. Create a test sale with package
4. Check notification appears
5. Verify earnings dashboard updates

### Troubleshooting

#### Error: "relation already exists"
- Tables might already exist from previous migration
- Safe to drop tables manually:
```sql
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS dsr_bonuses CASCADE;
DROP TABLE IF EXISTS commission_rates CASCADE;
DROP TABLE IF EXISTS dstv_packages CASCADE;
DROP TRIGGER IF EXISTS trigger_calculate_commission ON sales;
DROP TRIGGER IF EXISTS trigger_sale_notification ON sales;
DROP TRIGGER IF EXISTS trigger_check_bonus ON sales;
```
Then re-run migration.

#### Error: "permission denied"
- Ensure you're logged in as database owner
- Check RLS policies not blocking access

#### No notifications appearing
- Check trigger created successfully
- Verify real-time subscriptions enabled in Supabase dashboard
- Check browser console for subscription errors

### After Migration Success

1. **Commit summary file:**
```bash
git add COMPREHENSIVE_UPDATE_SUMMARY.md MIGRATION_GUIDE.md
git commit -m "docs: Add comprehensive update and migration documentation"
git push
```

2. **Deploy to Vercel** (automatic on git push)

3. **Announce to team:**
   - New DSTV package selection
   - Commission breakdown visible
   - Bonus system active (2 sales = TZS 10,000)
   - Real-time notifications enabled

---

## 🎉 You're Done!

The system is now upgraded with:
- ✅ DSTV Tanzania package catalog
- ✅ Automated commission calculations
- ✅ Real-time sale notifications
- ✅ Bonus tracking system
- ✅ Earnings analytics dashboard

DSRs will now see their earnings immediately after each sale!
