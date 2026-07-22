const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: './apps/mobile/.env.local'});
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, '6dc7955937a5d3a763115add6bddc378381c9bf9b7b6642214578b5159fc32fd');
supabase.from('orders').select('*').order('created_at', { ascending: false }).limit(2).then(r => console.log('Error:', r.error, 'Data:', r.data)).catch(console.error);
