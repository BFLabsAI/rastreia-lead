import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

serve(async (req) => {
    try {
        const payload = await req.json();
        
        const eventType = payload.EventType || payload.event;
        const instanceName = payload.instanceName || payload.instance?.name || payload.instance;
        const messageData = payload.message || payload.data;

        // Verify if it's a message event
        const isMessageEvent = ['messages', 'messages.upsert', 'MESSAGES_UPSERT'].includes(eventType);
        if (!isMessageEvent || !messageData) {
            return new Response('OK', { status: 200 });
        }

        // 1. Fetch tenant from instance
        const { data: instance } = await supabase
            .from('instances_dispara_lead_saas_02')
            .select('id, tenant_id, token')
            .eq('instance_name', instanceName)
            .single();

        if (!instance) {
            console.error(`Instance not found: ${instanceName}`);
            return new Response('Instance not found', { status: 200 });
        }

        // 2. Extract message data
        const isFromMe = messageData.fromMe || messageData.key?.fromMe;
        const remoteJid = messageData.key?.remoteJid || messageData.chatid || '';
        const phone = remoteJid.split('@')[0];
        const pushName = payload.chat?.name || messageData.pushName || '';
        const messageType = messageData.messageType || messageData.type || 'text';
        const messageId = messageData.key?.id || messageData.id;
        const textContent = messageData.text || messageData.conversation || messageData.message?.conversation || '';

        // 3. Media Extraction
        let mediaUrl = null;
        const content = messageData.content || messageData.message?.content || messageData.message;
        
        if (content && typeof content === 'object') {
            mediaUrl = content.base64 || content.url || content.mediaUrl || 
                       content.JPEGThumbnail || content.image;
        }

        // High quality download fallback
        const isMedia = ['image', 'video', 'audio', 'document', 'sticker', 'ImageMessage', 'VideoMessage'].includes(messageType);
        if (isMedia && instance.token && messageId && !mediaUrl) {
            try {
                const dlResponse = await fetch(`${UAZAPI_BASE_URL}/message/download`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'token': instance.token },
                    body: JSON.stringify({ id: messageId, return_base64: true })
                });
                
                if (dlResponse.ok) {
                    const dlData = await dlResponse.json();
                    if (dlData.base64Data && dlData.mimetype) {
                        mediaUrl = `data:${dlData.mimetype};base64,${dlData.base64Data}`;
                    }
                }
            } catch (e) {
                console.error('Media download error:', e.message);
            }
        }

        // 4. UPSERT CONTACT (Lead Automatic Creation)
        const { data: contact } = await supabase
            .from('contacts_dispara_lead_saas_02')
            .upsert({
                tenant_id: instance.tenant_id,
                phone: phone,
                name: isFromMe ? null : (pushName || null),
                last_message_at: new Date().toISOString()
            }, { onConflict: 'tenant_id, phone' })
            .select('id')
            .maybeSingle();

        // 5. UPSERT MESSAGE (Chat History)
        await supabase.from('messages_dispara_lead_saas_02').upsert({
            tenant_id: instance.tenant_id,
            instance_id: instance.id,
            contact_id: contact?.id || null,
            uazapi_message_id: messageId,
            direction: isFromMe ? 'outbound' : 'inbound',
            message_type: messageType,
            content: textContent,
            media_url: mediaUrl,
            sender_name: isFromMe ? 'System' : (pushName || null),
            sent_at: new Date().toISOString()
        }, { onConflict: 'uazapi_message_id' });

        return new Response(JSON.stringify({ received: true }), { 
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Webhook Message Error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }
});
