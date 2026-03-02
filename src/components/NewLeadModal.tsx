import React, { useState } from 'react';
import { X, Save, User, Phone, MessageSquare } from 'lucide-react';

interface NewLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
}

export function NewLeadModal({ isOpen, onClose, onSave }: NewLeadModalProps) {
    const [formData, setFormData] = useState({
        nome: '',
        telefone: '',
        origem: 'Indicação',
        observacao: ''
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-surface border border-white/10 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden glass-card animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="text-lg font-bold text-white">Novo Lead</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <User size={14} /> Nome
                        </label>
                        <input
                            required
                            type="text"
                            placeholder="Nome do cliente"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                            value={formData.nome}
                            onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <Phone size={14} /> Telefone
                        </label>
                        <input
                            required
                            type="tel"
                            placeholder="(11) 99999-9999"
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors"
                            value={formData.telefone}
                            onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400">Origem</label>
                        <div className="grid grid-cols-2 gap-2">
                            {['Google', 'Meta', 'Indicação', 'Outros'].map((origem) => (
                                <button
                                    key={origem}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, origem })}
                                    className={`px-4 py-2 rounded-lg text-sm border font-medium transition-all ${formData.origem === origem
                                            ? 'bg-primary/20 border-primary text-primary'
                                            : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'
                                        }`}
                                >
                                    {origem}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                            <MessageSquare size={14} /> Observação
                        </label>
                        <textarea
                            rows={3}
                            placeholder="Detalhes sobre o interesse..."
                            className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-primary transition-colors resize-none"
                            value={formData.observacao}
                            onChange={(e) => setFormData({ ...formData, observacao: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-4 bg-primary hover:bg-primary/90 text-background font-bold py-3 rounded-xl shadow-lg shadow-primary/30 hover:shadow-primary/50 hover:scale-[1.02] transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        Salvar Lead
                    </button>

                </form>
            </div>
        </div>
    );
}
