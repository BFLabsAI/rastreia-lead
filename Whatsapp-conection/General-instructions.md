Documentação Técnica - Instâncias, QR Code, Webhooks e Leads
Focado em: conexão, gerenciamento de instâncias e processamento de leads. Exclui: QStash, campanhas e envio de mensagens.

📂 Arquivos Envolvidos
Frontend
Arquivo	Função
src/services/uazapiClient.ts
Cliente UazAPI
src/store/disparadorStore.ts
Estado (apenas instâncias)
src/components/disparador/InstanceManager.tsx
Gerenciador UI
src/components/disparador/InstanceCard.tsx
Card de instância
src/components/disparador/QrDialog.tsx
Modal QR Code
Edge Functions
Arquivo	Função
supabase/functions/uazapi_proxy_dispara_lead_saas	Proxy UazAPI
supabase/functions/webhook_connection_dispara_lead_saas	Webhook conexão
supabase/functions/webhook_messages_dispara_lead_saas	Webhook mensagens/leads
Banco de Dados
Tabela	Função
instances_dispara_lead_saas_02	Instâncias WhatsApp
contacts_dispara_lead_saas_02	Contatos/Leads
messages_dispara_lead_saas_02	Histórico de chat
uazapi_logs_dispara_lead_saas_02	Logs de debug
1. CLIENTE FRONTEND
uazapiClient.ts
Caminho: src/services/uazapiClient.ts

import { supabase } from "./supabaseClient";
// Invoca Edge Function como proxy
async function invokeProxy(action: string, params: any = {}) {
  const { data, error } = await supabase.functions.invoke('uazapi_proxy_dispara_lead_saas', {
    body: { action, ...params }
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}
// CRIAR INSTÂNCIA
export const createInstance = async (instanceName: string, tenant_id: string) => {
  return await invokeProxy('create_instance', { instanceName, tenant_id });
};
// DELETAR INSTÂNCIA
export const deleteInstance = async (instanceName: string, tenant_id: string) => {
  return await invokeProxy('delete_instance', { instanceName, tenant_id });
};
// DESCONECTAR (mantém instância, desconecta WhatsApp)
export const disconnectInstanceClient = async (instanceName: string) => {
  return await invokeProxy('disconnect_instance', { instanceName });
};
// GERAR QR CODE
export const generateQrCode = async (instanceName: string) => {
  const data = await invokeProxy('get_qrcode', { instanceName });
  return {
    ...data,
    qrCode: data.qrcode || data.base64 || data.qr || data.instance?.qrcode
  };
};
// VERIFICAR STATUS DE CONEXÃO
export const getConnectionStatus = async (instanceName: string, ensureWebhooks = false) => {
  return await invokeProxy('get_connection_status', { instanceName, ensure_webhooks: ensureWebhooks });
};
2. STORE (Estado)
disparadorStore.ts (funções relevantes)
Caminho: src/store/disparadorStore.ts

import { create } from 'zustand';
import { generateQrCode, disconnectInstanceClient, getConnectionStatus } from '../services/uazapiClient';
import { supabase } from '../services/supabaseClient';
interface Instance {
  name: string;
  connectionStatus: string; // disconnected | connecting | connected
}
interface DisparadorState {
  instances: Instance[];
  isLoading: boolean;
  qrCode: string | null;
  qrTimestamp: number | null;
  isQrDialogOpen: boolean;
  qrInstance: string | null;
  
  loadInstances: () => Promise<void>;
  syncInstances: () => Promise<void>;
  fetchQrCode: (instanceName: string, forceNew?: boolean) => Promise<void>;
  disconnectInstance: (instanceName: string) => Promise<void>;
  checkQrInstanceStatus: (instanceName: string) => Promise<void>;
  closeQrDialog: () => void;
  resetQr: () => void;
}
export const useDisparadorStore = create<DisparadorState>((set, get) => ({
  instances: [],
  isLoading: false,
  qrCode: null,
  qrTimestamp: null,
  isQrDialogOpen: false,
  qrInstance: null,
  // CARREGAR INSTÂNCIAS DO BANCO
  loadInstances: async () => {
    set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");
      const { data: userData } = await supabase
        .from('users_dispara_lead_saas_02')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      const { data: dbInstances } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('instance_name, status')
        .eq('tenant_id', userData.tenant_id)
        .order('instance_name', { ascending: true });
      const formattedInstances = (dbInstances || []).map(inst => ({
        name: inst.instance_name,
        connectionStatus: inst.status || 'disconnected'
      }));
      set({ instances: formattedInstances });
    } finally {
      set({ isLoading: false });
    }
  },
  // SINCRONIZAR STATUS VIA API
  syncInstances: async () => {
    set({ isLoading: true });
    try {
      const { instances } = get();
      
      // Chama API para cada instância
      await Promise.all(instances.map(async (inst) => {
        try {
          await getConnectionStatus(inst.name, false);
        } catch (e) {
          console.error(`Failed to sync ${inst.name}:`, e);
        }
      }));
      // Recarrega do banco atualizado
      await get().loadInstances();
    } finally {
      set({ isLoading: false });
    }
  },
  // BUSCAR QR CODE
  fetchQrCode: async (instanceName, forceNew = false) => {
    set({ qrInstance: instanceName, isQrDialogOpen: true, qrCode: null });
    try {
      // Se forçar novo, desconecta primeiro
      if (forceNew) {
        await get().disconnectInstance(instanceName);
        await new Promise(r => setTimeout(r, 5000));
      }
      const data = await generateQrCode(instanceName);
      if (data.qrCode) {
        set({ qrCode: data.qrCode, qrTimestamp: Date.now() });
      } else {
        // Pode já estar conectado
        const status = data.instance?.status;
        if (status === 'connected' || status === 'open') {
          set({ isQrDialogOpen: false });
          get().loadInstances();
        }
      }
    } catch (error) {
      console.error("Erro ao buscar QR Code:", error);
      set({ qrCode: null });
    }
  },
  // DESCONECTAR INSTÂNCIA
  disconnectInstance: async (instanceName) => {
    try {
      await disconnectInstanceClient(instanceName);
      await get().loadInstances();
    } catch (error) {
      console.error("Erro ao desconectar:", error);
    }
  },
  // POLLING DE STATUS (para QR Dialog)
  checkQrInstanceStatus: async (instanceName) => {
    try {
      await getConnectionStatus(instanceName, false);
      // Busca QR atualizado do banco
      const { data } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('qrcode, status')
        .eq('instance_name', instanceName)
        .single();
      if (data?.qrcode) {
        set({ qrCode: data.qrcode });
      }
      await get().loadInstances();
    } catch (e) {
      console.error(`Failed to check status:`, e);
    }
  },
  closeQrDialog: () => set({ isQrDialogOpen: false }),
  resetQr: () => set({ qrCode: null, qrInstance: null, qrTimestamp: null, isQrDialogOpen: false }),
}));
3. COMPONENTES UI
InstanceManager.tsx
Caminho: src/components/disparador/InstanceManager.tsx

Função: Tela principal de gerenciamento.

import { useDisparadorStore } from "../../store/disparadorStore";
import { createInstance } from "@/services/uazapiClient";
import { supabase } from "@/services/supabaseClient";
export const InstanceManager = () => {
  const { instances, isLoading, loadInstances, syncInstances, setInstanceFilter } = useDisparadorStore();
  const [newInstanceName, setNewInstanceName] = useState("");
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    loadInstances();
  }, []);
  // CRIAR NOVA INSTÂNCIA
  const handleCreateInstance = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: userData } = await supabase
        .from('users_dispara_lead_saas_02')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      // Valida limite do plano
      const { data: tenant } = await supabase
        .from('tenants_dispara_lead_saas_02')
        .select('*, plans_dispara_lead_saas_02(*)')
        .eq('id', userData.tenant_id)
        .single();
      const limits = tenant?.plans_dispara_lead_saas_02?.limits || {};
      const maxInstances = limits.instances_limit || 1;
      const { count } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', userData.tenant_id);
      if ((count || 0) >= maxInstances) {
        throw new Error(`Limite de instâncias atingido (${maxInstances})`);
      }
      // Cria via proxy
      await createInstance(newInstanceName, userData.tenant_id);
      loadInstances();
    } finally {
      setCreating(false);
    }
  };
  return (
    <div>
      {/* Filtro + Botão Sincronizar + Botão Nova Instância */}
      {/* Lista de InstanceCard */}
      {/* Modal de Criação */}
      {/* QrDialog */}
    </div>
  );
};
InstanceCard.tsx
Função: Card visual de cada instância.

import { useDisparadorStore } from "../../store/disparadorStore";
export const InstanceCard = ({ instance }) => {
  const { fetchQrCode, disconnectInstance, syncInstances } = useDisparadorStore();
  const isConnected = instance.connectionStatus === "open" || instance.connectionStatus === "connected";
  return (
    <Card>
      <h3>{instance.name}</h3>
      <Badge>{isConnected ? "Ativa" : "Desconectada"}</Badge>
      {isConnected ? (
        <Button onClick={() => disconnectInstance(instance.name)}>Desconectar</Button>
      ) : (
        <Button onClick={() => fetchQrCode(instance.name)}>Conectar</Button>
      )}
      <Button onClick={() => syncInstances()}>Sincronizar</Button>
    </Card>
  );
};
QrDialog.tsx
Função: Modal de QR Code com countdown e auto-close.

import { useDisparadorStore } from "../../store/disparadorStore";
export const QrDialog = () => {
  const { qrCode, qrInstance, qrTimestamp, isQrDialogOpen, fetchQrCode, 
          instances, checkQrInstanceStatus, closeQrDialog } = useDisparadorStore();
  const [countdown, setCountdown] = useState(120);
  const [isExpired, setIsExpired] = useState(false);
  // POLLING para detectar conexão
  useEffect(() => {
    let pollInterval;
    if (isQrDialogOpen && qrInstance) {
      pollInterval = setInterval(() => {
        checkQrInstanceStatus(qrInstance);
      }, 2000); // A cada 2s
    }
    return () => clearInterval(pollInterval);
  }, [isQrDialogOpen, qrInstance]);
  // AUTO-CLOSE quando conecta
  useEffect(() => {
    if (isQrDialogOpen && qrInstance) {
      const currentInst = instances.find(i => i.name === qrInstance);
      if (currentInst?.connectionStatus === 'connected') {
        closeQrDialog();
      }
    }
  }, [instances, qrInstance, isQrDialogOpen]);
  // COUNTDOWN de 120s
  useEffect(() => {
    if (isQrDialogOpen && qrTimestamp) {
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - qrTimestamp) / 1000);
        const remaining = 120 - elapsed;
        
        if (remaining <= 0) {
          setCountdown(0);
          setIsExpired(true);
        } else {
          setCountdown(remaining);
          setIsExpired(false);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isQrDialogOpen, qrTimestamp]);
  return (
    <Dialog open={isQrDialogOpen} onOpenChange={closeQrDialog}>
      <DialogContent>
        <h2>Conectar: {qrInstance}</h2>
        
        {qrCode ? (
          <img src={qrCode} alt="QR Code" className={isExpired ? 'opacity-20' : ''} />
        ) : (
          <Spinner />
        )}
        {!isExpired ? (
          <p>Expira em {countdown}s</p>
        ) : (
          <Button onClick={() => fetchQrCode(qrInstance, true)}>Gerar Novo QR</Button>
        )}
      </DialogContent>
    </Dialog>
  );
};
4. EDGE FUNCTIONS
4.1 uazapi_proxy_dispara_lead_saas
Caminho: supabase/functions/uazapi_proxy_dispara_lead_saas/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
const UAZAPI_TOKEN = Deno.env.get('UAZAPI_TOKEN');      // Admin token
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
serve(async (req) => {
    // Autenticação JWT
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response('Unauthorized', { status: 401 });
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
    }
    return new Response(JSON.stringify(result), { status: 200 });
});
// ========== FUNÇÕES ==========
async function createInstance({ instanceName, tenant_id }) {
    // 1. Chama UazAPI
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/init`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'admintoken': UAZAPI_TOKEN
        },
        body: JSON.stringify({
            name: instanceName,
            systemName: 'meu-app',
            adminField01: tenant_id
        })
    });
    const data = await response.json();
    // 2. Salva no banco
    await supabase.from('instances_dispara_lead_saas_02').insert({
        tenant_id,
        instance_name: instanceName,
        token: data.token,
        status: 'disconnected',
        metadata: data
    });
    // 3. Registra webhooks
    await ensureWebhooks(instanceName, data.token);
    return data;
}
async function ensureWebhooks(instanceName, token) {
    const webhookUrl = `${SUPABASE_URL}/functions/v1`;
    // Webhook de CONEXÃO
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
    // Webhook de MENSAGENS
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
    // 1. Busca do banco
    const { data: instance } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('token, qrcode, qrcode_generated_at, status')
        .eq('instance_name', instanceName)
        .single();
    // 2. Cache: Se QR < 2 min, retorna
    if (instance.qrcode && instance.qrcode_generated_at) {
        const diffMs = Date.now() - new Date(instance.qrcode_generated_at).getTime();
        if (diffMs < 120000 && instance.status !== 'connected') {
            return { qrcode: instance.qrcode };
        }
    }
    // 3. Chama API para gerar
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'token': instance.token },
        body: JSON.stringify({ phone: "" })
    });
    const data = await response.json();
    // 4. Extrai QR
    const qrcode = data.base64 || data.qrcode || data.qr || data.instance?.qrcode;
    // 5. Salva no banco
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
    // Chama API
    const response = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
        method: 'GET',
        headers: { 'token': instance.token }
    });
    const data = await response.json();
    // Normaliza status
    let status = 'disconnected';
    const raw = data.instance?.status || data.status;
    if (raw === 'open' || raw === 'connected') status = 'connected';
    else if (raw === 'connecting') status = 'connecting';
    // Atualiza banco
    await supabase.from('instances_dispara_lead_saas_02').update({
        status,
        last_connected_at: status === 'connected' ? new Date().toISOString() : undefined
    }).eq('instance_name', instanceName);
    // Garante webhooks se solicitado
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
        headers: { 'admintoken': UAZAPI_TOKEN }
    });
    await supabase.from('instances_dispara_lead_saas_02')
        .delete()
        .eq('instance_name', instanceName)
        .eq('tenant_id', tenant_id);
    return { success: true };
}
4.2 webhook_connection_dispara_lead_saas
Caminho: supabase/functions/webhook_connection_dispara_lead_saas/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const supabase = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
);
serve(async (req) => {
    const payload = await req.json();
    const event = payload.event || payload.EventType;
    const instanceName = payload.instance?.name || payload.instanceName;
    const rawStatus = payload.data?.status || payload.data?.state;
    // Processa apenas eventos de conexão
    const isConnectionEvent = ['connection', 'CONNECTION_UPDATE', 'connection.update'].includes(event);
    if (isConnectionEvent && instanceName) {
        // Normaliza status
        let status = 'disconnected';
        if (rawStatus === 'open' || rawStatus === 'connected') status = 'connected';
        else if (rawStatus === 'connecting') status = 'connecting';
        else if (rawStatus === 'close') status = 'disconnected';
        // Atualiza banco
        await supabase.from('instances_dispara_lead_saas_02').update({
            status,
            last_connected_at: status === 'connected' ? new Date().toISOString() : undefined,
            qrcode: status === 'connected' ? null : undefined // Limpa QR se conectou
        }).eq('instance_name', instanceName);
    }
    return new Response(JSON.stringify({ received: true }), { status: 200 });
});
4.3 webhook_messages_dispara_lead_saas
Caminho: supabase/functions/webhook_messages_dispara_lead_saas/index.ts

Função: Processa mensagens recebidas e atualiza leads/contatos.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const UAZAPI_BASE_URL = Deno.env.get('UAZAPI_BASE_URL');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
serve(async (req) => {
    const payload = await req.json();
    
    const eventType = payload.EventType || payload.event;
    const instanceName = payload.instanceName || payload.instance;
    const message = payload.message || payload.data;
    // Verifica se é evento de mensagem
    const isMessageEvent = ['messages', 'messages.upsert', 'MESSAGES_UPSERT'].includes(eventType);
    if (!isMessageEvent || !message) {
        return new Response('OK', { status: 200 });
    }
    // 1. Busca tenant da instância
    const { data: instance } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('id, tenant_id, token')
        .eq('instance_name', instanceName)
        .single();
    if (!instance) {
        return new Response('Instance not found', { status: 200 });
    }
    // 2. Extrai dados da mensagem
    const isFromMe = message.fromMe || message.key?.fromMe;
    const phone = (message.key?.remoteJid || message.chatid || '').split('@')[0];
    const pushName = payload.chat?.name || message.pushName || '';
    const messageType = message.messageType || message.type || 'text';
    const messageId = message.key?.id || message.id;
    const textContent = message.text || message.conversation || '';
    // 3. Extrai mídia (se houver)
    let mediaUrl = null;
    const content = message.content || message.message?.content;
    
    if (content && typeof content === 'object') {
        mediaUrl = content.base64 || content.url || content.mediaUrl || 
                   content.JPEGThumbnail || content.image;
    }
    // Fallback: tenta download de alta qualidade
    const isMedia = ['image', 'video', 'audio', 'ImageMessage', 'VideoMessage'].includes(messageType);
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
            console.error('Download error:', e);
        }
    }
    // 4. UPSERT CONTATO (Lead)
    const { data: contact } = await supabase
        .from('contacts_dispara_lead_saas_02')
        .upsert({
            tenant_id: instance.tenant_id,
            phone: phone,
            name: pushName || null,
            last_message_at: new Date().toISOString()
        }, { onConflict: 'tenant_id, phone' })
        .select('id')
        .maybeSingle();
    // 5. UPSERT MENSAGEM
    await supabase.from('messages_dispara_lead_saas_02').upsert({
        tenant_id: instance.tenant_id,
        instance_id: instance.id,
        contact_id: contact?.id || null,
        uazapi_message_id: messageId,
        direction: isFromMe ? 'outbound' : 'inbound',
        message_type: messageType,
        content: textContent,
        media_url: mediaUrl,
        sender_name: pushName || null,
        sent_at: new Date().toISOString()
    }, { onConflict: 'uazapi_message_id' });
    return new Response(JSON.stringify({ received: true }), { status: 200 });
});
5. DATABASE SCHEMA
-- =============================================
-- INSTÂNCIAS WHATSAPP
-- =============================================
CREATE TABLE instances_dispara_lead_saas_02 (
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
-- RLS Policy
ALTER TABLE instances_dispara_lead_saas_02 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON instances_dispara_lead_saas_02
FOR ALL USING (tenant_id = (SELECT tenant_id FROM users_dispara_lead_saas_02 WHERE id = auth.uid()));
-- =============================================
-- CONTATOS / LEADS
-- =============================================
CREATE TABLE contacts_dispara_lead_saas_02 (
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
-- RLS Policy
ALTER TABLE contacts_dispara_lead_saas_02 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON contacts_dispara_lead_saas_02
FOR ALL USING (tenant_id = (SELECT tenant_id FROM users_dispara_lead_saas_02 WHERE id = auth.uid()));
-- =============================================
-- MENSAGENS (HISTÓRICO DE CHAT)
-- =============================================
CREATE TABLE messages_dispara_lead_saas_02 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    instance_id uuid REFERENCES instances_dispara_lead_saas_02(id),
    contact_id uuid REFERENCES contacts_dispara_lead_saas_02(id),
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
-- RLS Policy
ALTER TABLE messages_dispara_lead_saas_02 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant isolation" ON messages_dispara_lead_saas_02
FOR ALL USING (tenant_id = (SELECT tenant_id FROM users_dispara_lead_saas_02 WHERE id = auth.uid()));
-- =============================================
-- LOGS DE API (DEBUG)
-- =============================================
CREATE TABLE uazapi_logs_dispara_lead_saas_02 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text,
    request_payload jsonb,
    response_payload jsonb,
    status_code integer,
    created_at timestamptz DEFAULT now()
);
6. FLUXO VISUAL
┌────────────────────────────────────────────────────────────────┐
│                      CRIAR INSTÂNCIA                            │
├────────────────────────────────────────────────────────────────┤
│ UI: InstanceManager.tsx                                         │
│   └─▶ createInstance() [uazapiClient.ts]                        │
│       └─▶ invoke('create_instance') [Edge Function]             │
│           ├─▶ POST /instance/init [UazAPI]                      │
│           ├─▶ INSERT instances [Supabase]                       │
│           └─▶ ensureWebhooks()                                  │
│               ├─▶ POST /webhook [connection]                    │
│               └─▶ POST /webhook [messages]                      │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│                      GERAR QR CODE                              │
├────────────────────────────────────────────────────────────────┤
│ UI: InstanceCard.tsx [Clica "Conectar"]                         │
│   └─▶ fetchQrCode() [disparadorStore]                           │
│       └─▶ generateQrCode() [uazapiClient]                       │
│           └─▶ invoke('get_qrcode') [Edge Function]              │
│               ├─▶ SELECT instances (cache check)                │
│               ├─▶ POST /instance/connect [UazAPI]               │
│               └─▶ UPDATE instances (qrcode)                     │
│                                                                 │
│ UI: QrDialog.tsx                                                │
│   └─▶ Polling a cada 2s via checkQrInstanceStatus()             │
│       └─▶ Detecta conexão → Auto-close                          │
│                                                                 │
│ [UazAPI] ─webhook─▶ webhook_connection                          │
│   └─▶ UPDATE instances.status = 'connected'                     │
└────────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────┐
│                   RECEBER MENSAGEM (LEAD)                       │
├────────────────────────────────────────────────────────────────┤
│ [UazAPI] ─webhook─▶ webhook_messages                            │
│   ├─▶ SELECT instances (busca tenant)                           │
│   ├─▶ UPSERT contacts (novo lead ou atualiza)                   │
│   └─▶ UPSERT messages (salva histórico)                         │
│                                                                 │
│ UI: ChatsPage.tsx                                               │
│   └─▶ Exibe contatos e mensagens em tempo real                  │
└────────────────────────────────────────────────────────────────┘
7. SECRETS NECESSÁRIOS
# Supabase Edge Functions
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
# UazAPI
UAZAPI_BASE_URL=https://xxx.uazapi.com
UAZAPI_TOKEN=xxx                         # Token admin
# Frontend (.env)
VITE_SUPABASE_URL=xxx
VITE_SUPABASE_ANON_KEY=xxx
