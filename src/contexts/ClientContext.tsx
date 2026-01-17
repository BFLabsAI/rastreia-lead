import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface Client {
    id: string; // uuid
    nome: string;
    id_conta_meta?: string;
    id_conta_google?: string;
    // Add other fields as needed
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

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from('relatorio_clientes_bf_labs')
            .select('id, nome, id_conta_meta, id_conta_google')
            .order('nome');

        if (error) {
            console.error('Error fetching clients:', error);
        } else {
            setClients(data || []);
            // Auto-select first client if none selected
            if (data && data.length > 0 && !selectedClient) {
                // Try to restore from localStorage or default to first
                const savedId = localStorage.getItem('bf_selected_client_id');
                const found = data.find(c => c.id === savedId) || data[0];
                setSelectedClient(found);
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
