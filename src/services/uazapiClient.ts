import { supabase } from '@/lib/supabase';

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1/uazapi_proxy_dispara_lead_saas';

// Helper to auth headers
const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const uazapiClient = {
    // Create a new instance
    createInstance: async (instanceId: string, clientId: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'create_instance',
                instanceId,
                clientId
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to create instance');
        }
        return response.json();
    },

    // Get QR Code
    getQrCode: async (instanceName: string) => {
        console.log(`[uazapiClient] getQrCode: Requesting for ${instanceName}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
            const response = await fetch(EDGE_FUNCTION_URL, {
                method: 'POST',
                headers: await getAuthHeaders(),
                body: JSON.stringify({
                    action: 'get_qrcode',
                    instanceName
                }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const err = await response.json();
                console.error('[uazapiClient] getQrCode: API Error', err);
                throw new Error(err.error || 'Failed to get QR code');
            }

            const data = await response.json();
            console.log('[uazapiClient] getQrCode: Success', { hasQr: !!data.qrcode });
            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('[uazapiClient] getQrCode: Network/Exec Error', error);
            throw error;
        }
    },

    // Disconnect
    disconnectInstance: async (instanceName: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'disconnect_instance',
                instanceName
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to disconnect');
        }
        return response.json();
    },

    // Delete
    deleteInstance: async (instanceName: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'delete_instance',
                instanceName
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete instance');
        }
        return response.json();
    },

    // Get Connection Status
    getConnectionStatus: async (instanceName: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'get_connection_status',
                instanceName
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to get status');
        }
        return response.json();
    },

    // Import Existing Instance (webhook-only mode)
    importInstance: async (instanceName: string, instanceToken: string, clientId: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'import_instance',
                instanceName,
                instanceToken,
                clientId
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to import instance');
        }
        return response.json();
    },

    // Start a new conversation (creates lead if needed)
    startConversation: async (phoneNumber: string, text: string, instanceName: string, clientId: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'start_conversation',
                phoneNumber,
                text,
                instanceName,
                clientId
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao iniciar conversa');
        }
        return response.json();
    },

    // Send Text Message
    sendTextMessage: async (instanceName: string, phoneNumber: string, text: string, clientId: string, leadId: string, userId?: string) => {
        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: await getAuthHeaders(),
            body: JSON.stringify({
                action: 'send_text_message',
                instanceName,
                phoneNumber,
                text,
                clientId,
                leadId,
                userId
            })
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Falha ao enviar mensagem');
        }
        return response.json();
    }
};
