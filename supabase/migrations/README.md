# Database Migration Guide

## 📋 Overview

Complete database schema for the Unit Sales Tracker application. This guide will help you set up a clean database from scratch.

## 🗂️ Migration Files

1. **00_master_schema.sql** - Core database schema (REQUIRED)
2. **01_commission_system.sql** - Commission tables and calculations (REQUIRED)
3. **02_seed_data.sql** - Sample data for testing (OPTIONAL)

## 📊 Database Structure

### Organizational Hierarchy
```
Zones (5 levels)
  └─ Regions (managed by RSM)
      └─ Territories (managed by TSM)
          └─ Team Leaders (TL)
              └─ Teams
                  └─ DSRs (Direct Sales Representatives)
```

### User Roles
- **Admin** - Full system access
- **Manager** - TSM (Territory Sales Manager) or RSM (Regional Sales Manager)
- **TL** - Team Leader (manages teams and DSRs)
- **DSR** - Direct Sales Representative (makes sales)
- **DE** - Distribution Executive (manages retail agents)

### Core Tables

#### Authentication & Users
- `profiles` - User profiles (extends Supabase auth.users)
- `user_roles` - Role assignments (supports multiple roles per user)

#### Organization
- `zones` - Highest level grouping
- `regions` - Geographic regions within zones
- `territories` - Territories within regions
- `team_leaders` - TL users with assigned regions/territories
- `teams` - Sales teams under TLs
- `dsrs` - DSR users assigned to teams

#### Stock Management
- `stock_batches` - Batch uploads
- `stock` - Individual stock items (FS/DO/DVS)
  - Status: unassigned → assigned-tl → assigned-team → assigned-dsr → sold-paid/sold-unpaid

#### Sales
- `sales` - DSR sales records with commission tracking

#### Commission System
- `commission_rates` - Product commission rates (upfront + activation)
- `dstv_packages` - DSTV package definitions
- `package_commission_rates` - Package-specific commissions
- `dsr_bonus_tiers` - Performance bonus tiers (9 levels: KURUTA to TANZANITE)

#### Managers
- `managers` - TSM/RSM users with zone/territory assignments

#### Distribution
- `distribution_executives` - DE users
- `agents` - Retail agents managed by DEs
- `agent_sales` - Agent sales records

#### System
- `notifications` - User notifications

## 🚀 Installation Steps

### Step 1: Prepare Supabase

1. Go to your Supabase project
2. Navigate to **SQL Editor**
3. Make sure your database is clean (or reset it)

### Step 2: Run Master Schema

1. Open `00_master_schema.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **RUN**
5. Wait for success message

**This creates:**
- ✅ 5 enums
- ✅ 15 core tables
- ✅ 40+ indexes
- ✅ RLS policies for all tables
- ✅ Helper functions
- ✅ Triggers for auto-profile creation

### Step 3: Run Commission System

1. Open `01_commission_system.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **RUN**
5. Wait for success message

**This creates:**
- ✅ 4 commission tables
- ✅ Default commission rates
- ✅ 5 DSTV packages
- ✅ Package commission rates
- ✅ 9 bonus tiers
- ✅ Auto-commission calculation trigger

### Step 4: Run Seed Data (Optional)

**Only for testing/development!**

1. Open `02_seed_data.sql`
2. Copy the entire contents
3. Paste into Supabase SQL Editor
4. Click **RUN**
5. Wait for success message

**This creates:**
- ✅ 5 sample zones
- ✅ 11 sample regions
- ✅ 17 sample territories

## 🔐 Default Commission Rates

### Product Commissions
| Product | Upfront | Activation | Total |
|---------|---------|------------|-------|
| DO      | 2,000   | 1,500      | 3,500 |
| FS      | 5,000   | 1,500      | 6,500 |

### Package Commissions
| Package      | Monthly Price | Commission |
|--------------|---------------|------------|
| PREMIUM      | 189,000       | 65,000     |
| COMPACT PLUS | 115,000       | 35,000     |
| COMPACT      | 70,000        | 15,000     |
| FAMILY       | 45,000        | 7,500      |
| ACCESS       | 27,500        | 2,750      |

### Bonus Tiers
| Tier      | Min Sales | Bonus    |
|-----------|-----------|----------|
| KURUTA    | 5         | 30,000   |
| BRONZE    | 10        | 75,000   |
| SILVER    | 15        | 125,000  |
| GOLD      | 20        | 200,000  |
| EMERALD   | 30        | 400,000  |
| RUBY      | 40        | 600,000  |
| SAPPHIRE  | 50        | 850,000  |
| DIAMOND   | 75        | 1,200,000|
| TANZANITE | 100       | 2,000,000|

## 🧪 Verification

After running migrations, verify your setup:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check enums
SELECT typname 
FROM pg_type 
WHERE typtype = 'e' 
ORDER BY typname;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check seed data (if you ran it)
SELECT 
  (SELECT COUNT(*) FROM zones) as zones,
  (SELECT COUNT(*) FROM regions) as regions,
  (SELECT COUNT(*) FROM territories) as territories,
  (SELECT COUNT(*) FROM commission_rates) as commission_rates,
  (SELECT COUNT(*) FROM dstv_packages) as packages,
  (SELECT COUNT(*) FROM dsr_bonus_tiers) as bonus_tiers;
```

## 📝 First Admin User

After migrations, create your first admin user:

1. Sign up through the app
2. User will be created with default 'dsr' role
3. Run this SQL to make them admin:

```sql
-- Get the user ID (check email)
SELECT id, email FROM auth.users;

-- Replace USER_ID with actual UUID
DELETE FROM public.user_roles WHERE user_id = 'USER_ID' AND role = 'dsr';
INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID', 'admin');
```

## 🔄 Updating Commission Rates

All commission rates can be updated through the Admin UI:
- Navigate to **Admin Dashboard** → **Commissions**
- Edit any rates, package prices, or bonus tiers
- Changes take effect immediately for new sales

## 🛠️ Troubleshooting

### Error: "relation already exists"
Your database is not clean. Either:
- Reset your Supabase project
- Or manually drop conflicting tables

### Error: "function does not exist"
Run migrations in order:
1. 00_master_schema.sql FIRST
2. 01_commission_system.sql SECOND
3. 02_seed_data.sql THIRD (optional)

### Error: "permission denied"
Check that:
- You're running SQL in Supabase dashboard
- You have project owner/admin access
- RLS policies are correctly set

### Sales commission not calculating
- Check that commission_rates table has data
- Verify the trigger exists: `calculate_sale_commission_trigger`
- Check logs in Supabase dashboard

## 📚 Next Steps

After successful migration:

1. ✅ Create your first admin user
2. ✅ Log in to the app
3. ✅ Create zones, regions, territories (or use seed data)
4. ✅ Create Team Leaders
5. ✅ Create teams and DSRs
6. ✅ Upload stock via Excel
7. ✅ Assign stock to TLs
8. ✅ Start tracking sales!

## 🆘 Support

If you encounter issues:
1. Check Supabase logs for detailed error messages
2. Verify all migration files ran successfully
3. Check that RLS is enabled on all tables
4. Ensure indexes were created

## 📄 License

Proprietary - Unit Sales Tracker Application
