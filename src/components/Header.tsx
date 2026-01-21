import { Plus } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { DateRangePicker } from './DateRangePicker';

interface HeaderProps {
    onNewLead: () => void;
}

export function Header({ onNewLead }: HeaderProps) {
    const location = useLocation();

    const isWhatsApp = location.pathname.includes('/whatsapp');
    const isLeadsPage = location.pathname === '/leads';

    // Lista de rotas onde o date picker deve aparecer: Dash, Leads Report, Leads, Meta, Google
    const showDatePicker = ['/', '/leads-report', '/leads', '/meta', '/google'].includes(location.pathname);

    // Se estiver no WhatsApp, não renderiza o header para ganhar espaço vertical
    if (isWhatsApp) return null;

    // Se não tiver nenhum botão para mostrar (ex: outras páginas sem datepicker e nao é leads), talvez retornar null ou header vazio?
    // Por enquanto, vamos manter header se tiver date picker OU botão novo lead.
    if (!showDatePicker && !isLeadsPage) return null;

    return (
        <header className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6 relative z-[40]">
            {/* Actions (Right) */}
            <div className="flex items-center gap-4 bg-[#0F1015]/80 backdrop-blur-md p-1.5 rounded-full border border-white/5 shadow-2xl relative z-[40]">

                {/* Date Range Picker - Somente nas rotas especificas */}
                {showDatePicker && <DateRangePicker />}

                {/* Separator - Só mostra se tiver os dois elementos */}
                {showDatePicker && isLeadsPage && (
                    <div className="w-[1px] h-6 bg-white/10" />
                )}

                {/* New Lead Button (Primary Action) - Neon Style - Somente na aba leads */}
                {isLeadsPage && (
                    <button
                        onClick={onNewLead}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-blue-600 text-white font-bold text-sm shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] hover:bg-blue-500 transition-all active:scale-95 border border-blue-400/20"
                    >
                        <Plus size={16} />
                        <span>NOVO LEAD</span>
                    </button>
                )}
            </div>
        </header>
    );
}
