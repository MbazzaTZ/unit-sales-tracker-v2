import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('📋 Adding date_confirmed column to stock table...\n');
    
    // Test if we can access the stock table schema
    const { data: testData, error: testError } = await supabase
      .from('stock')
      .select('id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Cannot access stock table: ${testError.message}`);
    }
    
    console.log('✅ Database connection successful');
    console.log('\n⚠️  Manual migration required (anon key cannot execute DDL):\n');
    console.log('1. Go to: https://supabase.com/dashboard/project/cwegsphronivqyhrhpje/sql/new');
    console.log('2. Run this SQL:\n');
    console.log('---');
    console.log('ALTER TABLE public.stock ADD COLUMN IF NOT EXISTS date_confirmed TIMESTAMP WITH TIME ZONE;');
    console.log('CREATE INDEX IF NOT EXISTS idx_stock_date_confirmed ON public.stock(date_confirmed);');
    console.log('COMMENT ON COLUMN public.stock.date_confirmed IS \'Timestamp when DSR confirmed receipt of assigned stock\';');
    console.log('---\n');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  Please apply migration manually in Supabase Dashboard\n');
    process.exit(1);
  }
}

runMigration();
