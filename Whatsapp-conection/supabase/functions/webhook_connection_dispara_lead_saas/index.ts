import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
    try {
        const payload = await req.json();
        const event = payload.event || payload.EventType;
        const instanceName = payload.instance?.name || payload.instanceName;
        const rawStatus = payload.data?.status || payload.data?.state;

        // Process only connection events
        const isConnectionEvent = ['connection', 'CONNECTION_UPDATE', 'connection.update'].includes(event);

        if (isConnectionEvent && instanceName) {
            // Normalize status
            let status = 'disconnected';
            if (rawStatus === 'open' || rawStatus === 'connected') status = 'connected';
            else if (rawStatus === 'connecting') status = 'connecting';
            else if (rawStatus === 'close') status = 'disconnected';

            // Update DB
            await supabase.from('instances_dispara_lead_saas_02').update({
                status,
                last_connected_at: status === 'connected' ? new Date().toISOString() : undefined,
                qrcode: status === 'connected' ? null : undefined // Clear QR if connected
            }).eq('instance_name', instanceName);
        }

        return new Response(JSON.stringify({ received: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
});
