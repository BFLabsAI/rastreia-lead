
-- Enable Realtime for instances_clientes_bf_labs
begin;
  -- Check if publication exists, if not create correctly or just add table
  -- Standard Supabase realtime publication is 'supabase_realtime'
  alter publication supabase_realtime add table instances_clientes_bf_labs;
commit;
