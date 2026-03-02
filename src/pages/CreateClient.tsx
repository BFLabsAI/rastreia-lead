import { useState } from 'react';
import { Building2, Check, ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { toast } from 'sonner';

interface PhraseOrigin {
    frase: string;
    origem: string;
}

export function CreateClient() {
    const navigate = useNavigate();
    const { selectClient } = useClient();
    const [newClientName, setNewClientName] = useState('');
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
    const [activeMeta, setActiveMeta] = useState(true);
    const [activeGoogle, setActiveGoogle] = useState(true);

    // Phrases State
    const [phrases, setPhrases] = useState<PhraseOrigin[]>([]);
    const [currentPhrase, setCurrentPhrase] = useState('');
    const [currentOrigin, setCurrentOrigin] = useState('');

    const [isSaving, setIsSaving] = useState(false);

    const handleAddPhrase = () => {
        if (!currentPhrase.trim() || !currentOrigin.trim()) {
            toast.error('Preencha a frase e a origem');
            return;
        }

        setPhrases([...phrases, { frase: currentPhrase.trim(), origem: currentOrigin.trim() }]);
        setCurrentPhrase('');
        setCurrentOrigin('');
    };

    const handleRemovePhrase = (index: number) => {
        setPhrases(phrases.filter((_, i) => i !== index));
    };

    const handleCreateClient = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newClientName.trim()) {
            toast.error('Digite o nome do cliente');
            return;
        }

        setIsSaving(true);

        // Prepare phrases, including pending one if valid
        let finalPhrases = [...phrases];
        if (currentPhrase.trim() && currentOrigin.trim()) {
            finalPhrases.push({
                frase: currentPhrase.trim(),
                origem: currentOrigin.trim()
            });
        }

        console.log('Final phrases to save:', finalPhrases);

        try {
            // 1. Create Client
            const { data: clientData, error: clientError } = await supabase
                .from('relatorio_clientes_bf_labs')
                .insert([{
                    nome: newClientName.trim(),
                    id_conta_meta: metaAccountId.trim() || null,
                    id_conta_google: googleAccountId.trim() || null,
                    enviar_relatorio_meta: enviarRelatorioMeta,
                    checar_saldo_meta: checarSaldoMeta,
                    enviar_relatorio_google: enviarRelatorioGoogle,
                    status: status,
                    tipo_pagamento: tipoPagamento,
                    valor_base: valorBase ? parseFloat(valorBase.replace(',', '.')) : null,
                    instancia: instancia.trim() || null,
                    active_meta: activeMeta,
                    active_google: activeGoogle
                }])
                .select()
                .single();

            if (clientError) throw clientError;

            console.log('Client created:', clientData);

            // 2. Insert Phrases if any
            if (finalPhrases.length > 0) {
                const phrasesToInsert = finalPhrases.map(p => ({
                    cliente_id: clientData.id,
                    frase: p.frase,
                    origem: p.origem
                }));

                console.log('Inserting phrases:', phrasesToInsert);

                const { error: phrasesError } = await supabase
                    .from('relatorio_origem')
                    .insert(phrasesToInsert);

                if (phrasesError) {
                    console.error('Error adding phrases:', phrasesError);
                    toast.error('Cliente criado, mas houve erro ao salvar as frases.');
                }
            }

            toast.success('Cliente cadastrado com sucesso!');
            selectClient(clientData.id);
            navigate('/'); // Navigate to dashboard with new client selected
        } catch (error) {
            console.error('Error creating client:', error);
            toast.error('Erro ao cadastrar cliente');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <button
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
            >
                <ArrowLeft size={20} />
                <span>Voltar</span>
            </button>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                        <Building2 size={32} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white mb-1">Novo Cliente</h1>
                        <p className="text-gray-400">Cadastre um novo cliente para gerenciar</p>
                    </div>
                </div>

                <form onSubmit={handleCreateClient} className="space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Informações Básicas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Nome do Cliente *
                                </label>
                                <input
                                    type="text"
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    placeholder="Ex: Empresa XYZ"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
                                    disabled={isSaving}
                                    autoFocus
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
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
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
                                    placeholder="Ex: 1234567890"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
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
                                    placeholder="Ex: 123-456-7890"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
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
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
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
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddPhrase}
                                    disabled={isSaving}
                                    className="p-3 rounded-xl bg-primary/20 text-primary hover:bg-primary hover:text-background transition-colors border border-primary/30"
                                >
                                    <Plus size={24} />
                                </button>
                            </div>

                            {/* List of added phrases */}
                            {phrases.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    {phrases.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-4">
                                                <div className="px-3 py-1 rounded-lg bg-primary/20 text-primary text-sm font-medium">
                                                    {item.origem}
                                                </div>
                                                <span className="text-gray-300">{item.frase}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemovePhrase(index)}
                                                className="p-2 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Automatizações (Booleans) */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white border-b border-white/10 pb-2">Configurações de Automação</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Active Modules */}
                            <div className="col-span-1 md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4">
                                    <span className="text-sm font-medium text-gray-300">Módulo Meta Ads</span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveMeta(!activeMeta)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeMeta ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        {activeMeta ? 'ATIVO' : 'INATIVO'}
                                    </button>
                                </div>
                                <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4">
                                    <span className="text-sm font-medium text-gray-300">Módulo Google Ads</span>
                                    <button
                                        type="button"
                                        onClick={() => setActiveGoogle(!activeGoogle)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeGoogle ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                                    >
                                        {activeGoogle ? 'ATIVO' : 'INATIVO'}
                                    </button>
                                </div>
                            </div>

                            {/* Enviar Relatório Meta */}
                            <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-between gap-4">
                                <span className="text-sm font-medium text-gray-300 text-center">Enviar Relatório Meta</span>
                                <button
                                    type="button"
                                    onClick={() => setEnviarRelatorioMeta(!enviarRelatorioMeta)}
                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${enviarRelatorioMeta ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
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
                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${checarSaldoMeta ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
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
                                    className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${enviarRelatorioGoogle ? 'bg-primary text-background shadow-lg shadow-primary/20' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
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
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 focus:bg-white/10 transition-all outline-none appearance-none"
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
                                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="flex-1 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white font-medium transition-all"
                            disabled={isSaving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-indigo-500/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Check size={20} />
                                    Cadastrar Cliente
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
