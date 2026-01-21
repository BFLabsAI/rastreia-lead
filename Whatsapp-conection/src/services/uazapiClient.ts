import { supabase } from "./supabaseClient";

export interface UazapiInstance {
  name: string;
  status: string;
}

// Helper to invoke the proxy function
async function invokeProxy(action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke('uazapi_proxy_dispara_lead_saas', {
    body: { action, ...params }
  });

  if (error) throw new Error(error.message || 'Error invoking UazAPI Proxy');
  if (data?.error) throw new Error(data.error);

  return data;
}

export const createInstance = async (instanceName: string, tenant_id: string) => {
  return await invokeProxy('create_instance', { instanceName, tenant_id });
};

export const deleteInstance = async (instanceName: string, tenant_id: string) => {
  return await invokeProxy('delete_instance', { instanceName, tenant_id });
};

export const disconnectInstanceClient = async (instanceName: string) => {
  return await invokeProxy('disconnect_instance', { instanceName });
};

export const generateQrCode = async (instanceName: string) => {
  const data = await invokeProxy('get_qrcode', { instanceName });
  // Proxy returns { qrcode: 'base64...' } OR the full UazAPI response object
  return {
    ...data,
    qrCode: data.qrcode || data.base64 || data.qr || data.instance?.qrcode
  };
};



export const sendTextMessage = async (params: {
  instanceName: string;
  number: string;
  text: string;
}) => {
  return await invokeProxy('send_message', params);
};

export const sendMediaMessage = async (params: {
  instanceName: string;
  number: string;
  mediatype: string;
  media: string; // Base64 or URL
  caption?: string;
}) => {
  return await invokeProxy('send_media', {
    instanceName: params.instanceName,
    number: params.number,
    mediaType: params.mediatype,
    mediaUrl: params.media,
    caption: params.caption
  });
};

// Instances are fetched directly from the database in the store/components.
// No need to fetch list from UazAPI.

export const getConnectionStatus = async (instanceName: string, ensureWebhooks = false) => {
  return await invokeProxy('get_connection_status', { instanceName, ensure_webhooks: ensureWebhooks });
};