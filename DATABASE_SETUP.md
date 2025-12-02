# Database Setup Guide

## ✅ Completed
- Supabase project credentials configured
- Mock data cleared from all components
- Components ready for database integration

## 📋 Next Steps: Database Tables to Create

### 1. **profiles** (Already exists from migration)
```sql
-- User profiles
id (uuid, references auth.users)
full_name (text)
email (text)
created_at (timestamp)
updated_at (timestamp)
```

### 2. **user_roles** (Already exists from migration)
```sql
-- User role assignments
id (uuid)
user_id (uuid, references profiles)
role (text: 'admin', 'tl', 'dsr')
created_at (timestamp)
```

### 3. **regions** (New - Create this)
```sql
CREATE TABLE regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### 4. **teams** (New - Create this)
```sql
CREATE TABLE teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tl_id uuid REFERENCES profiles(id),
  region_id uuid REFERENCES regions(id),
  captain_id uuid REFERENCES profiles(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### 5. **team_members** (New - Create this)
```sql
CREATE TABLE team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES teams(id),
  dsr_id uuid REFERENCES profiles(id),
  joined_at timestamp DEFAULT now()
);
```

### 6. **stock** (New - Create this)
```sql
CREATE TABLE stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_type text NOT NULL CHECK (stock_type IN ('DO', 'FS')),
  smartcard_number text NOT NULL UNIQUE,
  batch_number text,
  status text DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'in-hand', 'sold', 'rejected')),
  assigned_to uuid REFERENCES profiles(id),
  assigned_by uuid REFERENCES profiles(id),
  assigned_at timestamp,
  accepted_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### 7. **sales** (New - Create this)
```sql
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stock(id),
  dsr_id uuid REFERENCES profiles(id),
  stock_type text NOT NULL,
  smartcard_number text NOT NULL,
  package_type text CHECK (package_type IN ('Package', 'No Package')),
  amount numeric NOT NULL,
  payment_status text DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid')),
  notes text,
  sale_date timestamp DEFAULT now(),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

### 8. **stock_assignments** (New - Create this)
```sql
CREATE TABLE stock_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid REFERENCES stock(id),
  from_user_id uuid REFERENCES profiles(id),
  to_user_id uuid REFERENCES profiles(id),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  rejection_reason text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

## 🔐 Row Level Security (RLS) Policies

After creating tables, enable RLS and create policies:

```sql
-- Enable RLS on all tables
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_assignments ENABLE ROW LEVEL SECURITY;

-- Example policies (customize based on your needs)

-- Regions: Everyone can read
CREATE POLICY "Regions viewable by all authenticated users"
  ON regions FOR SELECT
  TO authenticated
  USING (true);

-- Stock: DSRs can view their own stock
CREATE POLICY "DSRs can view their assigned stock"
  ON stock FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

-- Sales: DSRs can insert their own sales
CREATE POLICY "DSRs can create sales"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (dsr_id = auth.uid());

-- Sales: Users can view their own sales
CREATE POLICY "Users can view their own sales"
  ON sales FOR SELECT
  TO authenticated
  USING (dsr_id = auth.uid());
```

## 📝 Component Integration Checklist

### Components Ready for Database Integration:

1. ✅ **DSRStock.tsx** - Needs to fetch from `stock` and `stock_assignments` tables
2. ✅ **DSRAddSale.tsx** - Needs to insert into `sales` table and update `stock` table
3. ✅ **DSRMySales.tsx** - Needs to fetch from `sales` table
4. ✅ **AdminDashboard.tsx** - Needs aggregated data from multiple tables
5. ✅ **TLDashboard.tsx** - Needs team and DSR data
6. ✅ **GeneralDashboard.tsx** - Needs company-wide metrics

## 🚀 How to Use

### 1. Create Tables in Supabase
- Go to your Supabase dashboard
- Navigate to SQL Editor
- Run the CREATE TABLE statements above

### 2. Set Up RLS Policies
- Enable Row Level Security on each table
- Create policies based on your security requirements

### 3. Update Components
Each component will need to:
- Import `supabase` client
- Use `useEffect` to fetch data
- Replace empty arrays with database queries
- Handle loading and error states

### Example Pattern:
```typescript
import { supabase } from '@/integrations/supabase/client';

const [sales, setSales] = useState<Sale[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  async function fetchSales() {
    const { data, error } = await supabase
      .from('sales')
      .select('*')
      .eq('dsr_id', user?.id)
      .order('sale_date', { ascending: false });
    
    if (data) setSales(data);
    setLoading(false);
  }
  
  fetchSales();
}, [user]);
```

## 📊 Current Status
- ✅ Environment variables configured
- ✅ Mock data removed
- ✅ Components prepared for database integration
- ⏳ Database tables need to be created
- ⏳ RLS policies need to be set up
- ⏳ Components need database queries added

## 🎯 Priority Order
1. Create core tables (regions, teams, stock, sales)
2. Enable RLS and create basic policies
3. Integrate DSR components (Stock, Add Sale, My Sales)
4. Integrate TL components
5. Integrate Admin components
6. Add real-time subscriptions for live updates
