import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { uazapiClient } from '@/services/uazapiClient';
import { toast } from 'sonner';

export interface Instance {
    id: string; // database uuid
    instance_name: string;
    status: 'disconnected' | 'connecting' | 'connected';
    qrcode?: string;
    client_id?: string;
    share_token?: string;
    webhook_only?: boolean;
    metadata?: Record<string, any>;
}

interface DisparadorState {
    instances: Instance[];
    isLoading: boolean;

    // Actions
    loadInstances: (clientId?: string) => Promise<void>;
    createInstance: (name: string, clientId: string) => Promise<void>;
    importInstance: (name: string, token: string, clientId: string) => Promise<boolean>;
    deleteInstance: (name: string) => Promise<void>;
    disconnectInstance: (name: string) => Promise<void>;
    getQrCode: (name: string) => Promise<{ qrcode: string; qrcode_generated_at?: string } | null>;
    getConnectionStatus: (name: string) => Promise<any>;
    subscribeToInstances: (clientId: string) => void;
    generateShareToken: (instanceId: string) => Promise<string | null>;
}

export const useDisparadorStore = create<DisparadorState>((set, get) => ({
    instances: [],
    isLoading: false,

    loadInstances: async (clientId) => {
        set({ isLoading: true });
        try {
            let query = supabase
                .from('instances_clientes_bf_labs')
                .select('*')
                .order('created_at', { ascending: false });

            if (clientId) {
                query = query.eq('client_id', clientId);
            }

            const { data, error } = await query;

            if (error) throw error;

            set({ instances: data || [] });
        } catch (error) {
            console.error('Error loading instances:', error);
            toast.error('Erro ao carregar instâncias');
        } finally {
            set({ isLoading: false });
        }
    },

    createInstance: async (name, clientId) => {
        set({ isLoading: true });
        try {
            await uazapiClient.createInstance(name, clientId);
            toast.success('Instância criada! Gerando QR Code...');
            await get().loadInstances(clientId);
        } catch (error: any) {
            console.error('Error creating instance:', error);
            toast.error(`Erro ao criar instância: ${error.message}`);
        } finally {
            set({ isLoading: false });
        }
    },

    importInstance: async (name, token, clientId) => {
        set({ isLoading: true });
        try {
            await uazapiClient.importInstance(name, token, clientId);
            toast.success('Instância importada com sucesso! Webhooks configurados.');
            await get().loadInstances(clientId);
            return true;
        } catch (error: any) {
            console.error('Error importing instance:', error);
            toast.error(`Erro ao importar instância: ${error.message}`);
            return false;
        } finally {
            set({ isLoading: false });
        }
    },

    deleteInstance: async (name) => {
        // Optimistic update? No, safer to wait.
        try {
            await uazapiClient.deleteInstance(name);
            toast.success('Instância removida');
            // Refresh lists
            const currentInstances = get().instances;
            set({ instances: currentInstances.filter(i => i.instance_name !== name) });
        } catch (error: any) {
            console.error('Error deleting instance:', error);
            toast.error('Erro ao remover instância');
        }
    },

    disconnectInstance: async (name) => {
        try {
            await uazapiClient.disconnectInstance(name);
            toast.success('Instância desconectada');
            // Helper to update local state without full reload if possible, 
            // but status might take a moment to change in DB webhook
            // For now, let's toggle status locally to disconnected
            set(state => ({
                instances: state.instances.map(i =>
                    i.instance_name === name ? { ...i, status: 'disconnected' } : i
                )
            }));
        } catch (error: any) {
            console.error('Error disconnecting:', error);
            toast.error('Erro ao desconectar');
        }
    },

    getQrCode: async (name) => {
        try {
            console.log(`[Store] getQrCode called for ${name}`);
            const res = await uazapiClient.getQrCode(name);
            // If we got a QR code, update the instance in store immediately with it so UI reflects it
            if (res.qrcode) {
                console.log('[Store] Updating instance with new QR');
                set(state => ({
                    instances: state.instances.map(i =>
                        i.instance_name === name ? { ...i, qrcode: res.qrcode, status: 'connecting' } : i
                    )
                }));
                return { qrcode: res.qrcode, qrcode_generated_at: res.qrcode_generated_at };
            }
            console.warn('[Store] No QR code in response');
            return null;
        } catch (error) {
            console.error('[Store] Error fetching QR:', error);
            toast.error('Erro ao carregar QR Code');
            return null;
        }
    },

    getConnectionStatus: async (name) => {
        try {
            const res = await uazapiClient.getConnectionStatus(name);
            // Update store
            if (res.status) {
                set(state => ({
                    instances: state.instances.map(i =>
                        i.instance_name === name ? { ...i, status: res.status } : i
                    )
                }));
            }
            return res;
        } catch (error) {
            console.error('Error fetching status:', error);
            return null;
        }
    },

    subscribeToInstances: (clientId: string) => {
        const channelName = `instances-changes-${clientId}`;
        console.log(`[Store] Subscribing to channel: ${channelName}`);

        // Unsubscribe previous if exists? Ideally we track it but for now let's just create new
        supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to ALL events (INSERT, UPDATE, DELETE)
                    schema: 'public',
                    table: 'instances_clientes_bf_labs',
                    filter: `client_id=eq.${clientId}`
                },
                (payload) => {
                    console.log('[Store] Realtime event received:', payload);

                    if (payload.eventType === 'UPDATE') {
                        const updatedInstance = payload.new as Instance;
                        set(state => ({
                            instances: state.instances.map(i =>
                                i.id === updatedInstance.id ? { ...i, ...updatedInstance } : i
                            )
                        }));
                    }
                    else if (payload.eventType === 'INSERT') {
                        const newInstance = payload.new as Instance;
                        set(state => ({
                            instances: [newInstance, ...state.instances]
                        }));
                    }
                    else if (payload.eventType === 'DELETE') {
                        const deletedId = payload.old.id; // payload.old is { id: ... } often
                        set(state => ({
                            instances: state.instances.filter(i => i.id !== deletedId)
                        }));
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[Store] Subscription status for ${channelName}:`, status);
            });
    },

    generateShareToken: async (instanceId: string) => {
        try {
            const token = crypto.randomUUID();
            const { error } = await supabase
                .from('instances_clientes_bf_labs')
                .update({
                    share_token: token,
                    share_token_created_at: new Date().toISOString()
                })
                .eq('id', instanceId);

            if (error) throw error;

            // Update local state
            set(state => ({
                instances: state.instances.map(i =>
                    i.id === instanceId ? { ...i, share_token: token } : i
                )
            }));

            return token;
        } catch (error) {
            console.error('Error generating share token:', error);
            toast.error('Erro ao gerar link de compartilhamento');
            return null;
        }
    }
}));
