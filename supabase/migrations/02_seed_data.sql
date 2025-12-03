-- ============================================
-- SEED DATA - TEST DATA FOR DEVELOPMENT
-- ============================================
-- Run this AFTER 00_master_schema.sql and 01_commission_system.sql
-- This is OPTIONAL - only for testing/development
-- Creates sample zones, regions, territories
-- ============================================

-- ============================================
-- STEP 1: CREATE SAMPLE ZONES
-- ============================================

INSERT INTO public.zones (name, code, zonal_manager) VALUES
('Northern Zone', 'NZ', 'John Mbwana'),
('Southern Zone', 'SZ', 'Grace Mwakasege'),
('Central Zone', 'CZ', 'Daniel Mtaki'),
('Eastern Zone', 'EZ', 'Sarah Ndege'),
('Western Zone', 'WZ', 'Peter Kimaro')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- STEP 2: CREATE SAMPLE REGIONS
-- ============================================

-- Get zone IDs
DO $$
DECLARE
  v_nz_id UUID;
  v_sz_id UUID;
  v_cz_id UUID;
  v_ez_id UUID;
  v_wz_id UUID;
BEGIN
  SELECT id INTO v_nz_id FROM public.zones WHERE code = 'NZ';
  SELECT id INTO v_sz_id FROM public.zones WHERE code = 'SZ';
  SELECT id INTO v_cz_id FROM public.zones WHERE code = 'CZ';
  SELECT id INTO v_ez_id FROM public.zones WHERE code = 'EZ';
  SELECT id INTO v_wz_id FROM public.zones WHERE code = 'WZ';

  -- Northern Zone Regions
  INSERT INTO public.regions (name, code, zone_id, rsm_name) VALUES
  ('Arusha Region', 'AR', v_nz_id, 'Aisha Musa'),
  ('Kilimanjaro Region', 'KR', v_nz_id, 'Moses Kihila'),
  ('Manyara Region', 'MR', v_nz_id, 'Fatuma Hassan')
  ON CONFLICT (code) DO NOTHING;

  -- Southern Zone Regions
  INSERT INTO public.regions (name, code, zone_id, rsm_name) VALUES
  ('Mbeya Region', 'MB', v_sz_id, 'Emmanuel Lyimo'),
  ('Ruvuma Region', 'RV', v_sz_id, 'Joyce Komba')
  ON CONFLICT (code) DO NOTHING;

  -- Central Zone Regions
  INSERT INTO public.regions (name, code, zone_id, rsm_name) VALUES
  ('Dodoma Region', 'DD', v_cz_id, 'Joseph Massawe'),
  ('Singida Region', 'SG', v_cz_id, 'Mary Shayo')
  ON CONFLICT (code) DO NOTHING;

  -- Eastern Zone Regions
  INSERT INTO public.regions (name, code, zone_id, rsm_name) VALUES
  ('Dar es Salaam', 'DSM', v_ez_id, 'Hassan Bakari'),
  ('Pwani Region', 'PW', v_ez_id, 'Neema Makwaya')
  ON CONFLICT (code) DO NOTHING;

  -- Western Zone Regions
  INSERT INTO public.regions (name, code, zone_id, rsm_name) VALUES
  ('Kigoma Region', 'KG', v_wz_id, 'David Mwita'),
  ('Tabora Region', 'TB', v_wz_id, 'Anna Mazengo')
  ON CONFLICT (code) DO NOTHING;
END $$;

-- ============================================
-- STEP 3: CREATE SAMPLE TERRITORIES
-- ============================================

DO $$
DECLARE
  v_region_id UUID;
BEGIN
  -- Arusha Region Territories
  SELECT id INTO v_region_id FROM public.regions WHERE code = 'AR';
  IF v_region_id IS NOT NULL THEN
    INSERT INTO public.territories (name, code, region_id, tsm_name) VALUES
    ('Arusha Central', 'AR-C', v_region_id, 'Frank Mollel'),
    ('Arusha East', 'AR-E', v_region_id, 'Lucy Ngowi'),
    ('Arusha West', 'AR-W', v_region_id, 'George Samwel')
    ON CONFLICT (region_id, code) DO NOTHING;
  END IF;

  -- Kilimanjaro Region Territories
  SELECT id INTO v_region_id FROM public.regions WHERE code = 'KR';
  IF v_region_id IS NOT NULL THEN
    INSERT INTO public.territories (name, code, region_id, tsm_name) VALUES
    ('Moshi Urban', 'KR-MU', v_region_id, 'James Lyimo'),
    ('Moshi Rural', 'KR-MR', v_region_id, 'Rose Mushi'),
    ('Hai District', 'KR-HD', v_region_id, 'John Swai')
    ON CONFLICT (region_id, code) DO NOTHING;
  END IF;

  -- Dar es Salaam Territories
  SELECT id INTO v_region_id FROM public.regions WHERE code = 'DSM';
  IF v_region_id IS NOT NULL THEN
    INSERT INTO public.territories (name, code, region_id, tsm_name) VALUES
    ('Kinondoni', 'DSM-KN', v_region_id, 'Richard Mwita'),
    ('Ilala', 'DSM-IL', v_region_id, 'Grace Nditi'),
    ('Temeke', 'DSM-TM', v_region_id, 'Simon Makori'),
    ('Ubungo', 'DSM-UB', v_region_id, 'Elizabeth Mosha'),
    ('Kigamboni', 'DSM-KG', v_region_id, 'Michael Njau')
    ON CONFLICT (region_id, code) DO NOTHING;
  END IF;

  -- Mbeya Region Territories
  SELECT id INTO v_region_id FROM public.regions WHERE code = 'MB';
  IF v_region_id IS NOT NULL THEN
    INSERT INTO public.territories (name, code, region_id, tsm_name) VALUES
    ('Mbeya Urban', 'MB-U', v_region_id, 'Patrick Mgaya'),
    ('Mbeya Rural', 'MB-R', v_region_id, 'Agnes Mbwambo')
    ON CONFLICT (region_id, code) DO NOTHING;
  END IF;

  -- Dodoma Region Territories
  SELECT id INTO v_region_id FROM public.regions WHERE code = 'DD';
  IF v_region_id IS NOT NULL THEN
    INSERT INTO public.territories (name, code, region_id, tsm_name) VALUES
    ('Dodoma Central', 'DD-C', v_region_id, 'Isaac Mwita'),
    ('Dodoma East', 'DD-E', v_region_id, 'Hadija Omari')
    ON CONFLICT (region_id, code) DO NOTHING;
  END IF;
END $$;

-- ============================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================

-- Count summary
SELECT 
  'Zones' as entity,
  COUNT(*) as total
FROM public.zones

UNION ALL

SELECT 
  'Regions' as entity,
  COUNT(*) as total
FROM public.regions

UNION ALL

SELECT 
  'Territories' as entity,
  COUNT(*) as total
FROM public.territories

ORDER BY entity;

-- Display zone hierarchy
SELECT 
  z.name as zone,
  z.code as zone_code,
  COUNT(DISTINCT r.id) as regions,
  COUNT(DISTINCT t.id) as territories
FROM public.zones z
LEFT JOIN public.regions r ON r.zone_id = z.id
LEFT JOIN public.territories t ON t.region_id = r.id
GROUP BY z.id, z.name, z.code
ORDER BY z.name;

-- ============================================
-- COMPLETE!
-- ============================================
-- Seed data created successfully
-- You now have:
-- - 5 Zones
-- - 11 Regions
-- - 17 Territories
-- ============================================
