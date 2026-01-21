import { useEffect, useState } from 'react';
import { useDisparadorStore } from '@/store/disparadorStore';
import { useClient } from '@/contexts/ClientContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { InstanceCard } from './InstanceCard';
import { toast } from 'sonner';

export function InstanceManagerV2() {
    console.log("InstanceManagerV2 rendered - Cache bust");
    const { instances, isLoading, loadInstances, createInstance, subscribeToInstances } = useDisparadorStore();
    const { selectedClient } = useClient();
    const [newInstanceName, setNewInstanceName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (selectedClient?.id) {
            loadInstances(selectedClient.id);
            subscribeToInstances(selectedClient.id);
        }
    }, [selectedClient, loadInstances, subscribeToInstances]);

    const handleCreate = async () => {
        if (!newInstanceName.trim()) {
            toast.error("Nome da instância é obrigatório");
            return;
        }
        if (!selectedClient?.id) {
            toast.error("Nenhum cliente selecionado");
            return;
        }

        setIsCreating(true);
        await createInstance(newInstanceName, selectedClient.id);
        setNewInstanceName('');
        setIsCreating(false);
    };

    if (!selectedClient) {
        return (
            <div className="flex flex-col items-center justify-center p-12 bg-[#0A0A0A] rounded-2xl border border-white/5">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Nenhum Cliente Selecionado</h3>
                <p className="text-gray-400">Selecione um cliente para gerenciar suas instâncias de WhatsApp.</p>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="bg-[#0A0A0A] p-6 rounded-2xl border border-white/5">
                <div className="w-full">
                    <label className="text-sm text-gray-400 mb-2 block">Nova Instância</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nome da Instância (ex: comercial)"
                            value={newInstanceName}
                            onChange={(e) => setNewInstanceName(e.target.value)}
                            className="bg-[#1A1A1A] border-white/10 text-white"
                        />
                        <Button
                            onClick={handleCreate}
                            disabled={isCreating}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[140px]"
                        >
                            {isCreating ? <Loader2 className="animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                            Criar
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Instâncias ({instances.length})</h2>
                <Button variant="ghost" size="sm" onClick={() => loadInstances(selectedClient?.id)} className="text-gray-400 hover:text-white">
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                </Button>
            </div>

            {isLoading && instances.length === 0 ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                </div>
            ) : instances.length === 0 ? (
                <div className="text-center p-12 bg-[#0A0A0A] rounded-2xl border border-white/5 border-dashed">
                    <p className="text-gray-500">Nenhuma instância encontrada.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {instances.map((instance) => (
                        <InstanceCard key={instance.id} instance={instance} />
                    ))}
                </div>
            )}
        </div>
    );
}
