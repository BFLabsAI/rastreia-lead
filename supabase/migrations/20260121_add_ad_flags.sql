-- Add active flags for Meta and Google Ads to the clients table
ALTER TABLE public.relatorio_clientes_bf_labs 
ADD COLUMN IF NOT EXISTS active_meta BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS active_google BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN public.relatorio_clientes_bf_labs.active_meta IS 'Indicates if Meta Ads module is active for this client';
COMMENT ON COLUMN public.relatorio_clientes_bf_labs.active_google IS 'Indicates if Google Ads module is active for this client';
