import { useState, useEffect } from 'react';
import { MessageSquareQuote, Plus, Trash2, Loader2, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface PhraseOrigin {
    id: string;
    frase: string;
    origem: string;
}

export function Phrases() {
    const navigate = useNavigate();
    const { selectedClient } = useClient();
    const [phrases, setPhrases] = useState<PhraseOrigin[]>([]);
    const [currentPhrase, setCurrentPhrase] = useState('');
    const [currentOrigin, setCurrentOrigin] = useState('');
    const [isLoadingPhrases, setIsLoadingPhrases] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (selectedClient) {
            loadPhrases(selectedClient.id);
        }
    }, [selectedClient]);

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

    if (!selectedClient) {
        return (
            <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                <h2 className="text-white text-xl mb-4">Nenhum cliente selecionado</h2>
                <button onClick={() => navigate('/')} className="text-indigo-400 hover:text-indigo-300 transition-colors">Voltar para Dashboard</button>
            </div>
        );
    }

    const filteredPhrases = phrases.filter(p =>
        p.frase.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.origem.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                        <MessageSquareQuote size={32} className="text-indigo-500" />
                        Frases e Origens
                    </h1>
                    <p className="text-gray-400">Gerencie as frases de rastreamento para identificar a origem dos leads do cliente <span className="text-white font-medium">{selectedClient.nome}</span>.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Form Section */}
                <div className="lg:col-span-1">
                    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-6 shadow-xl sticky top-8">
                        <h2 className="text-lg font-semibold text-white mb-6 border-b border-white/5 pb-4">Nova Regra</h2>

                        <div className="space-y-5">
                            <div>
                                <label className="text-sm font-medium text-gray-400 block mb-2">Frase Identificadora</label>
                                <input
                                    type="text"
                                    value={currentPhrase}
                                    onChange={(e) => setCurrentPhrase(e.target.value)}
                                    placeholder="Ex: vim pelo instagram"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-gray-600"
                                />
                                <p className="text-xs text-gray-500 mt-2">A frase exata ou parcial que o cliente envia.</p>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-400 block mb-2">Origem Atribuída</label>
                                <input
                                    type="text"
                                    value={currentOrigin}
                                    onChange={(e) => setCurrentOrigin(e.target.value)}
                                    placeholder="Ex: Instagram"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:border-indigo-500/50 outline-none transition-all placeholder:text-gray-600"
                                />
                                <p className="text-xs text-gray-500 mt-2">A origem que será salva no relatório.</p>
                            </div>

                            <button
                                onClick={handleAddPhrase}
                                disabled={isLoadingPhrases}
                                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-4"
                            >
                                <Plus size={20} />
                                Adicionar Regra
                            </button>
                        </div>
                    </div>
                </div>

                {/* List Section */}
                <div className="lg:col-span-2">
                    <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <div className="p-6 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <h2 className="text-lg font-semibold text-white">Regras Ativas ({phrases.length})</h2>

                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar regras..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:border-indigo-500/50 outline-none w-full sm:w-64"
                                />
                            </div>
                        </div>

                        <div className="p-6">
                            {isLoadingPhrases ? (
                                <div className="flex justify-center py-12">
                                    <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
                                </div>
                            ) : filteredPhrases.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {filteredPhrases.map((item) => (
                                        <div key={item.id} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all group flex flex-col justify-between min-h-[100px]">
                                            <div className="flex justify-between items-start mb-3">
                                                <span className="text-xs font-bold text-indigo-300 bg-indigo-500/20 px-2.5 py-1 rounded-md border border-indigo-500/20">
                                                    {item.origem}
                                                </span>
                                                <button
                                                    onClick={() => handleDeletePhrase(item.id)}
                                                    className="p-1.5 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    title="Excluir regra"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                            <p className="text-white font-medium text-lg">"{item.frase}"</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-16 border-2 border-dashed border-white/5 rounded-xl">
                                    <MessageSquareQuote size={48} className="text-gray-700 mx-auto mb-4" />
                                    <p className="text-gray-500 text-lg">Nenhuma regra encontrada.</p>
                                    <p className="text-gray-600 text-sm mt-1">Utilize o formulário ao lado para adicionar novas regras.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
