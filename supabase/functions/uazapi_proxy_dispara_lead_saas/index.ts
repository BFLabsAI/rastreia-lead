import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian mobile numbers: 55 + DDD(2) + [9] + 8digits
// Inbound from WhatsApp comes without the nono dígito (12-digit).
// We normalize to the 13-digit form for sending and generate all variants for DB lookups.

const stripPhone = (phone: string): string =>
    phone.replace(/@s\.whatsapp\.net$/, '').replace(/@c\.us$/, '').replace(/\D/g, '');

const toApiPhone = (phone: string): string => {
    const d = stripPhone(phone);
    // 12-digit BR mobile → add nono dígito so UazAPI routes correctly
    if (d.length === 12 && d.startsWith('55')) {
        return '55' + d.slice(2, 4) + '9' + d.slice(4);
    }
    return d;
};

const phoneOrFilter = (phone: string): string => {
    const d = stripPhone(phone);
    let d12 = d;
    let d13 = d;
    if (d.length === 13 && d.startsWith('55')) {
        const afterDdd = d.slice(4);
        if (afterDdd.startsWith('9') && afterDdd.length === 9) {
            d12 = '55' + d.slice(2, 4) + afterDdd.slice(1);
        }
    } else if (d.length === 12 && d.startsWith('55')) {
        d13 = '55' + d.slice(2, 4) + '9' + d.slice(4);
    }
    const variants = [...new Set([d12, d13, d12 + '@s.whatsapp.net', d13 + '@s.whatsapp.net'])];
    return variants.map(v => `telefone_lead.eq.${v}`).join(',');
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL') || 'https://bflabs.uazapi.com';
        const UAZAPI_TOKEN = Deno.env.get('UAZAPI_ADMIN_TOKEN');
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error("Missing Supabase environment variables");
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { action, instanceId, clientId, instanceName, instanceToken, phoneNumber, text, leadId, userId } = await req.json();

        // -------------------------
        // ACTION: CREATE INSTANCE
        // -------------------------
        if (action === 'create_instance') {
            if (!instanceId || !clientId) throw new Error("Missing instanceId or clientId");

            // 1. Call UazAPI /instance/init
            const response = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'admintoken': UAZAPI_TOKEN
                },
                body: JSON.stringify({
                    name: instanceId,
                    systemName: 'dashboard-clientes-bf',
                    adminField01: clientId
                })
            });
            const data = await response.json();
            console.log(`[create_instance] UazAPI response (${response.status}):`, JSON.stringify(data));

            if (!data.token) {
                throw new Error(data.message || data.error || `UazAPI error (${response.status}): ${JSON.stringify(data)}`);
            }

            // 2. Insert into DB
            const { error: dbError } = await supabase.from('instances_clientes_bf_labs').insert({
                client_id: clientId,
                instance_name: instanceId,
                token: data.token,
                status: 'disconnected',
                metadata: data
            });

            if (dbError) throw dbError;

            // 3. Register Connection Webhook (One-time setup per instance usually, unless global)
            // We can register instance-specific webhooks if UazAPI supports it, or rely on global webhooks if configured.
            // The reference code had an ensureWebhooks function. Let's replicate simple webhook registration.
            // Assuming UazAPI allows setting webhooks via /instance/webhook
            // 3. Register Connection Webhook
            // User cURL shows POST /webhook with header 'token: instanceToken'
            const webhookUrl = `${SUPABASE_URL}/functions/v1/relatorios_clientes_bf`;

            // Note: UAZAPI_BASE_URL likely ends with /... so make sure we don't double slash if not needed, 
            // but usually env var is https://api.com
            // User said: https://bflabs.uazapi.com/webhook

            console.log(`Setting up Supabase connection webhook for instance ${instanceId} at ${webhookUrl}`);

            // Webhook 1: Supabase (Connection Status Only)
            const webhook1 = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': data.token
                },
                body: JSON.stringify({
                    action: 'add',         // Ensure we ADD, not overwrite
                    enabled: true,
                    url: webhookUrl,
                    events: ['connection'],
                    webhookByEvents: true,
                })
            });
            if (!webhook1.ok) console.error("Failed to set Supabase webhook:", await webhook1.text());
            else console.log("Supabase webhook set successfully");

            // Webhook 2: n8n (Standard/Leads)
            const n8nWebhookUrl = "https://n8n-new.bflabs.com.br/webhook/cadastro-leads-relatorio-trafego";
            console.log(`Setting up n8n webhook for instance ${instanceId} at ${n8nWebhookUrl}`);

            const webhook2 = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': data.token
                },
                body: JSON.stringify({
                    action: 'add',
                    enabled: true,
                    url: n8nWebhookUrl,
                    events: ['messages'],
                    excludeMessages: ['isGroupYes'], // Correct filter per user cURL
                    webhookByEvents: true,
                })
            });

            if (!webhook2.ok) console.error("Failed to set n8n webhook:", await webhook2.text());
            else console.log("n8n webhook set successfully");

            return new Response(JSON.stringify(data), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // -------------------------
        // ACTION: GET QR CODE
        // -------------------------
        if (action === 'get_qrcode') {
            if (!instanceName) throw new Error("Missing instanceName");

            // Fetch instance to get token
            const { data: instance, error } = await supabase
                .from('instances_clientes_bf_labs')
                .select('token, qrcode, qrcode_generated_at, status')
                .eq('instance_name', instanceName)
                .single();

            if (error || !instance) throw new Error("Instance not found");

            // Check cache (2 mins)
            if (instance.qrcode && instance.qrcode_generated_at) {
                const diff = Date.now() - new Date(instance.qrcode_generated_at).getTime();
                if (diff < 120000 && instance.status !== 'connected') {
                    return new Response(JSON.stringify({
                        qrcode: instance.qrcode,
                        qrcode_generated_at: instance.qrcode_generated_at
                    }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }
            }

            // Request new QR
            const uazResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': instance.token
                },
                body: JSON.stringify({ phone: "" }) // Empty phone for QR
            });
            const uazData = await uazResponse.json();

            const qrcode = uazData.base64 || uazData.qrcode || uazData.qr || uazData.instance?.qrcode;
            const qrcode_generated_at = new Date().toISOString();

            if (qrcode) {
                // Update DB
                await supabase.from('instances_clientes_bf_labs').update({
                    qrcode,
                    qrcode_generated_at
                }).eq('instance_name', instanceName);
            }

            return new Response(JSON.stringify({ qrcode, qrcode_generated_at, ...uazData }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // -------------------------
        // ACTION: DISCONNECT
        // -------------------------
        if (action === 'disconnect_instance') {
            if (!instanceName) throw new Error("Missing instanceName");
            const { data: instance } = await supabase
                .from('instances_clientes_bf_labs')
                .select('token')
                .eq('instance_name', instanceName)
                .single();

            if (!instance) throw new Error("Instance not found");

            // Call UazAPI
            // User cURL: POST /instance/disconnect
            const uazResponse = await fetch(`${UAZAPI_BASE_URL}/instance/disconnect`, {
                method: 'POST',
                headers: {
                    'token': instance.token,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            // Update DB
            await supabase.from('instances_clientes_bf_labs').update({
                status: 'disconnected',
                qrcode: null
            }).eq('instance_name', instanceName);

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // -------------------------
        // ACTION: DELETE
        // -------------------------
        if (action === 'delete_instance') {
            if (!instanceName) throw new Error("Missing instanceName");
            const { data: instance } = await supabase
                .from('instances_clientes_bf_labs')
                .select('token')
                .eq('instance_name', instanceName)
                .single();

            if (instance) {
                console.log(`Deleting instance ${instanceName} from UazAPI...`);
                const delResponse = await fetch(`${UAZAPI_BASE_URL}/instance`, {
                    method: 'DELETE',
                    headers: {
                        'token': instance.token,
                        'Content-Type': 'application/json'
                    }
                });
                console.log(`[delete_instance] UazAPI response (${delResponse.status})`);
            }

            // Delete from DB
            const { error } = await supabase
                .from('instances_clientes_bf_labs')
                .delete()
                .eq('instance_name', instanceName);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // -------------------------
        // ACTION: GET STATUS
        // -------------------------
        if (action === 'get_connection_status') {
            if (!instanceName) throw new Error("Missing instanceName");
            const { data: instance } = await supabase
                .from('instances_clientes_bf_labs')
                .select('token')
                .eq('instance_name', instanceName)
                .single();

            if (!instance) throw new Error("Instance not found");

            // Call UazAPI
            // User requested explicit usage of /instance/status
            const uazResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connectionState`, {
                method: 'GET',
                headers: { 'token': instance.token }
            });

            // Fallback try to /instance/status if connectionState fails or returns 404? 
            // Actually, let's trust the user provided cURL which points to /instance/status?
            // But usually Evo API is /connectionState.
            // Let's try to stick to existing /connectionState but add better logging/handling.
            // Wait, the user SPECIFICALLY asked to implement a call to /instance/status.
            // I will honor that.

            /* 
               User provided: https://bflabs.uazapi.com/instance/status 
               We will use that path.
            */
            const statusResponse = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
                method: 'GET',
                headers: {
                    'token': instance.token,
                    'Content-Type': 'application/json'
                }
            });

            if (!statusResponse.ok) {
                // Try fallback to connectionState just in case /status is custom
                const fallbackResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connectionState`, {
                    method: 'GET',
                    headers: { 'token': instance.token }
                });
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();

                    const rawStatusFallback = fallbackData.state || fallbackData.status || fallbackData.connectionStatus || 'disconnected';
                    const normalizedFallback = String(rawStatusFallback).toLowerCase();

                    let dbStatus = 'disconnected';
                    if (['open', 'connected', 'success', 'pair'].includes(normalizedFallback)) dbStatus = 'connected';
                    if (['connecting', 'initializing'].includes(normalizedFallback)) dbStatus = 'connecting';

                    await supabase.from('instances_clientes_bf_labs').update({
                        status: dbStatus
                    }).eq('instance_name', instanceName);

                    return new Response(JSON.stringify({ status: dbStatus, raw: fallbackData, source: 'connectionState' }), {
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    });
                }

                const err = await statusResponse.text();
                throw new Error(`Failed to get status from UazAPI: ${err}`);
            }

            const data = await statusResponse.json();

            // Fix: 'data.status' might be an object { connected: true }
            // We must prioritize explicit string statuses.
            let rawStatus = 'disconnected';

            // Priority 1: Nested instance data
            if (data.instance?.status && typeof data.instance.status === 'string') {
                rawStatus = data.instance.status;
            }
            else if (data.instance?.state && typeof data.instance.state === 'string') {
                rawStatus = data.instance.state;
            }
            // Priority 2: Custom object status
            else if (data.status?.connected === true) {
                rawStatus = 'connected';
            }
            // Priority 3: Top level strings
            else if (typeof data.status === 'string') {
                rawStatus = data.status;
            }
            else if (typeof data.state === 'string') {
                rawStatus = data.state;
            }
            else if (typeof data.connectionStatus === 'string') {
                rawStatus = data.connectionStatus;
            }

            console.error(`[Status Check] Response for ${instanceName}:`, JSON.stringify(data));
            console.error(`[Status Check] Extracted rawStatus: ${rawStatus}`);

            const normalized = String(rawStatus).toLowerCase();

            let dbStatus = 'disconnected';
            if (['open', 'connected', 'success', 'pair'].includes(normalized)) dbStatus = 'connected';
            if (['connecting', 'initializing'].includes(normalized)) dbStatus = 'connecting';

            await supabase.from('instances_clientes_bf_labs').update({
                status: dbStatus
            }).eq('instance_name', instanceName);

            return new Response(JSON.stringify({ status: dbStatus, raw: data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // -------------------------
        // ACTION: IMPORT INSTANCE
        // -------------------------
        if (action === 'import_instance') {
            if (!instanceName || !instanceToken || !clientId) {
                throw new Error("Missing instanceName, instanceToken, or clientId");
            }

            console.log(`Importing existing instance: ${instanceName} for client: ${clientId}`);

            // 1. Check if instance already exists in our DB
            const { data: existingInstance } = await supabase
                .from('instances_clientes_bf_labs')
                .select('id')
                .eq('instance_name', instanceName)
                .single();

            if (existingInstance) {
                throw new Error("Instance already exists in the system");
            }

            // 2. Verify instance exists in UazAPI by checking status
            const statusResponse = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
                method: 'GET',
                headers: {
                    'token': instanceToken,
                    'Content-Type': 'application/json'
                }
            });

            if (!statusResponse.ok) {
                // Try connectionState as fallback
                const fallbackResponse = await fetch(`${UAZAPI_BASE_URL}/instance/connectionState`, {
                    method: 'GET',
                    headers: { 'token': instanceToken }
                });

                if (!fallbackResponse.ok) {
                    throw new Error("Invalid instance token or instance not found in UazAPI");
                }
            }

            // 3. Create record in DB with webhook_only=true
            const { data: newInstance, error: dbError } = await supabase
                .from('instances_clientes_bf_labs')
                .insert({
                    id: crypto.randomUUID(),
                    client_id: clientId,
                    instance_name: instanceName,
                    token: instanceToken,
                    status: 'connected',
                    webhook_only: true,
                    metadata: { imported_manually: true, imported_at: new Date().toISOString() }
                })
                .select()
                .single();

            if (dbError) {
                console.error("Database error:", dbError);
                throw new Error(`Failed to create instance record: ${dbError.message}`);
            }

            // 4. Register webhooks in UazAPI

            // Webhook 1: Connection status
            const connectionWebhookUrl = `${SUPABASE_URL}/functions/v1/relatorios_clientes_bf`;
            console.log(`Setting up connection webhook for imported instance ${instanceName}`);

            const webhook1 = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': instanceToken
                },
                body: JSON.stringify({
                    action: 'add',
                    enabled: true,
                    url: connectionWebhookUrl,
                    events: ['connection'],
                    webhookByEvents: true,
                })
            });
            if (!webhook1.ok) {
                console.error("Failed to set connection webhook:", await webhook1.text());
            } else {
                console.log("Connection webhook set successfully");
            }

            // Webhook 2: Messages (for leads)
            const n8nWebhookUrl = "https://n8n-new.bflabs.com.br/webhook/cadastro-leads-relatorio-trafego";
            console.log(`Setting up messages webhook for imported instance ${instanceName}`);

            const webhook2 = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': instanceToken
                },
                body: JSON.stringify({
                    action: 'add',
                    enabled: true,
                    url: n8nWebhookUrl,
                    events: ['messages'],
                    excludeMessages: ['isGroupYes'],
                    webhookByEvents: true,
                })
            });
            if (!webhook2.ok) {
                console.error("Failed to set messages webhook:", await webhook2.text());
            } else {
                console.log("Messages webhook set successfully");
            }

            console.log(`Instance ${instanceName} imported successfully`);

            return new Response(JSON.stringify({
                success: true,
                instance: newInstance,
                webhooks: {
                    connection: webhook1.ok,
                    messages: webhook2.ok
                }
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // -------------------------
        // ACTION: SEND TEXT MESSAGE
        // -------------------------
        if (action === 'send_text_message') {
            if (!instanceName || !phoneNumber || !text || !clientId || !leadId) {
                throw new Error("Missing required fields: instanceName, phoneNumber, text, clientId, leadId");
            }

            // 1. Buscar instância
            const { data: instance, error: instanceError } = await supabase
                .from('instances_clientes_bf_labs')
                .select('id, token, status')
                .eq('instance_name', instanceName)
                .single();

            if (instanceError || !instance) throw new Error("Instance not found");

            // 2. Verificar se está conectada
            if (instance.status !== 'connected') {
                return new Response(JSON.stringify({ error: 'Instância não está conectada' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 3. Normalizar telefone (sempre 13 dígitos para UazAPI)
            const cleanPhone = toApiPhone(phoneNumber);

            // 4. Chamar UazAPI
            const uazResponse = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': instance.token
                },
                body: JSON.stringify({ number: cleanPhone, text })
            });
            const uazData = await uazResponse.json();

            if (!uazResponse.ok) {
                return new Response(JSON.stringify({ error: uazData.message || uazData.error || 'Erro ao enviar mensagem na UazAPI' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 5. Salvar no banco
            const uazapiMessageId = uazData.id || uazData.messageid || null;
            const { data: savedMessage, error: dbError } = await supabase
                .from('messages_relatorios_clientes')
                .insert({
                    client_id: clientId,
                    instance_id: instance.id,
                    lead_id: leadId,
                    uazapi_message_id: uazapiMessageId,
                    direction: 'outbound',
                    message_type: 'text',
                    content: text,
                    sender_name: null,
                    user_id: userId || null,
                    sent_at: new Date().toISOString()
                })
                .select()
                .single();

            if (dbError) throw dbError;

            return new Response(JSON.stringify({ success: true, message: savedMessage }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // -------------------------
        // ACTION: START CONVERSATION
        // -------------------------
        if (action === 'start_conversation') {
            if (!phoneNumber || !text || !instanceName || !clientId) {
                throw new Error("Missing required fields");
            }

            // 1. Normalizar telefone
            const apiPhone = toApiPhone(phoneNumber); // 13-digit para UazAPI
            const orFilter = phoneOrFilter(phoneNumber); // todas as variantes para lookup

            // 2. Buscar instância
            const { data: instance, error: instanceError } = await supabase
                .from('instances_clientes_bf_labs')
                .select('id, token, status')
                .eq('instance_name', instanceName)
                .single();

            if (instanceError || !instance) throw new Error("Instance not found");
            if (instance.status !== 'connected') {
                return new Response(JSON.stringify({ error: 'Instância não está conectada' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 3. Buscar lead existente — cobre 12-digit, 13-digit, com/sem @s.whatsapp.net
            const { data: existingLeads } = await supabase
                .from('relatorio_leads_cliente')
                .select('*')
                .eq('cliente_id', clientId)
                .or(orFilter);

            let lead = existingLeads && existingLeads.length > 0 ? existingLeads[0] : null;

            // 4. Se não existe, criar lead novo no formato canônico (12-digit + @s.whatsapp.net)
            if (!lead) {
                const canonicalPhone = stripPhone(apiPhone).length === 13
                    ? '55' + stripPhone(apiPhone).slice(2, 4) + stripPhone(apiPhone).slice(5) + '@s.whatsapp.net'
                    : stripPhone(apiPhone) + '@s.whatsapp.net';

                const { data: newLead, error: leadError } = await supabase
                    .from('relatorio_leads_cliente')
                    .insert({
                        cliente_id: clientId,
                        telefone_lead: canonicalPhone,
                        instance_name: instanceName,
                        lead_name: apiPhone,
                    })
                    .select()
                    .single();

                if (leadError) throw leadError;
                lead = newLead;
            }

            // 5. Enviar mensagem via UazAPI (sempre 13-digit)
            const uazResponse = await fetch(`${UAZAPI_BASE_URL}/send/text`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'token': instance.token
                },
                body: JSON.stringify({ number: apiPhone, text })
            });
            const uazData = await uazResponse.json();

            if (!uazResponse.ok) {
                return new Response(JSON.stringify({ error: uazData.message || uazData.error || 'Erro ao enviar mensagem' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }

            // 6. Salvar mensagem
            const uazapiMessageId = uazData.id || uazData.messageid || null;
            const { error: msgError } = await supabase
                .from('messages_relatorios_clientes')
                .insert({
                    client_id: clientId,
                    instance_id: instance.id,
                    lead_id: lead.id,
                    uazapi_message_id: uazapiMessageId,
                    direction: 'outbound',
                    message_type: 'text',
                    content: text,
                    sent_at: new Date().toISOString()
                });

            if (msgError) throw msgError;

            // 7. Retornar lead completo
            return new Response(JSON.stringify({ success: true, lead }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        throw new Error("Invalid action");

    } catch (error: any) {
        console.error("Global Error:", error);
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
