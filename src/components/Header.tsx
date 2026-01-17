import { useState } from 'react';
import { ChevronDown, Plus, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useClient } from '../contexts/ClientContext';
import { DateRangePicker } from './DateRangePicker';

interface HeaderProps {
    onNewLead: () => void;
}

export function Header({ onNewLead }: HeaderProps) {
    const { clients, selectedClient, selectClient, isLoading } = useClient();
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);

    return (
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 relative z-[100]">
            {/* Client Selector (Left) */}
            <div className="relative">
                <button
                    onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                    className="flex items-center gap-3 px-4 py-2 rounded-2xl hover:bg-white/5 transition-colors group"
                >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/30 transition-all text-white">
                        {selectedClient ? selectedClient.nome.substring(0, 2).toUpperCase() : <Users size={20} />}
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Cliente Selecionado</p>
                        <div className="flex items-center gap-2">
                            <h2 className="text-white font-bold text-lg leading-tight">
                                {isLoading ? 'Carregando...' : (selectedClient?.nome || 'Selecione um cliente')}
                            </h2>
                            <ChevronDown size={14} className={clsx("text-gray-500 transition-transform duration-300", isClientDropdownOpen && "rotate-180")} />
                        </div>
                    </div>
                </button>

                {isClientDropdownOpen && (
                    <div className="absolute left-0 top-full mt-2 w-64 bg-[#0F1015] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden p-1 animate-in fade-in slide-in-from-top-2">
                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {clients.map(client => (
                                <button
                                    key={client.id}
                                    onClick={() => {
                                        selectClient(client.id);
                                        setIsClientDropdownOpen(false);
                                    }}
                                    className={clsx(
                                        "w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3",
                                        selectedClient?.id === client.id
                                            ? "bg-white/10 text-white"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-2 h-2 rounded-full",
                                        selectedClient?.id === client.id ? "bg-indigo-500 shadow-[0_0_10px_#6366f1]" : "bg-gray-700"
                                    )} />
                                    <span className="font-medium">{client.nome}</span>
                                </button>
                            ))}
                            {clients.length === 0 && !isLoading && (
                                <div className="p-4 text-center text-gray-500 text-sm">Nenhum cliente encontrado</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Actions (Right) */}
            <div className="flex items-center gap-4 bg-[#0F1015]/80 backdrop-blur-md p-1.5 rounded-full border border-white/5 shadow-2xl relative z-[100]">

                {/* Date Range Picker */}
                <DateRangePicker />

                {/* Separator */}
                <div className="w-[1px] h-6 bg-white/10" />

                {/* New Lead Button (Primary Action) - Neon Style */}
                <button
                    onClick={onNewLead}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:bg-blue-500 transition-all active:scale-95 border border-blue-400/20"
                >
                    <Plus size={16} />
                    <span>NOVO LEAD</span>
                </button>
            </div>
        </header>
    );
}
