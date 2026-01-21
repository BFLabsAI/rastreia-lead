"use client";

import { InstanceManager } from "@/components/disparador/InstanceManager";
import { PageHeader } from "@/components/layout/PageHeader";

const Instancias = () => {
  return (
    <div className="space-y-6">
      <PageHeader title="Instâncias" subtitle="Gerencie suas conexões do WhatsApp" />
      <InstanceManager />
    </div>
  );
};

export default Instancias;