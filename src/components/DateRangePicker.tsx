import { useState, useRef, useEffect } from 'react';
import { Calendar, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useDateRange } from '../contexts/DateContext';

export function DateRangePicker() {
    const { dateRange, setDateRange } = useDateRange();
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const formatDateRange = () => {
        const start = format(dateRange.startDate, 'dd/MM', { locale: ptBR });
        const end = format(dateRange.endDate, 'dd/MM/yyyy', { locale: ptBR });
        return `${start} - ${end}`;
    };

    return (
        <div className="relative" ref={pickerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-transparent hover:bg-white/5 text-sm text-gray-300 transition-all border border-transparent hover:border-white/5"
            >
                <Calendar size={16} className="text-gray-400" />
                <span className="font-medium">{formatDateRange()}</span>
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-3 z-[9999] animate-in fade-in slide-in-from-top-2">
                    <div className="bg-[#0F1015] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-4">
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                            <h4 className="text-sm font-bold text-white">Selecionar Período</h4>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="date-picker-wrapper">
                            <DatePicker
                                selected={dateRange.startDate}
                                onChange={(dates) => {
                                    const [start, end] = dates as [Date | null, Date | null];
                                    if (start && end) {
                                        // Both dates selected - update and close
                                        setDateRange({ startDate: start, endDate: end });
                                        setIsOpen(false);
                                    } else if (start && !end) {
                                        // Only start date selected - keep picker open for end date
                                        setDateRange({ startDate: start, endDate: start });
                                    }
                                }}
                                startDate={dateRange.startDate}
                                endDate={dateRange.endDate}
                                selectsRange
                                inline
                                locale={ptBR}
                                dateFormat="dd/MM/yyyy"
                                calendarClassName="nexus-calendar"
                                monthsShown={2}
                            />
                        </div>

                        <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                            <button
                                onClick={() => {
                                    setDateRange({
                                        startDate: new Date(new Date().setDate(new Date().getDate() - 7)),
                                        endDate: new Date()
                                    });
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
                            >
                                Últimos 7 dias
                            </button>
                            <button
                                onClick={() => {
                                    setDateRange({
                                        startDate: new Date(new Date().setDate(new Date().getDate() - 30)),
                                        endDate: new Date()
                                    });
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
                            >
                                Últimos 30 dias
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
