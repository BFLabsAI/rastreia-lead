import { useState, useEffect } from 'react';
import { Settings, Save, ArrowLeft, Loader2, Trash2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { toast } from 'sonner';

interface PhraseOrigin {
    id: string;
    frase: string;
    origem: string;
}

export function EditClient() {
    const navigate = useNavigate();
    const { selectedClient } = useClient();
    const [clientName, setClientName] = useState('');
    const [metaAccountId, setMetaAccountId] = useState('');
    const [googleAccountId, setGoogleAccountId] = useState('');

    // New Fields State
    const [enviarRelatorioMeta, setEnviarRelatorioMeta] = useState(false);
    const [checarSaldoMeta, setChecarSaldoMeta] = useState(false);
    const [enviarRelatorioGoogle, setEnviarRelatorioGoogle] = useState(false);
    const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [tipoPagamento, setTipoPagamento] = useState('Cartão');
    const [valorBase, setValorBase] = useState('');
    const [instancia, setInstancia] = useState('');

    // Phrases State
    const [phrases, setPhrases] = useState<PhraseOrigin[]>([]);
    const [currentPhrase, setCurrentPhrase] = useState('');
    const [currentOrigin, setCurrentOrigin] = useState('');
    const [isLoadingPhrases, setIsLoadingPhrases] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        if (selectedClient) {
            setClientName(selectedClient.nome);
            setMetaAccountId(selectedClient.id_conta_meta || '');
            setGoogleAccountId(selectedClient.id_conta_google || '');
            setEnviarRelatorioMeta(selectedClient.enviar_relatorio_meta || false);
            setChecarSaldoMeta(selectedClient.checar_saldo_meta || false);
            setEnviarRelatorioGoogle(selectedClient.enviar_relatorio_google || false);
            setStatus((selectedClient.status as 'Ativo' | 'Inativo') || 'Ativo');
            setTipoPagamento(selectedClient.tipo_pagamento || 'Cartão');
            setValorBase(selectedClient.valor_base?.toString() || '');
            setInstancia(selectedClient.instancia || '');

            loadPhrases(selectedClient.id);
        } else {
            // Redirect if no client selected, but let's just warn for now or redirect to home
            // navigate('/');
        }
    }, [selectedClient, navigate]);

    const loadPhrases = async (clientId: string) => {
        setIsLoadingPhrases(true);
        try {
            const { data, error } = await supabase
                .from('relatorio_origem')
                .select('*')
                .eq('cliente_id', clientId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            setPhrases(data || []);
        } catch (error) {
            console.error('Error loading phrases:', error);
            toast.error('Erro ao carregar frases.');
        } finally {
            setIsLoadingPhrases(false);
        }
    };

    const handleAddPhrase = async () => {
        if (!selectedClient) return;
        if (!currentPhrase.trim() || !currentOrigin.trim()) {
            toast.error('Preencha a frase e a origem');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('relatorio_origem')
                .insert([{
                    cliente_id: selectedClient.id,
                    frase: currentPhrase.trim(),
                    origem: currentOrigin.trim()
                }])
                .select()
                .single();

            if (error) throw error;

            setPhrases([...phrases, data]);
            setCurrentPhrase('');
            setCurrentOrigin('');
            toast.success('Frase adicionada com sucesso!');
        } catch (error) {
            console.error('Error adding phrase:', error);
            toast.error('Erro ao adicionar frase.');
        }
    };

    const handleDeletePhrase = async (id: string) => {
        if (!confirm('Tem certeza que deseja remover esta frase?')) return;

        try {
            const { error } = await supabase
                .from('relatorio_origem')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setPhrases(phrases.filter(p => p.id !== id));
            toast.success('Frase removida com sucesso!');
        } catch (error) {
            console.error('Error deleting phrase:', error);
            toast.error('Erro ao remover frase.');
        }
    };

    const handleUpdateClient = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedClient) return;
        if (!clientName.trim()) {
            toast.error('O nome do cliente não pode ser vazio');
            return;
        }

        setIsSaving(true);

        const payload = {
            nome: clientName.trim(),
            id_conta_meta: metaAccountId.trim() || null,
            id_conta_google: googleAccountId.trim() || null,
            enviar_relatorio_meta: enviarRelatorioMeta,
            checar_saldo_meta: checarSaldoMeta,
            enviar_relatorio_google: enviarRelatorioGoogle,
            status: status,
            tipo_pagamento: tipoPagamento,
            valor_base: valorBase ? parseFloat(valorBase.replace(',', '.')) : null, // Fix comma handling
            instancia: instancia.trim() || null
        };

        console.log('Sending Update Payload:', payload);

        try {
            const { data, error } = await supabase
                .from('relatorio_clientes_bf_labs')
                .update(payload)
                .eq('id', selectedClient.id)
                .select(); // Add select to see returned data

            if (error) throw error;

            console.log('Update Success, returned:', data);

            toast.success('Cliente atualizado com sucesso!');
            // Update context involves refetching usually, but for now we might need to rely on the context refreshing or manually updating state if exposed.
            // Assuming context refreshes or we force a reload/re-selection.
            // Since useClient likely fetches on mount or has a refresh, we might just reload the page or navigate away.
            window.location.reload(); // Simple way to refresh context data for now
        } catch (error) {
            console.error('Error updating client:', error);
            toast.error('Erro ao atualizar cliente');
        } finally {
            setIsSaving(false);
        }
    };

    if (!selectedClient) {
        return (
            <div className="p-8 text-center">
                <h2 className="text-white text-xl">Nenhum cliente selecionado</h2>
                <button onClick={() => navigate('/')} className="mt-4 text-indigo-400 hover:text-indigo-300">Voltar para Dashboard</button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-2xl mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft size={20} />
                <span>Voltar</span>
            </button>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Settings size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Dados do Cliente</h1>
                        <p className="text-gray-400">Editar informações de {selectedClient.nome}</p>
                    </div>
                </div>

                <form onSubmit={handleUpdateClient} className="space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Informações Básicas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Nome do Cliente
                                </label>
                                <input
                                    type="text"
                                    value={clientName}
                                    onChange={(e) => setClientName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                    disabled={isSaving}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Status
                                </label>
                                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => setStatus('Ativo')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${status === 'Ativo' ? 'bg-green-500/20 text-green-400 shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Ativo
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStatus('Inativo')}
                                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${status === 'Inativo' ? 'bg-red-500/20 text-red-400 shadow-sm' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        Inativo
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Instância
                                </label>
                                <input
                                    type="text"
                                    value={instancia}
                                    onChange={(e) => setInstancia(e.target.value)}
                                    placeholder="Ex: instancia_01"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>

                    {/* IDs & Accounts */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">IDs das Contas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    ID Conta Meta Ads
                                </label>
                                <input
                                    type="text"
                                    value={metaAccountId}
                                    onChange={(e) => setMetaAccountId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                    disabled={isSaving}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    ID Conta Google Ads
                                </label>
                                <input
                                    type="text"
                                    value={googleAccountId}
                                    onChange={(e) => setGoogleAccountId(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                    disabled={isSaving}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Phrase & Origin - New Section */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Frases e Origens</h3>
                        <div className="space-y-4">
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Frase
                                    </label>
                                    <input
                                        type="text"
                                        value={currentPhrase}
                                        onChange={(e) => setCurrentPhrase(e.target.value)}
                                        placeholder="Ex: Olá, vim pelo Instagram"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                        Origem
                                    </label>
                                    <input
                                        type="text"
                                        value={currentOrigin}
                                        onChange={(e) => setCurrentOrigin(e.target.value)}
                                        placeholder="Ex: Instagram"
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddPhrase}
                                    disabled={isSaving}
                                    className="p-3 rounded-xl bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white transition-colors border border-indigo-500/30"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>

                            {/* List of added phrases */}
                            {isLoadingPhrases ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="animate-spin text-gray-500" />
                                </div>
                            ) : phrases.length > 0 ? (
                                <div className="space-y-2 mt-4">
                                    {phrases.map((item) => (
                                        <div key={item.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-4">
                                                <div className="px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-400 text-sm font-medium">
                                                    {item.origem}
                                                </div>
                                                <span className="text-gray-300">{item.frase}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleDeletePhrase(item.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center p-4 text-gray-500 text-sm bg-white/5 rounded-xl border border-dashed border-white/10">
                                    Nenhuma frase cadastrada
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Automatizações (Booleans) */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Configurações de Automação</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Enviar Relatório Meta */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-between gap-4">
                                <span className="text-sm font-medium text-gray-300 text-center">Enviar Relatório Meta</span>
                                <button
                                    type="button"
                                    onClick={() => setEnviarRelatorioMeta(!enviarRelatorioMeta)}
                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${enviarRelatorioMeta ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                    {enviarRelatorioMeta ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                            {/* Checar Saldo Meta */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-between gap-4">
                                <span className="text-sm font-medium text-gray-300 text-center">Checar Saldo Meta</span>
                                <button
                                    type="button"
                                    onClick={() => setChecarSaldoMeta(!checarSaldoMeta)}
                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${checarSaldoMeta ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                    {checarSaldoMeta ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                            {/* Enviar Relatório Google */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-between gap-4">
                                <span className="text-sm font-medium text-gray-300 text-center">Enviar Relatório Google</span>
                                <button
                                    type="button"
                                    onClick={() => setEnviarRelatorioGoogle(!enviarRelatorioGoogle)}
                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${enviarRelatorioGoogle ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                >
                                    {enviarRelatorioGoogle ? 'SIM' : 'NÃO'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Financeiro */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Financeiro</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Forma de Pagamento
                                </label>
                                <select
                                    value={tipoPagamento}
                                    onChange={(e) => setTipoPagamento(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none appearance-none"
                                    disabled={isSaving}
                                >
                                    <option value="Cartão" className="bg-[#0A0A0A]">Cartão de Crédito</option>
                                    <option value="Boleto" className="bg-[#0A0A0A]">Boleto Bancário</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Valor Base (Recarga)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                    <input
                                        type="number"
                                        value={valorBase}
                                        onChange={(e) => setValorBase(e.target.value)}
                                        placeholder="0,00"
                                        step="0.01"
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-indigo-500/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="text-xs text-gray-500">
                                ID: {selectedClient.id}
                            </div>
                            <button
                                type="button"
                                onClick={async () => {
                                    if (window.confirm('Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.')) {
                                        setIsDeleting(true);
                                        try {
                                            const { error } = await supabase
                                                .from('relatorio_clientes_bf_labs')
                                                .delete()
                                                .eq('id', selectedClient.id);
                                            if (error) throw error;
                                            toast.success('Cliente excluído com sucesso');
                                            window.location.href = '/';
                                        } catch (error) {
                                            console.error('Error deleting client:', error);
                                            toast.error('Erro ao excluir cliente');
                                            setIsDeleting(false);
                                        }
                                    }
                                }}
                                className="flex items-center gap-2 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                                disabled={isDeleting || isSaving}
                            >
                                <Trash2 size={16} />
                                <span className="hidden sm:inline">Excluir Cliente</span>
                            </button>
                        </div>
                        <button
                            type="submit"
                            className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save size={20} />
                                    Salvar Alterações
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
