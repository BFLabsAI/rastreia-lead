import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminState {
    impersonatedTenantId: string | null;
    adminTenantId: string | null;
    setImpersonatedTenantId: (id: string | null) => void;
    setAdminTenantId: (id: string | null) => void;
}

export const useAdminStore = create<AdminState>()(
    persist(
        (set) => ({
            impersonatedTenantId: null,
            adminTenantId: null,
            setImpersonatedTenantId: (id) => set({ impersonatedTenantId: id }),
            setAdminTenantId: (id) => set({ adminTenantId: id }),
        }),
        {
            name: 'admin-storage',
        }
    )
);
