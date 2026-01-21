import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

serve(async (req) => {
    try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing env vars");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const body = await req.json();
        console.log("Webhook received:", JSON.stringify(body));

        // Format A: { instance: "name", data: { state: "open" } }
        // Format B: { instanceId: "name", state: "open" }
        // Format C: { instance: { status: "connected" } } 

        let instanceName = body.instance || body.instanceId || body.data?.instance;
        // Fix: If instance is an object (e.g. { name: "foo", status: "..." }), extract the name
        if (typeof instanceName === 'object' && instanceName !== null) {
            instanceName = instanceName.name || instanceName.id;
        }

        let rawStatus = 'disconnected';
        // Priority logic similar to proxy
        if (body.instance?.status && typeof body.instance.status === 'string') {
            rawStatus = body.instance.status;
        }
        else if (body.data?.state) {
            rawStatus = body.data.state;
        }
        else if (body.state) {
            rawStatus = body.state;
        }
        else if (body.status) {
            if (typeof body.status === 'string') rawStatus = body.status;
            else if (body.status?.connected === true) rawStatus = 'connected';
        }

        console.log("Parsed payload:", { instanceName, rawStatus });

        // Normalize status
        const normalized = String(rawStatus).toLowerCase();
        let dbStatus = 'disconnected';
        if (['open', 'connected', 'success', 'pair'].includes(normalized)) dbStatus = 'connected';
        if (['connecting', 'initializing'].includes(normalized)) dbStatus = 'connecting';

        console.log("Normalized status for DB:", dbStatus);

        // Find instance by Token (Best) or Name
        const token = body.token || body.instance?.token;

        if (token) {
            console.log("Updating by TOKEN:", token);
            const { data, error } = await supabase
                .from('instances_clientes_bf_labs')
                .update({
                    status: dbStatus,
                    last_connected_at: dbStatus === 'connected' ? new Date().toISOString() : undefined
                })
                .eq('token', token)
                .select();

            if (error) console.error("Error updating Supabase by token:", error);
            else console.log("Supabase update successful (by token):", data);

        } else if (instanceName) {
            console.log("Updating by NAME (fallback):", instanceName);
            // Try to update by instance_name OR metadata->instance->id
            const { data, error } = await supabase
                .from('instances_clientes_bf_labs')
                .update({
                    status: dbStatus,
                    last_connected_at: dbStatus === 'connected' ? new Date().toISOString() : undefined
                })
                .or(`instance_name.eq.${instanceName},metadata->instance->>id.eq.${instanceName}`)
                .select();

            if (error) console.error("Error updating Supabase by name:", error);
            else console.log("Supabase update successful (by name):", data);
        } else {
            console.warn("No token or instanceName found in payload");
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }
});
