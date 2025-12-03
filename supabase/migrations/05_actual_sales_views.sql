-- Create views to calculate actual sales for each role hierarchy

-- 1. RSM Actual Sales (sum of all sales in their zone via regions)
CREATE OR REPLACE VIEW rsm_actual_sales AS
SELECT 
  m.id as rsm_id,
  m.user_id,
  m.zone_id,
  COALESCE(SUM(s.commission_amount), 0) as actual_sales
FROM 
  managers m
LEFT JOIN regions r ON r.zone_id = m.zone_id
LEFT JOIN sales s ON s.region_id = r.id 
  AND s.tl_verified = true
  AND s.admin_approved = true
  AND DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', CURRENT_DATE)
WHERE 
  m.manager_type = 'RSM'
GROUP BY 
  m.id, m.user_id, m.zone_id;

-- 2. TSM Actual Sales (sum of all TL and DE sales in their territories)
CREATE OR REPLACE VIEW tsm_actual_sales AS
SELECT 
  m.id as tsm_id,
  m.user_id,
  m.zone_id,
  m.territories,
  COALESCE(SUM(s.commission_amount), 0) as actual_sales
FROM 
  managers m
LEFT JOIN territories t ON t.id = ANY(
    -- Convert territory string format "zone_id-territory_name" to territory UUIDs
    SELECT ter.id 
    FROM territories ter 
    WHERE ter.region_id IN (
      SELECT r.id FROM regions r WHERE r.zone_id = m.zone_id
    )
  )
LEFT JOIN sales s ON s.region_id = t.region_id
  AND s.tl_verified = true
  AND s.admin_approved = true
  AND DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', CURRENT_DATE)
WHERE 
  m.manager_type = 'TSM'
GROUP BY 
  m.id, m.user_id, m.zone_id, m.territories;

-- 3. TL Actual Sales (sum of all team and DSR sales in their territory)
CREATE OR REPLACE VIEW tl_actual_sales AS
SELECT 
  tl.id as tl_id,
  tl.user_id,
  tl.territory_id,
  COALESCE(SUM(s.commission_amount), 0) as actual_sales
FROM 
  team_leaders tl
LEFT JOIN teams t ON t.tl_id = tl.id
LEFT JOIN dsrs d ON d.team_id = t.id
LEFT JOIN sales s ON s.dsr_id = d.id
  AND s.tl_verified = true
  AND s.admin_approved = true
  AND DATE_TRUNC('month', s.created_at) = DATE_TRUNC('month', CURRENT_DATE)
WHERE 
  tl.territory_id IS NOT NULL
GROUP BY 
  tl.id, tl.user_id, tl.territory_id;

-- 4. DE Actual Sales (sum of all agent sales in their territory)
CREATE OR REPLACE VIEW de_actual_sales AS
SELECT 
  de.id as de_id,
  de.user_id,
  de.zone_id,
  de.territory_id,
  COALESCE(SUM(ags.sale_amount), 0) as actual_sales
FROM 
  distribution_executives de
LEFT JOIN agents ag ON ag.de_id = de.id
LEFT JOIN agent_sales ags ON ags.agent_id = ag.id
  AND DATE_TRUNC('month', ags.sale_date) = DATE_TRUNC('month', CURRENT_DATE)
GROUP BY 
  de.id, de.user_id, de.zone_id, de.territory_id;

-- Create function to get manager with actual sales
CREATE OR REPLACE FUNCTION get_managers_with_sales()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  manager_type manager_type,
  zone_id UUID,
  territories TEXT[],
  monthly_target DECIMAL(12, 2),
  actual_sales DECIMAL(12, 2),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.user_id,
    m.manager_type,
    m.zone_id,
    m.territories,
    m.monthly_target,
    CASE 
      WHEN m.manager_type = 'RSM' THEN COALESCE(rsm.actual_sales, 0)
      WHEN m.manager_type = 'TSM' THEN COALESCE(tsm.actual_sales, 0)
      ELSE 0
    END as actual_sales,
    m.created_at
  FROM 
    managers m
  LEFT JOIN rsm_actual_sales rsm ON rsm.rsm_id = m.id AND m.manager_type = 'RSM'
  LEFT JOIN tsm_actual_sales tsm ON tsm.tsm_id = m.id AND m.manager_type = 'TSM';
END;
$$ LANGUAGE plpgsql;

-- Create function to get TLs with actual sales
CREATE OR REPLACE FUNCTION get_tls_with_sales()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  region_id UUID,
  territory_id UUID,
  monthly_target DECIMAL(12, 2),
  actual_sales DECIMAL(12, 2),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tl.id,
    tl.user_id,
    tl.region_id,
    tl.territory_id,
    tl.monthly_target,
    COALESCE(tls.actual_sales, 0) as actual_sales,
    tl.created_at
  FROM 
    team_leaders tl
  LEFT JOIN tl_actual_sales tls ON tls.tl_id = tl.id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get DEs with actual sales
CREATE OR REPLACE FUNCTION get_des_with_sales()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  zone_id UUID,
  territory_id TEXT,
  monthly_target DECIMAL(12, 2),
  actual_sales DECIMAL(12, 2),
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    de.id,
    de.user_id,
    de.zone_id,
    de.territory_id,
    de.monthly_target,
    COALESCE(des.actual_sales, 0) as actual_sales,
    de.created_at
  FROM 
    distribution_executives de
  LEFT JOIN de_actual_sales des ON des.de_id = de.id;
END;
$$ LANGUAGE plpgsql;
