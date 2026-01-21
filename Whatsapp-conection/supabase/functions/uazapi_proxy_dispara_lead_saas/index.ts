import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN');      // Admin token
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authenticate user via JWT
        const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '');
        if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

        const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader);
        if (authError || !user) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

        const { action, ...params } = await req.json();
        let result = null;

        switch (action) {
            case 'create_instance':
                result = await createInstance(params);
                break;
            case 'get_qrcode':
                result = await getQrCode(params);
                break;
            case 'disconnect_instance':
                result = await disconnectInstance(params);
                break;
            case 'delete_instance':
                result = await deleteInstance(params);
                break;
            case 'get_connection_status':
                result = await getConnectionStatus(params);
                break;
            default:
                throw new Error(`Invalid action: ${action}`);
        }

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// ========== CORE FUNCTIONS ==========

async function createInstance({ instanceName, tenant_id }) {
    // 1. Call UazAPI
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'admintoken': UAZAPI_TOKEN!
        },
        body: JSON.stringify({
            name: instanceName,
            systemName: 'uazapi-wrapper',
            adminField01: tenant_id
        })
    });
    const data = await response.json();

    // 2. Save to DB
    await supabase.from('instances_dispara_lead_saas_02').insert({
        tenant_id,
        instance_name: instanceName,
        token: data.token,
        status: 'disconnected',
        metadata: data
    });

    // 3. Register webhooks automatically
    await ensureWebhooks(instanceName, data.token);

    return data;
}

async function ensureWebhooks(instanceName, token) {
    const webhookUrl = `${SUPABASE_URL}/functions/v1`;

    // CONNECTION Webhook
    await fetch(`${UAZAPI_BASE_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': token },
        body: JSON.stringify({
            action: "add",
            enabled: true,
            url: `${webhookUrl}/webhook_connection_dispara_lead_saas`,
            events: ["connection"]
        })
    });

    // MESSAGES Webhook
    await fetch(`${UAZAPI_BASE_URL}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': token },
        body: JSON.stringify({
            action: "add",
            enabled: true,
            url: `${webhookUrl}/webhook_messages_dispara_lead_saas`,
            events: ["messages"]
        })
    });
}

async function getQrCode({ instanceName }) {
    const { data: instance } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('token, qrcode, qrcode_generated_at, status')
        .eq('instance_name', instanceName)
        .single();

    if (!instance) throw new Error("Instance not found");

    // Cache logic: 2 minutes
    if (instance.qrcode && instance.qrcode_generated_at) {
        const diffMs = Date.now() - new Date(instance.qrcode_generated_at).getTime();
        if (diffMs < 120000 && instance.status !== 'connected') {
            return { qrcode: instance.qrcode };
        }
    }

    const response = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instance.token },
        body: JSON.stringify({ phone: "" })
    });
    const data = await response.json();
    const qrcode = data.base64 || data.qrcode || data.qr || data.instance?.qrcode;

    if (qrcode) {
        await supabase.from('instances_dispara_lead_saas_02').update({
            qrcode,
            qrcode_generated_at: new Date().toISOString()
        }).eq('instance_name', instanceName);
    }

    return { qrcode, ...data };
}

async function getConnectionStatus({ instanceName, ensure_webhooks }) {
    const { data: instance } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('token, status')
        .eq('instance_name', instanceName)
        .single();

    if (!instance) throw new Error("Instance not found");

    const response = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
        method: 'GET',
        headers: { 'token': instance.token }
    });
    const data = await response.json();

    let status = 'disconnected';
    const raw = data.instance?.status || data.status;
    if (raw === 'open' || raw === 'connected') status = 'connected';
    else if (raw === 'connecting') status = 'connecting';

    await supabase.from('instances_dispara_lead_saas_02').update({
        status,
        last_connected_at: status === 'connected' ? new Date().toISOString() : null
    }).eq('instance_name', instanceName);

    if (ensure_webhooks) {
        await ensureWebhooks(instanceName, instance.token);
    }

    return { instance: { state: status } };
}

async function disconnectInstance({ instanceName }) {
    const { data } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('token')
        .eq('instance_name', instanceName)
        .single();

    if (!data) throw new Error("Instance not found");

    await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': data.token },
        body: JSON.stringify({ reason: "user_requested" })
    });

    await supabase.from('instances_dispara_lead_saas_02').update({
        status: 'disconnected',
        qrcode: null
    }).eq('instance_name', instanceName);

    return { success: true };
}

async function deleteInstance({ instanceName, tenant_id }) {
    await fetch(`${UAZAPI_BASE_URL}/instance/delete/${instanceName}`, {
        method: 'DELETE',
        headers: { 'admintoken': UAZAPI_TOKEN! }
    });

    await supabase.from('instances_dispara_lead_saas_02')
        .delete()
        .eq('instance_name', instanceName)
        .eq('tenant_id', tenant_id);

    return { success: true };
}
