-- Database Trigger to call calculate_lead_status Edge Function on new message
-- This requires pg_net extension to be enabled

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function that calls the Edge Function
CREATE OR REPLACE FUNCTION trigger_calculate_lead_status()
RETURNS TRIGGER AS $$
DECLARE
    supabase_url TEXT;
    service_key TEXT;
BEGIN
    -- Get Supabase URL from environment (set in vault or config)
    -- Note: In production, use vault secrets. For now, hardcoded.
    supabase_url := current_setting('app.supabase_url', true);
    
    -- Make async HTTP call to Edge Function
    PERFORM net.http_post(
        url := supabase_url || '/functions/v1/calculate_lead_status',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
        ),
        body := jsonb_build_object('lead_id', NEW.lead_id)
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS trigger_update_lead_status ON messages_relatorios_clientes;

CREATE TRIGGER trigger_update_lead_status
AFTER INSERT ON messages_relatorios_clientes
FOR EACH ROW
EXECUTE FUNCTION trigger_calculate_lead_status();

-- Set the app settings (you need to run these with your actual values)
-- ALTER DATABASE postgres SET app.supabase_url = 'https://your-project.supabase.co';
-- ALTER DATABASE postgres SET app.service_role_key = 'your-service-role-key';

COMMENT ON TRIGGER trigger_update_lead_status ON messages_relatorios_clientes IS 'Triggers lead status recalculation on new message';
