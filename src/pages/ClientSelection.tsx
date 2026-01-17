import { useState } from 'react';
import { Building2, Plus, ArrowRight, Check } from 'lucide-react';
import { useClient } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface ClientSelectionProps {
    onClientSelected: () => void;
}

export function ClientSelection({ onClientSelected }: ClientSelectionProps) {
    const { clients, selectClient, isLoading } = useClient();
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const handleSelectClient = (clientId: string) => {
        selectClient(clientId);
        onClientSelected();
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newClientName.trim()) {
            toast.error('Digite o nome do cliente');
            return;
        }

        setIsSaving(true);

        try {
            const { data, error } = await supabase
                .from('relatorio_clientes_bf_labs')
                .insert([{ nome: newClientName.trim() }])
                .select()
                .single();

            if (error) throw error;

            toast.success('Cliente cadastrado com sucesso!');
            selectClient(data.id);
            onClientSelected();
        } catch (error) {
            console.error('Error creating client:', error);
            toast.error('Erro ao cadastrar cliente');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-8 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-600/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-4xl relative z-10">
                {/* Logo & Title */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-3 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                            <Building2 size={32} className="text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold text-white mb-2">BF LABS</h1>
                    <p className="text-gray-400 text-lg">Intelligence Dashboard</p>
                </div>

                {/* Main Card */}
                <div className="glass-card rounded-[2rem] p-8 md:p-12">
                    {!showNewClientForm ? (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-2">Selecione um Cliente</h2>
                            <p className="text-gray-400 mb-8">Escolha um cliente para visualizar seus dados</p>

                            {/* Clients Grid */}
                            {isLoading ? (
                                <div className="text-center py-12">
                                    <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                                    <p className="text-gray-500 mt-4">Carregando clientes...</p>
                                </div>
                            ) : clients.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                                    {clients.map((client) => (
                                        <button
                                            key={client.id}
                                            onClick={() => handleSelectClient(client.id)}
                                            className="group p-6 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-500/50 hover:bg-white/10 transition-all text-left"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20">
                                                        {client.nome.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white font-bold text-lg group-hover:text-indigo-400 transition-colors">
                                                            {client.nome}
                                                        </h3>
                                                        <p className="text-gray-500 text-sm">Cliente BF Labs</p>
                                                    </div>
                                                </div>
                                                <ArrowRight size={20} className="text-gray-600 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 mb-8">
                                    <Building2 size={48} className="text-gray-600 mx-auto mb-4" />
                                    <p className="text-gray-500">Nenhum cliente cadastrado ainda</p>
                                </div>
                            )}

                            {/* New Client Button */}
                            <button
                                onClick={() => setShowNewClientForm(true)}
                                className="w-full p-4 rounded-2xl border-2 border-dashed border-white/20 hover:border-indigo-500/50 hover:bg-white/5 transition-all flex items-center justify-center gap-3 text-gray-400 hover:text-indigo-400 group"
                            >
                                <Plus size={20} className="group-hover:scale-110 transition-transform" />
                                <span className="font-medium">Cadastrar Novo Cliente</span>
                            </button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-white mb-2">Novo Cliente</h2>
                            <p className="text-gray-400 mb-8">Preencha os dados para cadastrar</p>

                            <form onSubmit={handleCreateClient} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Nome do Cliente *
                                    </label>
                                    <input
                                        type="text"
                                        value={newClientName}
                                        onChange={(e) => setNewClientName(e.target.value)}
                                        placeholder="Ex: Empresa XYZ"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                        autoFocus
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowNewClientForm(false);
                                            setNewClientName('');
                                        }}
                                        className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium transition-all"
                                        disabled={isSaving}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Salvando...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={20} />
                                                Cadastrar e Continuar
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>

                <p className="text-center text-gray-600 text-sm mt-8">
                    © 2026 BF Labs Intelligence. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
}
