import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'fake-key-for-local-dev';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('salons')
    .update({ 
      instagram: [
        "https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=800",
        "https://images.unsplash.com/photo-1620331311520-246422fd82f9?q=80&w=800",
        "https://images.unsplash.com/photo-1522337660859-02fbefca4702?q=80&w=800",
        "https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800",
        "https://images.unsplash.com/photo-1580618672591-eb180b1a973f?q=80&w=800",
        "https://images.unsplash.com/photo-1519699047748-de8e457a634e?q=80&w=800"
      ] 
    })
    .eq('slug', 'colorisma');
  
  console.log("Fixed Colorisma instagram array:", error ? error.message : "Success");
}
run();
