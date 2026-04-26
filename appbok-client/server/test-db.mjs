import supabase from './lib/supabase.js';
async function test() {
  const { data } = await supabase.from('users').select('id, name, salon_id');
  console.log(JSON.stringify(data, null, 2));
}
test();
