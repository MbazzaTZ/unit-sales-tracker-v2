-- ============================================
-- ADD DISTRIBUTION EXECUTIVES (DE) AND AGENTS TABLES
-- ============================================

-- Create products table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  price DECIMAL(10, 2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for products
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(name);

-- Enable RLS for products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products (everyone can view, only admins can modify)
DROP POLICY IF EXISTS "Everyone can view products" ON public.products;
CREATE POLICY "Everyone can view products"
  ON public.products
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
  ON public.products
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
  ON public.products
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
  ON public.products
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Insert some default products
INSERT INTO public.products (name, category, price, description) VALUES
  ('DSTV Decoder', 'Hardware', 150000, 'Standard DSTV decoder'),
  ('GOtv Decoder', 'Hardware', 50000, 'Standard GOtv decoder'),
  ('DSTV Compact', 'Subscription', 85000, 'DSTV Compact monthly subscription'),
  ('DSTV Premium', 'Subscription', 165000, 'DSTV Premium monthly subscription'),
  ('GOtv Max', 'Subscription', 35000, 'GOtv Max monthly subscription')
ON CONFLICT DO NOTHING;

-- Create distribution_executives table (same level as TL)
CREATE TABLE IF NOT EXISTS public.distribution_executives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  territory TEXT NOT NULL,
  target DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create agents table (electronic dealers managed by DEs)
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  de_id UUID NOT NULL REFERENCES public.distribution_executives(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone_number TEXT,
  location TEXT,
  territory TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create agent_sales table (manually entered by DE)
CREATE TABLE IF NOT EXISTS public.agent_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  de_id UUID NOT NULL REFERENCES public.distribution_executives(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  sale_amount DECIMAL(10, 2) NOT NULL CHECK (sale_amount >= 0),
  sale_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_de_user_id ON public.distribution_executives(user_id);
CREATE INDEX IF NOT EXISTS idx_de_territory ON public.distribution_executives(territory);
CREATE INDEX IF NOT EXISTS idx_agents_de_id ON public.agents(de_id);
CREATE INDEX IF NOT EXISTS idx_agents_territory ON public.agents(territory);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_sales_agent_id ON public.agent_sales(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_sales_de_id ON public.agent_sales(de_id);
CREATE INDEX IF NOT EXISTS idx_agent_sales_product_id ON public.agent_sales(product_id);
CREATE INDEX IF NOT EXISTS idx_agent_sales_date ON public.agent_sales(sale_date);

-- Add comments
COMMENT ON TABLE public.distribution_executives IS 'Distribution Executives who manage agents/electronic dealers and manually enter their sales';
COMMENT ON TABLE public.agents IS 'Agents/Electronic dealers managed by Distribution Executives';
COMMENT ON TABLE public.agent_sales IS 'Sales manually entered by DEs on behalf of their agents';

-- Enable RLS
ALTER TABLE public.distribution_executives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sales ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES FOR DISTRIBUTION_EXECUTIVES
-- ============================================

DROP POLICY IF EXISTS "DEs can view their own record" ON public.distribution_executives;
CREATE POLICY "DEs can view their own record"
  ON public.distribution_executives
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all DEs" ON public.distribution_executives;
CREATE POLICY "Admins can view all DEs"
  ON public.distribution_executives
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert DEs" ON public.distribution_executives;
CREATE POLICY "Admins can insert DEs"
  ON public.distribution_executives
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update DEs" ON public.distribution_executives;
CREATE POLICY "Admins can update DEs"
  ON public.distribution_executives
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete DEs" ON public.distribution_executives;
CREATE POLICY "Admins can delete DEs"
  ON public.distribution_executives
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================
-- RLS POLICIES FOR AGENTS
-- ============================================

DROP POLICY IF EXISTS "DEs can view their agents" ON public.agents;
CREATE POLICY "DEs can view their agents"
  ON public.agents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agents.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all agents" ON public.agents;
CREATE POLICY "Admins can view all agents"
  ON public.agents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "DEs can insert their agents" ON public.agents;
CREATE POLICY "DEs can insert their agents"
  ON public.agents
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agents.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DEs can update their agents" ON public.agents;
CREATE POLICY "DEs can update their agents"
  ON public.agents
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agents.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DEs can delete their agents" ON public.agents;
CREATE POLICY "DEs can delete their agents"
  ON public.agents
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agents.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

-- ============================================
-- RLS POLICIES FOR AGENT_SALES
-- ============================================

DROP POLICY IF EXISTS "DEs can view their agent sales" ON public.agent_sales;
CREATE POLICY "DEs can view their agent sales"
  ON public.agent_sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agent_sales.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins can view all agent sales" ON public.agent_sales;
CREATE POLICY "Admins can view all agent sales"
  ON public.agent_sales
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "DEs can insert agent sales" ON public.agent_sales;
CREATE POLICY "DEs can insert agent sales"
  ON public.agent_sales
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agent_sales.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DEs can update their agent sales" ON public.agent_sales;
CREATE POLICY "DEs can update their agent sales"
  ON public.agent_sales
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agent_sales.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "DEs can delete their agent sales" ON public.agent_sales;
CREATE POLICY "DEs can delete their agent sales"
  ON public.agent_sales
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM distribution_executives
      WHERE distribution_executives.id = agent_sales.de_id
      AND distribution_executives.user_id = auth.uid()
    )
  );

-- Verification
SELECT 'Distribution Executives tables created' as status, 
  EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'distribution_executives') as de_exists,
  EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agents') as agents_exists,
  EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_sales') as agent_sales_exists;

SELECT '✅ Distribution Executives migration completed successfully!' as message;
