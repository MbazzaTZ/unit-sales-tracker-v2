import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  console.error('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('Key:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixStockTypes() {
  console.log('Starting to fix stock types...');

  try {
    // First, let's see what we have
    const { data: allStock, error: fetchError } = await supabase
      .from('stock')
      .select('id, type');
    
    if (fetchError) throw fetchError;
    console.log(`Found ${allStock?.length || 0} stock records`);
    
    const typeCounts: Record<string, number> = {};
    allStock?.forEach(item => {
      typeCounts[item.type] = (typeCounts[item.type] || 0) + 1;
    });
    console.log('Current type distribution:', typeCounts);

    // Update Full Set records
    const { data: fs, error: fsError } = await supabase
      .from('stock')
      .update({ type: 'FS' })
      .ilike('type', '%Full Set%')
      .select();

    if (fsError) throw fsError;
    console.log(`Updated ${fs?.length || 0} Full Set records to FS`);

    // Update Decoder Only records
    const { data: do_, error: doError } = await supabase
      .from('stock')
      .update({ type: 'DO' })
      .ilike('type', '%Decoder Only%')
      .select();

    if (doError) throw doError;
    console.log(`Updated ${do_?.length || 0} Decoder Only records to DO`);

    // Update DVS records
    const { data: dvs, error: dvsError } = await supabase
      .from('stock')
      .update({ type: 'DVS' })
      .ilike('type', '%Digital Virtual%')
      .select();

    if (dvsError) throw dvsError;
    console.log(`Updated ${dvs?.length || 0} Digital Virtual Stock records to DVS`);

    console.log('✅ All stock types updated successfully!');
  } catch (error) {
    console.error('❌ Error updating stock types:', error);
  }
}

fixStockTypes();
