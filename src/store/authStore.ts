import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface User {
    id: string;
    email: string;
    role: 'user' | 'admin' | 'super_admin';
    client_ids: string[];
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    logout: () => void;
    checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true, // Start loading to check session

    login: async (email, password) => {
        set({ isLoading: true });
        try {
            // Direct query to the users table (Custom Internal Auth)
            const { data, error } = await supabase
                .from('users_clientes_bf_labs')
                .select('*')
                .eq('email', email)
                .eq('password', password) // In production, use a hash check!
                .single();

            if (error || !data) {
                set({ isLoading: false });
                return { success: false, error: 'Credenciais inválidas' };
            }

            const user: User = {
                id: data.id,
                email: data.email,
                role: data.role as User['role'],
                client_ids: data.client_ids || []
            };

            // Persist simple session
            localStorage.setItem('bf_auth_user', JSON.stringify(user));

            set({ user, isAuthenticated: true, isLoading: false });
            return { success: true };
        } catch (err) {
            console.error('Login error:', err);
            set({ isLoading: false });
            return { success: false, error: 'Erro ao conectar ao servidor' };
        }
    },

    logout: () => {
        localStorage.removeItem('bf_auth_user');
        set({ user: null, isAuthenticated: false });
    },

    checkSession: async () => {
        const stored = localStorage.getItem('bf_auth_user');
        if (stored) {
            try {
                const user = JSON.parse(stored);
                // Optional: Re-validate against DB if strict security needed
                set({ user, isAuthenticated: true, isLoading: false });
            } catch (e) {
                localStorage.removeItem('bf_auth_user');
                set({ user: null, isAuthenticated: false, isLoading: false });
            }
        } else {
            set({ user: null, isAuthenticated: false, isLoading: false });
        }
    }
}));
