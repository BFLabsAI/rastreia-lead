import { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Leads } from './pages/Leads';
import { LeadsReport } from './pages/LeadsReport';
import { MetaDetail } from './pages/MetaDetail';
import { GoogleDetail } from './pages/GoogleDetail';
import { ClientSelection } from './pages/ClientSelection';
import { NewLeadModal } from './components/NewLeadModal';
import { Toaster, toast } from 'sonner';

import { supabase } from './lib/supabase';
import { ClientProvider, useClient } from './contexts/ClientContext';
import { DateProvider } from './contexts/DateContext';

function AppContent() {
  const [currentPath, setCurrentPath] = useState('/');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedClient } = useClient();

  const handleNewLead = () => {
    setIsModalOpen(true);
  };

  const handleSaveLead = async (data: any) => {
    console.log("Saving lead:", data);

    // Insert into Supabase
    // Insert into Supabase
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

  const renderContent = () => {
    switch (currentPath) {
      case '/': return <Dashboard />;
      case '/leads-report': return <LeadsReport />;
      case '/leads': return <Leads />;
      case '/meta': return <MetaDetail />;
      case '/google': return <GoogleDetail />;
      default: return <Dashboard />;
    }
  };

  // Show ClientSelection if no client is selected
  if (!selectedClient) {
    return (
      <>
        <ClientSelection onClientSelected={() => setCurrentPath('/')} />
        <Toaster theme="dark" position="top-right" />
      </>
    );
  }

  return (
    <>
      <Layout
        currentPath={currentPath}
        onNavigate={setCurrentPath}
        onNewLead={handleNewLead}
      >
        {renderContent()}
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
