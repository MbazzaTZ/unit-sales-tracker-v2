-- Add missing stock status enum values
ALTER TYPE public.stock_status ADD VALUE IF NOT EXISTS 'in-hand';
ALTER TYPE public.stock_status ADD VALUE IF NOT EXISTS 'sold';
