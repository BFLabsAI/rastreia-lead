import { useState } from 'react';
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
import { NewLeadModal } from './components/NewLeadModal';
import { Toaster, toast } from 'sonner';

import { supabase } from './lib/supabase';
import { ClientProvider, useClient } from './contexts/ClientContext';
import { DateProvider } from './contexts/DateContext';

function AppContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedClient } = useClient();
  const location = useLocation();
  const navigate = useNavigate();

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
        onNavigate={navigate}
        onNewLead={handleNewLead}
      >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leads-report" element={<LeadsReport />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/meta" element={<MetaDetail />} />
          <Route path="/google" element={<GoogleDetail />} />
          <Route path="/clients/new" element={<CreateClient />} />
          <Route path="/clients/edit" element={<EditClient />} />
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
