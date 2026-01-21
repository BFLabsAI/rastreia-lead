import { create } from 'zustand';
import { showSuccess, showError } from '../utils/toast';
import * as XLSX from "xlsx";
import {
  generateQrCode,
  disconnectInstanceClient,
} from '../services/uazapiClient';
import { uploadFileToSupabase } from '../services/supabaseStorage';
import { supabase, SUPABASE_URL } from '../services/supabaseClient';
import { useAdminStore } from './adminStore';

interface Instance {
  name: string;
  connectionStatus: string;
}

type Contact = Record<string, any>;

interface MessageTemplate {
  type: 'texto' | 'imagem' | 'video' | 'audio';
  text: string;
  mediaUrl?: string;
}

interface DisparadorState {
  instances: Instance[];
  filteredInstances: Instance[];
  isLoading: boolean;
  qrCode: string | null;
  qrTimestamp: number | null;
  isQrDialogOpen: boolean;
  qrInstance: string | null;
  contatos: Contact[];
  interromper: boolean;
  instanceFilter: string;
  disconnectingInstance: string | null;

  syncInstances: (silent?: boolean) => Promise<void>;
  checkQrInstanceStatus: (instanceName: string) => Promise<void>;
  loadInstances: (silent?: boolean) => Promise<void>;
  disconnectInstance: (instanceName: string) => Promise<void>;
  fetchQrCode: (instanceName: string, forceNew?: boolean) => Promise<void>;
  closeQrDialog: () => void;
  resetQr: () => void;
  setContatos: (contatos: Contact[]) => void;
  setInstanceFilter: (filter: string) => void;
  uploadFile: (file: File) => Promise<{ contatos: Contact[]; variables: string[] }>;
  mediaUpload: (file: File) => Promise<string | null>;
  sendMessages: (params: {
    contatos: Contact[];
    instances: string[];
    tempoMin: number;
    tempoMax: number;
    usarIA: boolean;
    templates: MessageTemplate[];
    campaignName: string;
    publicTarget: string;
    content: string;
    scheduledFor?: string;
  }) => Promise<{ sucessos: number; erros: number; log: string }>;
  sendAdvancedCampaign: (params: {
    contatos: Contact[];
    instances: string[];
    tempoMin: number;
    tempoMax: number;
    templates: MessageTemplate[];
    campaignName: string;
    publicTarget: string;
    content: string;
    scheduledFor?: string;
  }) => Promise<{ sucessos: number; erros: number; log: string }>;
  stopSending: () => void;
  scheduleCampaign: (params: {
    campaignGroupId: string;
    dispatchOrder: number;
    campaignName: string;
    publicTarget: string;
    content: string;
    contatos: Contact[];
    instances: string[];
    templates: MessageTemplate[];
    tempoMin: number;
    tempoMax: number;
    usarIA: boolean;
    horaAgendamento: string;
  }) => Promise<void>;
  reprocessCampaign: (campaignId: string, newConfig: {
    use_ai: boolean;
    messages: MessageTemplate[];
  }) => Promise<void>;
}

export const useDisparadorStore = create<DisparadorState>((set, get) => ({
  instances: [],
  filteredInstances: [],
  isLoading: false,
  qrCode: null,
  qrTimestamp: null,
  isQrDialogOpen: false,
  qrInstance: null,
  contatos: [],
  interromper: false,
  instanceFilter: '',
  disconnectingInstance: null,

  resetQr: () => {
    set({ qrCode: null, qrInstance: null, qrTimestamp: null, isQrDialogOpen: false });
  },

  closeQrDialog: () => {
    set({ isQrDialogOpen: false });
  },

  loadInstances: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userData } = await supabase
        .from('users_dispara_lead_saas_02')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) {
        console.error("Tenant ID not found for user:", user.id);
        throw new Error("Tenant não encontrado");
      }

      let targetTenantId = userData.tenant_id;
      const { data: isSuper } = await supabase.rpc('is_super_admin');
      const impersonatedId = useAdminStore.getState().impersonatedTenantId;

      if (isSuper && impersonatedId) {
        targetTenantId = impersonatedId;
      } else if (impersonatedId && !isSuper) {
        console.warn("Clearing stale admin state for regular user");
        useAdminStore.getState().setImpersonatedTenantId(null);
        useAdminStore.getState().setAdminTenantId(null);
      }

      const { data: dbInstances, error: dbError } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('instance_name, status')
        .eq('tenant_id', targetTenantId)
        .order('instance_name', { ascending: true });

      if (dbError) {
        console.error("Error fetching instances from DB:", dbError);
      }

      if (!dbInstances || dbInstances.length === 0) {
        set({ instances: [], filteredInstances: [] });
        return;
      }

      const formattedInstances = dbInstances.map(dbInst => ({
        name: dbInst.instance_name,
        connectionStatus: dbInst.status || 'disconnected'
      }));

      set({
        instances: formattedInstances,
        filteredInstances: formattedInstances
      });
    } catch (error) {
      showError("Erro ao carregar instâncias: " + (error as Error).message);
      set({ instances: [], filteredInstances: [] });
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  syncInstances: async (silent = false) => {
    if (!silent) set({ isLoading: true });
    try {
      const { instances } = get();
      if (!instances.length) {
        await get().loadInstances(silent);
        const { instances: updatedList } = get();
        if (!updatedList.length) {
          if (!silent) set({ isLoading: false });
          return;
        }
      }

      const { getConnectionStatus } = await import('../services/uazapiClient');
      const syncPromises = get().instances.map(async (inst) => {
        try {
          await getConnectionStatus(inst.name, false);
        } catch (e) {
          console.error(`Failed to sync ${inst.name}:`, e);
        }
      });

      await Promise.all(syncPromises);
      await get().loadInstances(silent);
      if (!silent) showSuccess("Instâncias sincronizadas.");

    } catch (error) {
      if (!silent) showError("Erro ao sincronizar: " + (error as Error).message);
    } finally {
      if (!silent) set({ isLoading: false });
    }
  },

  checkQrInstanceStatus: async (instanceName: string) => {
    try {
      const { getConnectionStatus } = await import('../services/uazapiClient');
      await getConnectionStatus(instanceName, false);

      const { data } = await supabase
        .from('instances_dispara_lead_saas_02')
        .select('qrcode, status')
        .eq('instance_name', instanceName)
        .single();

      if (data?.qrcode) {
        set({ qrCode: data.qrcode });
      }

      await get().loadInstances(true);
    } catch (e) {
      console.error(`Failed to check status for ${instanceName}:`, e);
    }
  },

  fetchQrCode: async (instanceName: string, forceNew = false) => {
    const { qrCode: oldQr, qrInstance: oldInstance, qrTimestamp: oldTimestamp } = get();

    if (oldInstance !== instanceName || forceNew) {
      set({ qrInstance: instanceName, isQrDialogOpen: true, qrCode: null, qrTimestamp: null });
    } else {
      set({ qrInstance: instanceName, isQrDialogOpen: true });
    }

    try {
      if (forceNew) {
        try {
          await get().disconnectInstance(instanceName);
          await new Promise(r => setTimeout(r, 5000));
        } catch (e) {
          console.warn("Force disconnect failed (ignoring):", e);
        }
      }

      const data = await generateQrCode(instanceName);

      if (data.qrCode) {
        const newQr = data.qrCode;
        let newTimestamp = Date.now();
        if (oldQr === newQr && oldInstance === instanceName && oldTimestamp) {
          const age = Date.now() - oldTimestamp;
          if (age < 120000) {
            newTimestamp = oldTimestamp;
          }
        }
        set({ qrCode: newQr, qrTimestamp: newTimestamp });
      } else {
        const responseFn = data as any;
        let status = responseFn.instance?.status || responseFn.instance?.state;

        if (!status && typeof responseFn.status === 'string') {
          status = responseFn.status;
        }

        if (status === 'connected' || status === 'open') {
          showSuccess("Instância já conectada!");
          set({ isQrDialogOpen: false });
          get().loadInstances(true);
        } else if (status === 'connecting') {
          const potentialQr = responseFn.qrcode || responseFn.base64 || responseFn.qr || responseFn.instance?.qrcode;

          if (potentialQr) {
            console.log("Found QR code in connecting state, updating...");
            set({ qrCode: potentialQr, qrTimestamp: Date.now(), isQrDialogOpen: true });
          } else {
            if (!get().qrCode) {
              set({ qrCode: null, qrTimestamp: null, isQrDialogOpen: true });
            }
          }
          showSuccess("Instância iniciando... Aguarde.");
        } else {
          set({ qrCode: null, qrTimestamp: null });
          const statusDisplay = status || (typeof responseFn.status === 'object' ? JSON.stringify(responseFn.status) : responseFn.status) || 'unknown';
          showError("Erro: " + (responseFn.message || `Não foi possível gerar QR Code (Status: ${statusDisplay})`));
        }
      }
    } catch (error) {
      showError("Erro ao buscar QR Code: " + (error as Error).message);
      set({ qrCode: null });
    }
  },

  disconnectInstance: async (instanceName: string) => {
    set({ disconnectingInstance: instanceName });
    try {
      await disconnectInstanceClient(instanceName);
      showSuccess("Instância desconectada.");
      await get().loadInstances(true);
    } catch (error) {
      showError("Erro ao desconectar: " + (error as Error).message);
    } finally {
      set({ disconnectingInstance: null });
      if (get().qrInstance === instanceName) {
        get().resetQr();
      }
    }
  },

  uploadFile: async (file: File) => {
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const header = (arr.shift() as string[]).map((h: string) => String(h).trim());
      const rows = arr as Contact[][];
      const phoneField = header.find((h: string) => h.toLowerCase().includes("telefone")) || header[0];
      const contatos: Contact[] = [];
      const extractPhones = (raw: string) =>
        String(raw || "")
          .split(",")
          .map((p) => p.replace(/\D/g, ""))
          .filter((n) => n.length >= 10)
          .map((n) => (n.length <= 11 ? "55" + n : n.length === 12 && !n.startsWith("55") ? "55" + n : n));
      rows.forEach((r) => {
        const obj: Contact = {};
        header.forEach((h, i) => (obj[h] = r[i] || ""));
        extractPhones(obj[phoneField]).forEach((num) => contatos.push({ ...obj, telefone: num }));
      });
      const variables = header.filter((h: string) => h !== phoneField);
      set({ contatos });
      showSuccess(`${contatos.length} contatos carregados.`);
      return { contatos, variables };
    } catch (error) {
      showError("Erro ao processar arquivo: " + (error as Error).message);
      return { contatos: [], variables: [] };
    }
  },

  mediaUpload: async (file: File) => {
    try {
      const result = await uploadFileToSupabase(file);
      if (result.fileUrl) {
        showSuccess("Upload concluído!");
        return result.fileUrl;
      }
      throw new Error("URL do arquivo não encontrada.");
    } catch (error) {
      showError("Falha no upload: " + (error as Error).message);
      return null;
    }
  },

  sendMessages: async (params) => {
    const { contatos, instances, tempoMin, tempoMax, templates, campaignName, publicTarget, content, scheduledFor, usarIA } = params as any;
    set({ isLoading: true });

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userData } = await supabase
        .from('users_dispara_lead_saas_02')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

      if (!userData?.tenant_id) throw new Error("Tenant não encontrado");

      let targetTenantId = userData.tenant_id;
      const { data: isSuper } = await supabase.rpc('is_super_admin');
      const impersonatedId = useAdminStore.getState().impersonatedTenantId;

      if (isSuper && impersonatedId) {
        targetTenantId = impersonatedId;
      }

      const finalCampaignName = campaignName || `Disparo Rápido ${new Date().toLocaleTimeString()}`;

      const { data: campaign, error: campaignError } = await supabase
        .from('campaigns_dispara_lead_saas_02')
        .insert({
          tenant_id: targetTenantId,
          user_id: user.id,
          name: finalCampaignName,
          target_audience: publicTarget || "Lista Manual",
          creative: content || (templates[0]?.text || "Conteúdo Variável"),
          status: 'pending',
          total_messages: contatos.length * templates.length,
          instances: instances,
          delay_min: tempoMin,
          delay_max: tempoMax,
          is_scheduled: !!scheduledFor,
          scheduled_for: scheduledFor || null,
          media_url: templates[0]?.mediaUrl || null,
          media_type: (templates[0]?.type && templates[0]?.type !== 'texto') ? templates[0]?.type : null,
          content_configuration: {
            use_ai: usarIA || false,
            messages: templates.map((t: any) => ({
              type: t.type,
              content: t.text, // Persist original including variables like {name}
              mediaUrl: t.mediaUrl
            }))
          }
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const messagesToEnqueue: any[] = [];
      const logsToInsert: any[] = [];
      const baseTime = scheduledFor ? new Date(scheduledFor).getTime() : Date.now();
      let accumulatedDelay = 0;

      for (let i = 0; i < contatos.length; i++) {
        const contact = contatos[i];
        const instanceName = instances[i % instances.length];

        for (const template of templates) {
          let personalizedText = template.text;
          personalizedText = personalizedText.replace(/@(\w+)/g, (_: string, key: string) => {
            const fullValue = contact[key] || "";
            if (key === 'nome' || key === 'name') {
            }
            return fullValue;
          });

          const messageId = crypto.randomUUID();
          const randomDelay = Math.floor(Math.random() * (tempoMax - tempoMin + 1) + tempoMin) * 1000;
          accumulatedDelay += randomDelay;
          const deliveryTime = baseTime + accumulatedDelay;
          const deliveryDate = new Date(deliveryTime).toISOString();

          const hasText = personalizedText && personalizedText.trim().length > 0;
          const shouldUseAI = usarIA && hasText;

          logsToInsert.push({
            id: messageId,
            tenant_id: targetTenantId,
            campaign_id: campaign.id,
            instance_name: instanceName,
            phone_number: contact.telefone,
            message_content: personalizedText,
            status: 'queued',
            scheduled_for: deliveryDate,
            created_at: new Date().toISOString(),
            campaign_name: finalCampaignName,
            campaign_type: scheduledFor ? 'Agendada' : 'Imediata',
            message_type: template.type || 'texto',
            metadata: {
              publico: publicTarget,
              criativo: content,
              contact_data: contact // Snapshot for reprocessing
            },
            media_url: template.mediaUrl || null
          });

          const qstashPayload: any = {
            messageId,
            phoneNumber: contact.telefone,
            messageContent: personalizedText,
            instanceName,
            instanceToken: undefined,
            campaignId: campaign.id,
            tenantId: targetTenantId,
            mediaUrl: template.mediaUrl,
            mediaType: template.type !== 'texto' ? template.type : undefined,
            notBefore: Math.floor(deliveryTime / 1000),
            destinationUrl: shouldUseAI
              ? `${SUPABASE_URL}/functions/v1/process-message-ai`
              : undefined
          };

          messagesToEnqueue.push(qstashPayload);
        }
      }

      const { error: logsError } = await supabase
        .from('message_logs_dispara_lead_saas_03')
        .insert(logsToInsert);

      if (logsError) throw logsError;

      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const { data: enqueueData, error: enqueueError } = await supabase.functions.invoke('enqueue-campaign', {
        body: { messages: messagesToEnqueue },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (enqueueError) {
        throw new Error(`Erro network Edge Function: ${enqueueError.message}`);
      }

      if (enqueueData && enqueueData.success === false) {
        console.error("QStash Debug Error:", enqueueData);
        throw new Error(`QStash Error: ${enqueueData.error} (Stage: ${enqueueData.stage})`);
      }

      console.log("Enqueue result:", enqueueData);

      await supabase
        .from('campaigns_dispara_lead_saas_02')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', campaign.id);

      showSuccess(`Campanha iniciada! ${messagesToEnqueue.length} mensagens enfileiradas.`);
      return { sucessos: messagesToEnqueue.length, erros: 0, log: "Enfileirado via QStash" };

    } catch (error) {
      console.error("Erro ao enviar campanha avançada:", error);
      showError("Falha ao iniciar campanha: " + (error as Error).message);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  sendAdvancedCampaign: async (params) => {
    return get().sendMessages({ ...params, usarIA: false });
  },

  setContatos: (contatos: Contact[]) => set({ contatos }),
  setInstanceFilter: (filter: string) => set({ instanceFilter: filter }),
  stopSending: () => set({ interromper: true, isLoading: false }),

  scheduleCampaign: async (params) => {
    const { horaAgendamento, ...rest } = params;
    await get().sendMessages({
      ...rest,
      scheduledFor: horaAgendamento
    });
  },

  reprocessCampaign: async (campaignId, newConfig) => {
    set({ isLoading: true });
    try {
      // 1. Cancel existing QStash messages to prevent duplicates
      const QSTASH_TOKEN = import.meta.env.VITE_QSTASH_TOKEN;
      await fetch(`https://qstash.upstash.io/v2/messages?label=${campaignId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${QSTASH_TOKEN}` }
      });

      // 2. Fetch existing potential contacts (from logs that are not sent/failed)
      const { data: logs, error: fetchError } = await supabase
        .from('message_logs_dispara_lead_saas_03')
        .select('metadata, phone_number, instance_name, tenant_id')
        .eq('campaign_id', campaignId)
        .in('status', ['queued', 'paused', 'pending']);

      if (fetchError) throw fetchError;
      if (!logs || logs.length === 0) {
        showError("Não há mensagens pendentes para reprocessar.");
        return;
      }

      // Distinct contacts
      const contactsMap = new Map();
      logs.forEach(log => {
        if (!contactsMap.has(log.phone_number)) {
          contactsMap.set(log.phone_number, {
            ...log.metadata?.contact_data,
            telefone: log.phone_number, // Ensure phone is present
            instance_name: log.instance_name,
            tenant_id: log.tenant_id
          });
        }
      });
      const contacts = Array.from(contactsMap.values());

      // 3. Update Campaign Config
      const { error: updateError } = await supabase
        .from('campaigns_dispara_lead_saas_02')
        .update({
          content_configuration: newConfig,
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) throw updateError;

      // 4. Delete old logs
      const { error: deleteError } = await supabase
        .from('message_logs_dispara_lead_saas_03')
        .delete()
        .eq('campaign_id', campaignId)
        .in('status', ['queued', 'paused', 'pending']);

      if (deleteError) throw deleteError;

      // 5. Generate New Messages
      const templates = newConfig.messages;
      const messagesToEnqueue: any[] = [];
      const logsToInsert: any[] = [];

      // Use campaign ID as label
      const campaignLabel = campaignId;

      // Fetch Campaign to get generic details like name?
      // We can reuse names/etc from logs/context, but fetching is safer.
      const { data: campaign } = await supabase.from('campaigns_dispara_lead_saas_02').select('name, is_scheduled, scheduled_for').eq('id', campaignId).single();
      const scheduledFor = campaign?.is_scheduled ? campaign?.scheduled_for : null;
      const baseTime = scheduledFor ? new Date(scheduledFor).getTime() : Date.now();
      let accumulatedDelay = 0;

      const tenantId = contacts[0]?.tenant_id; // Assume same tenant
      const instanceName = contacts[0]?.instance_name;

      // Reuse Min/Max delay from ... we don't have it here. 
      // We really should store delay_min/max in campaign table (we DO).
      // Let's fetch delay_min/max from campaign.
      const { data: campSettings } = await supabase
        .from('campaigns_dispara_lead_saas_02')
        .select('delay_min, delay_max, target_audience, creative')
        .eq('id', campaignId)
        .single();

      const tempoMin = campSettings?.delay_min || 2;
      const tempoMax = campSettings?.delay_max || 5;

      for (const contact of contacts) {
        for (const template of templates) {
          let personalizedText = (template as any).content || template.text || ""; // content in newConfig structure
          personalizedText = personalizedText.replace(/@(\w+)/g, (_: string, key: string) => {
            const fullValue = contact[key] || "";
            return fullValue;
          });

          const messageId = crypto.randomUUID();
          const randomDelay = Math.floor(Math.random() * (tempoMax - tempoMin + 1) + tempoMin) * 1000;
          accumulatedDelay += randomDelay;
          const deliveryTime = baseTime + accumulatedDelay;
          const deliveryDate = new Date(deliveryTime).toISOString();

          const hasText = personalizedText && personalizedText.trim().length > 0;
          const shouldUseAI = newConfig.use_ai && hasText;

          logsToInsert.push({
            id: messageId,
            tenant_id: tenantId,
            campaign_id: campaignId,
            instance_name: instanceName,
            phone_number: contact.telefone,
            message_content: personalizedText,
            status: 'queued',
            scheduled_for: deliveryDate,
            created_at: new Date().toISOString(),
            campaign_name: campaign?.name,
            campaign_type: scheduledFor ? 'Agendada' : 'Imediata',
            message_type: template.type || 'texto',
            metadata: {
              publico: campSettings?.target_audience,
              criativo: campSettings?.creative,
              contact_data: contact,
              ai_rewritten: shouldUseAI // Mark as AI candidate
            },
            media_url: template.mediaUrl || null
          });

          const qstashPayload: any = {
            messageId,
            phoneNumber: contact.telefone,
            messageContent: personalizedText,
            instanceName,
            campaignId: campaignId,
            tenantId: tenantId,
            mediaUrl: template.mediaUrl,
            mediaType: template.type !== 'texto' ? template.type : undefined,
            notBefore: Math.floor(deliveryTime / 1000),
            destinationUrl: shouldUseAI
              ? `${SUPABASE_URL}/functions/v1/process-message-ai` // Point to AI function
              : undefined,
            label: campaignLabel
          };

          messagesToEnqueue.push(qstashPayload);
        }
      }

      // 6. Insert Logs
      const { error: insertError } = await supabase
        .from('message_logs_dispara_lead_saas_03')
        .insert(logsToInsert);

      if (insertError) throw insertError;

      // 7. Enqueue
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const { data: enqueueData, error: enqueueError } = await supabase.functions.invoke('enqueue-campaign', {
        body: { messages: messagesToEnqueue },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      if (enqueueError) throw enqueueError;

      // 8. Update Status to processing
      await supabase
        .from('campaigns_dispara_lead_saas_02')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('id', campaignId);

      showSuccess(`Campanha reprocessada! ${messagesToEnqueue.length} novas mensagens geradas.`);

    } catch (error) {
      console.error("Reprocess error:", error);
      showError("Erro ao reprocessar: " + (error as Error).message);
    } finally {
      set({ isLoading: false });
    }
  },
}));