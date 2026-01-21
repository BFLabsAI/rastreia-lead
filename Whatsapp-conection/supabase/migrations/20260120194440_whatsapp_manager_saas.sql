-- =============================================
-- 1. INSTÂNCIAS WHATSAPP
-- =============================================
CREATE TABLE IF NOT EXISTS public.instances_dispara_lead_saas_02 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
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

-- =============================================
-- 2. CONTATOS / LEADS
-- =============================================
CREATE TABLE IF NOT EXISTS public.contacts_dispara_lead_saas_02 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    phone text NOT NULL,
    name text,
    notes text,                           -- Observações do usuário
    tags text[],                          -- Tags/categorias
    first_message_at timestamptz,
    last_message_at timestamptz,
    created_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, phone)
);

-- =============================================
-- 3. MENSAGENS (HISTÓRICO DE CHAT)
-- =============================================
CREATE TABLE IF NOT EXISTS public.messages_dispara_lead_saas_02 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    instance_id uuid REFERENCES public.instances_dispara_lead_saas_02(id) ON DELETE CASCADE,
    contact_id uuid REFERENCES public.contacts_dispara_lead_saas_02(id) ON DELETE CASCADE,
    uazapi_message_id text UNIQUE,        -- ID da mensagem na UazAPI
    direction text CHECK (direction IN ('inbound', 'outbound')),
    message_type text,                    -- text, image, video, audio, document
    content text,
    media_url text,                       -- Base64 ou URL
    sender_name text,
    sent_at timestamptz,
    is_read boolean DEFAULT false,
    user_id uuid,                         -- Quem enviou (se outbound manual)
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 4. LOGS DE API (DEBUG)
-- =============================================
CREATE TABLE IF NOT EXISTS public.uazapi_logs_dispara_lead_saas_02 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text,
    request_payload jsonb,
    response_payload jsonb,
    status_code integer,
    created_at timestamptz DEFAULT now()
);

-- =============================================
-- 5. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE public.instances_dispara_lead_saas_02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts_dispara_lead_saas_02 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages_dispara_lead_saas_02 ENABLE ROW LEVEL SECURITY;
-- uazapi_logs usually for internal monitoring, but can be enabled if needed.

-- CREATE POLICIES (Assuming a 'users_dispara_lead_saas_02' table exists with tenant_id)

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'instances_dispara_lead_saas_02' AND policyname = 'Tenant isolation'
    ) THEN
        CREATE POLICY "Tenant isolation" ON public.instances_dispara_lead_saas_02
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.users_dispara_lead_saas_02 WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'contacts_dispara_lead_saas_02' AND policyname = 'Tenant isolation'
    ) THEN
        CREATE POLICY "Tenant isolation" ON public.contacts_dispara_lead_saas_02
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.users_dispara_lead_saas_02 WHERE id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'messages_dispara_lead_saas_02' AND policyname = 'Tenant isolation'
    ) THEN
        CREATE POLICY "Tenant isolation" ON public.messages_dispara_lead_saas_02
        FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.users_dispara_lead_saas_02 WHERE id = auth.uid()));
    END IF;
END $$;
