import { useState, useEffect } from 'react';
import { Settings, Save, ArrowLeft, Loader2, Trash2, Zap, BarChart3, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

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
    const [activeMeta, setActiveMeta] = useState(true);
    const [activeGoogle, setActiveGoogle] = useState(true);

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
            setActiveMeta(selectedClient.active_meta !== false);
            setActiveGoogle(selectedClient.active_google !== false);
        }
    }, [selectedClient]);

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
            valor_base: valorBase ? parseFloat(valorBase.replace(',', '.')) : null,
            instancia: instancia.trim() || null,
            active_meta: activeMeta,
            active_google: activeGoogle
        };

        try {
            const { error } = await supabase
                .from('relatorio_clientes_bf_labs')
                .update(payload)
                .eq('id', selectedClient.id);

            if (error) throw error;

            toast.success('Cliente atualizado com sucesso!');
            window.location.reload();
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
                <button onClick={() => navigate('/')} className="mt-4 text-primary hover:text-primary/80">Voltar para Dashboard</button>
            </div>
        );
    }

    return (
        <div className="p-8 max-w-4xl mx-auto">
            {/* Header & Navigation */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <ArrowLeft size={20} />
                    <span>Voltar</span>
                </button>
            </div>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
                    <Settings size={120} className="text-white" />
                </div>

                <div className="relative z-10 mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">{selectedClient.nome}</h1>
                    <p className="text-gray-400 flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${status === 'Ativo' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {status} • ID: {selectedClient.id}
                    </p>
                </div>

                <form onSubmit={handleUpdateClient}>
                    <Tabs defaultValue="geral" className="space-y-8">
                        <TabsList className="bg-white/5 p-1 rounded-xl border border-white/10">
                            <TabsTrigger value="geral" className="px-6 py-2">Geral</TabsTrigger>
                            <TabsTrigger value="integracoes" className="px-6 py-2">Integrações & Módulos</TabsTrigger>
                            <TabsTrigger value="automacao" className="px-6 py-2">Automação</TabsTrigger>
                            <TabsTrigger value="financeiro" className="px-6 py-2">Financeiro</TabsTrigger>
                        </TabsList>

                        {/* TAB: GERAL */}
                        <TabsContent value="geral" className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Nome do Cliente</label>
                                    <input
                                        type="text"
                                        value={clientName}
                                        onChange={(e) => setClientName(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 focus:bg-white/10 transition-all outline-none"
                                        disabled={isSaving}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Status do Contrato</label>
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
                            </div>
                        </TabsContent>

                        {/* TAB: INTEGRAÇÕES */}
                        <TabsContent value="integracoes" className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                            {/* Módulos */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <Zap size={18} className="text-yellow-500" /> Módulos Ativos
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-sm font-medium text-white block">Meta Ads</span>
                                            <span className="text-xs text-gray-500">Ativa dashboards e relatórios do Meta</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveMeta(!activeMeta)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeMeta ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 text-gray-500'}`}
                                        >
                                            {activeMeta ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4">
                                        <div>
                                            <span className="text-sm font-medium text-white block">Google Ads</span>
                                            <span className="text-xs text-gray-500">Ativa dashboards e relatórios do Google</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setActiveGoogle(!activeGoogle)}
                                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeGoogle ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20' : 'bg-gray-800 text-gray-500'}`}
                                        >
                                            {activeGoogle ? 'ON' : 'OFF'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white">IDs de Contas</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">ID Conta Meta Ads</label>
                                        <input
                                            type="text"
                                            value={metaAccountId}
                                            onChange={(e) => setMetaAccountId(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 focus:bg-white/10 outline-none"
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">ID Conta Google Ads</label>
                                        <input
                                            type="text"
                                            value={googleAccountId}
                                            onChange={(e) => setGoogleAccountId(e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 focus:bg-white/10 outline-none"
                                            disabled={isSaving}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-lg font-semibold text-white">Conexão WhatsApp</h3>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">Instância Vinculada (Opcional)</label>
                                        <input
                                            type="text"
                                            value={instancia}
                                            onChange={(e) => setInstancia(e.target.value)}
                                            placeholder="Ex: whatsapp_vendas_01"
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 focus:bg-white/10 outline-none"
                                            disabled={isSaving}
                                        />
                                        <p className="text-xs text-gray-500 mt-2">Nome da instância no servidor UazAPI.</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: AUTOMAÇÃO */}
                        <TabsContent value="automacao" className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Enviar Relatório Meta */}
                                <div className="bg-white/5 rounded-xl p-6 border border-white/10 flex flex-col items-center text-center gap-4 hover:bg-white/10 transition-colors">
                                    <div className={`p-3 rounded-full ${enviarRelatorioMeta ? 'bg-primary/20 text-primary' : 'bg-gray-800 text-gray-600'}`}>
                                        <BarChart3 size={24} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-white block">Relatório Meta</span>
                                        <span className="text-xs text-gray-500">Envio automático mensal</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnviarRelatorioMeta(!enviarRelatorioMeta)}
                                        className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${enviarRelatorioMeta ? 'bg-primary text-background' : 'bg-gray-700 text-gray-400'}`}
                                    >
                                        {enviarRelatorioMeta ? 'ATIVADO' : 'DESATIVADO'}
                                    </button>
                                </div>

                                {/* Checar Saldo */}
                                <div className="bg-white/5 rounded-xl p-6 border border-white/10 flex flex-col items-center text-center gap-4 hover:bg-white/10 transition-colors">
                                    <div className={`p-3 rounded-full ${checarSaldoMeta ? 'bg-green-500/20 text-green-400' : 'bg-gray-800 text-gray-600'}`}>
                                        <div className="font-bold text-lg">$</div>
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-white block">Alerta de Saldo</span>
                                        <span className="text-xs text-gray-500">Notificar saldo baixo (Meta)</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setChecarSaldoMeta(!checarSaldoMeta)}
                                        className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${checarSaldoMeta ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                                    >
                                        {checarSaldoMeta ? 'ATIVADO' : 'DESATIVADO'}
                                    </button>
                                </div>

                                {/* Enviar Relatório Google */}
                                <div className="bg-white/5 rounded-xl p-6 border border-white/10 flex flex-col items-center text-center gap-4 hover:bg-white/10 transition-colors">
                                    <div className={`p-3 rounded-full ${enviarRelatorioGoogle ? 'bg-yellow-500/20 text-yellow-400' : 'bg-gray-800 text-gray-600'}`}>
                                        <TrendingUp size={24} />
                                    </div>
                                    <div>
                                        <span className="text-sm font-medium text-white block">Relatório Google</span>
                                        <span className="text-xs text-gray-500">Envio automático mensal</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setEnviarRelatorioGoogle(!enviarRelatorioGoogle)}
                                        className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${enviarRelatorioGoogle ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                                    >
                                        {enviarRelatorioGoogle ? 'ATIVADO' : 'DESATIVADO'}
                                    </button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* TAB: FINANCEIRO */}
                        <TabsContent value="financeiro" className="space-y-6 animate-in slide-in-from-left-4 duration-500">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Forma de Pagamento</label>
                                    <select
                                        value={tipoPagamento}
                                        onChange={(e) => setTipoPagamento(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 outline-none appearance-none"
                                        disabled={isSaving}
                                    >
                                        <option value="Cartão" className="bg-[#0A0A0A]">Cartão de Crédito</option>
                                        <option value="Boleto" className="bg-[#0A0A0A]">Boleto Bancário</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-2">Valor Base (Recarga Mensal)</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">R$</span>
                                        <input
                                            type="number"
                                            value={valorBase}
                                            onChange={(e) => setValorBase(e.target.value)}
                                            placeholder="0,00"
                                            step="0.01"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-primary/50 outline-none"
                                            disabled={isSaving}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Valor de referência para cálculos de retorno.</p>
                                </div>
                            </div>
                        </TabsContent>

                    </Tabs>

                    <div className="pt-8 border-t border-white/10 flex justify-between items-center mt-8">
                        <button
                            type="button"
                            onClick={async () => {
                                if (window.confirm('Tem certeza que deseja excluir ESTE CLIENTE? Todos os dados serão perdidos permanente.')) {
                                    setIsDeleting(true);
                                    try {
                                        const { error } = await supabase.from('relatorio_clientes_bf_labs').delete().eq('id', selectedClient.id);
                                        if (error) throw error;
                                        toast.success('Cliente excluído');
                                        window.location.href = '/';
                                    } catch (e) { toast.error('Erro ao excluir'); setIsDeleting(false); }
                                }
                            }}
                            className="flex items-center gap-2 text-red-500/60 hover:text-red-400 text-sm font-medium transition-colors"
                            disabled={isDeleting || isSaving}
                        >
                            {isDeleting ? <Loader2 className="animate-spin w-4 h-4" /> : <Trash2 size={16} />}
                            {isDeleting ? 'Excluindo...' : 'Excluir Cliente'}
                        </button>

                        <button
                            type="submit"
                            className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-primary/70 hover:from-primary hover:to-primary/60 text-background font-bold shadow-lg shadow-primary/30 transition-all flex items-center gap-2"
                            disabled={isSaving}
                        >
                            {isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
