-- Add share_token column to instances table
ALTER TABLE public.instances_clientes_bf_labs 
ADD COLUMN IF NOT EXISTS share_token text UNIQUE,
ADD COLUMN IF NOT EXISTS share_token_created_at timestamptz;

-- Index for faster lookup by token
CREATE INDEX IF NOT EXISTS idx_instances_share_token ON public.instances_clientes_bf_labs(share_token);
