import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { LeadsReport } from './pages/LeadsReport';
import { MetaDetail } from './pages/MetaDetail';
import { GoogleDetail } from './pages/GoogleDetail';
import { ClientSelection } from './pages/ClientSelection';
import { CreateClient } from './pages/CreateClient';
import { EditClient } from './pages/EditClient';
import { Phrases } from './pages/Phrases';
import { WhatsappConnection } from './pages/WhatsappConnection';
import { WhatsApp } from './pages/WhatsApp';
import { UsersManagement } from './pages/UsersManagement';
import { InstanceConnection } from './pages/InstanceConnection';
import { NewLeadModal } from './components/NewLeadModal';
import { Toaster, toast } from 'sonner';
import { Loader2 } from 'lucide-react';

import { supabase } from './lib/supabase';
import { ClientProvider, useClient } from './contexts/ClientContext';
import { DateProvider } from './contexts/DateContext';

import { Login } from './pages/Login';
import { useAuthStore } from './store/authStore';

function AppContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedClient } = useClient();
  const location = useLocation();
  const navigate = useNavigate();

  // Custom Auth Check
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkSession = useAuthStore((state) => state.checkSession);
  const isLoadingAuth = useAuthStore((state) => state.isLoading);

  useEffect(() => {
    checkSession();
  }, []);

  // Public Routes (Bypass Auth)
  if (location.pathname.startsWith('/connect/')) {
    return (
      <Routes>
        <Route path="/connect/:token" element={<InstanceConnection />} />
      </Routes>
    );
  }

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <Toaster theme="dark" position="top-right" />
      </>
    );
  }

  const handleNewLead = () => {
    setIsModalOpen(true);
  };

  const handleSaveLead = async (data: any) => {
    console.log("Saving lead:", data);

    const { error } = await supabase
      .from('relatorio_leads_cliente')
      .insert([
        {
          telefone_lead: data.telefone,
          origem: data.origem,
          cliente_id: selectedClient?.id
        }
      ]);

    if (error) {
      toast.error("Erro ao salvar lead");
      console.error(error);
    } else {
      toast.success("Lead salvo com sucesso!");
      setIsModalOpen(false);
    }
  }

  // Show ClientSelection if no client is selected
  if (!selectedClient) {
    return (
      <>
        <ClientSelection onClientSelected={() => navigate('/')} />
        <Toaster theme="dark" position="top-right" />
      </>
    );
  }

  return (
    <>
      <Layout
        currentPath={location.pathname}
        onNewLead={handleNewLead}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads-report" element={<LeadsReport />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/meta" element={<MetaDetail />} />
          <Route path="/google" element={<GoogleDetail />} />

          {/* Admin & Super Admin Routes */}
          {isAuthenticated && (useAuthStore.getState().user?.role === 'admin' || useAuthStore.getState().user?.role === 'super_admin') && (
            <>
              <Route path="/clients/new" element={<CreateClient />} />
              <Route path="/clients/edit" element={<EditClient />} />
              <Route path="/whatsapp-connection" element={<WhatsappConnection />} />
              <Route path="/whatsapp" element={<WhatsApp />} />
              <Route path="/phrases" element={<Phrases />} />
            </>
          )}

          {/* Super Admin Only Route */}
          {isAuthenticated && useAuthStore.getState().user?.role === 'super_admin' && (
            <Route path="/users" element={<UsersManagement />} />
          )}
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Layout>

      <NewLeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveLead}
      />

      <Toaster theme="dark" position="top-right" />
    </>
  );
}

function App() {
  return (
    <ClientProvider>
      <DateProvider>
        <AppContent />
      </DateProvider>
    </ClientProvider>
  );
}

export default App;
