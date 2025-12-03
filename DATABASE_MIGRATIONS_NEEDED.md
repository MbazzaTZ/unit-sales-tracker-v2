# Database Migration Instructions

## Important: Run these migrations in Supabase SQL Editor

You need to run the following SQL migration files in your Supabase project to enable target and sales tracking:

### 1. Add Target Columns (04_add_targets.sql)
This migration adds target tracking columns to managers, team_leaders, and distribution_executives tables.

**File location:** `supabase/migrations/04_add_targets.sql`

**What it does:**
- Adds `monthly_target` column to managers table
- Adds `monthly_target` column to team_leaders table  
- Adds `monthly_target` column to distribution_executives table
- Adds tracking columns for when targets were updated and by whom
- Creates indexes for faster queries

### 2. Create Sales Calculation Views (05_actual_sales_views.sql)
This migration creates views and functions to automatically calculate actual sales for each role.

**File location:** `supabase/migrations/05_actual_sales_views.sql`

**What it does:**
- Creates `rsm_actual_sales` view - calculates RSM sales as sum of all verified sales in their zone
- Creates `tsm_actual_sales` view - calculates TSM sales as sum of all verified sales in their territories
- Creates `tl_actual_sales` view - calculates TL sales as sum of all DSR sales in their territory
- Creates `de_actual_sales` view - calculates DE sales as sum of all agent sales
- Creates helper functions: `get_managers_with_sales()`, `get_tls_with_sales()`, `get_des_with_sales()`

## How to Apply Migrations

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Open and run `04_add_targets.sql` first
5. Then open and run `05_actual_sales_views.sql`

## Sales Hierarchy

The system now tracks sales based on this hierarchy:

- **RSM (Regional Sales Manager)**: Actual sales = Sum of all verified sales in their zone
- **TSM (Territory Sales Manager)**: Actual sales = Sum of all verified sales in their assigned territories (by TLs and DEs)
- **TL (Team Leader)**: Actual sales = Sum of all verified sales by their team's DSRs in their territory
- **DE (Distribution Executive)**: Actual sales = Sum of all agent sales in their territory

## New Features Added

### RSM Management Page
- Set monthly sales target for each RSM
- View actual sales (automatically calculated from zone sales)
- Target vs actual comparison

### TSM Management Page
- Set monthly sales target for each TSM
- View actual sales (automatically calculated from territory sales)
- **Territory selection now shows only vacant territories** (territories not assigned to other TSMs)
- Target vs actual comparison

### TL Management Page
- Set/edit monthly sales target for each TL
- View actual sales (automatically calculated from DSR sales)
- Target vs actual comparison

### DE Management Page
- View monthly sales target for each DE
- View actual sales (automatically calculated from agent sales)
- Target vs actual comparison

## Territory Assignment Logic

When creating a TSM:
1. Admin selects a zone
2. System shows only **vacant territories** in that zone
3. Vacant = territories not currently assigned to any other TSM in that zone
4. TSM can select 1-2 vacant territories
5. This prevents territory conflicts and ensures proper management structure
