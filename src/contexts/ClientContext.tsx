import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';

export interface Client {
    id: string; // uuid
    nome: string;
    id_conta_meta?: string;
    id_conta_google?: string;
    enviar_relatorio_meta?: boolean;
    checar_saldo_meta?: boolean;
    enviar_relatorio_google?: boolean;
    status?: string; // 'Ativo' | 'Inativo'
    tipo_pagamento?: string; // 'Cartão' | 'Boleto'
    valor_base?: number | string; // DB is text currently, but we treat as number
    instancia?: string;
    active_meta?: boolean;
    active_google?: boolean;
}

interface ClientContextType {
    clients: Client[];
    selectedClient: Client | null;
    selectClient: (clientId: string) => void;
    isLoading: boolean;
}

const ClientContext = createContext<ClientContextType | undefined>(undefined);

export function ClientProvider({ children }: { children: ReactNode }) {
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const { user, isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (isAuthenticated) {
            fetchClients();
        }
    }, [isAuthenticated, user]);

    const fetchClients = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('relatorio_clientes_bf_labs')
            .select('*')
            .order('nome');

        if (error) {
            console.error('Error fetching clients:', error);
        } else {
            // Helper to get user from store non-reactively or just user localStorage for this pure function
            // Best is to use useAuthStore.getState()
            const user = useAuthStore.getState().user;

            let filteredClients = data || [];

            if (user && user.role !== 'super_admin') {
                // If user is restricted (admin or user), filter by client_ids
                // e.g. ["client_id_1"]
                const allowed = user.client_ids || [];
                // Check if * is present (just in case)
                if (!allowed.includes('*')) {
                    filteredClients = filteredClients.filter(c => allowed.includes(c.id));
                }
            } else if (user && user.role === 'super_admin') {
                // Show all
            } else {
                // No user? Should not happen if behind auth wall, but safer to show empty
                // But wait, fetchClients runs on mount. If not logged in?
                // The App protects the routes, but context might init first.
                // Let's assume if no user, empty list.
                if (!user) filteredClients = [];
            }

            setClients(filteredClients);

            // Auto-select first client if none selected
            if (filteredClients.length > 0 && !selectedClient) {
                const savedId = localStorage.getItem('bf_selected_client_id');
                const found = filteredClients.find(c => c.id === savedId) || filteredClients[0];
                setSelectedClient(found);
            } else if (filteredClients.length === 0) {
                setSelectedClient(null);
            }
        }
        setIsLoading(false);
    };

    const selectClient = (clientId: string) => {
        const client = clients.find(c => c.id === clientId) || null;
        setSelectedClient(client);
        if (client) {
            localStorage.setItem('bf_selected_client_id', client.id);
        }
    };

    return (
        <ClientContext.Provider value={{ clients, selectedClient, selectClient, isLoading }}>
            {children}
        </ClientContext.Provider>
    );
}

export function useClient() {
    const context = useContext(ClientContext);
    if (context === undefined) {
        throw new Error('useClient must be used within a ClientProvider');
    }
    return context;
}
