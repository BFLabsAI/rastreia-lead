-- Create instances table linked to clients
CREATE TABLE IF NOT EXISTS public.instances_clientes_bf_labs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid REFERENCES public.relatorio_clientes_bf_labs(id) ON DELETE CASCADE,
    instance_name text NOT NULL UNIQUE,
    status text DEFAULT 'disconnected',   -- disconnected | connecting | connected
    qrcode text,                          -- Base64 do QR Code
    qrcode_generated_at timestamptz,
    token text,                           -- Token da instância (UazAPI)
    uazapi_instance_id text,
    metadata jsonb,                       -- Response completo da criação
    last_connected_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- No RLS as requested
ALTER TABLE public.instances_clientes_bf_labs DISABLE ROW LEVEL SECURITY;
