-- ============================================
-- STEP 1: Add Manager Role to Enum
-- Run this FIRST, then run complete-system-update.sql
-- ============================================

-- Add 'manager' to app_role enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';

-- Verify the enum value was added
SELECT 'Manager role added to app_role enum' as status;
