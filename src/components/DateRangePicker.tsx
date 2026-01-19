import { useState, useRef, useEffect } from 'react';
import { Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useDateRange } from '../contexts/DateContext';

export function DateRangePicker() {
    const { dateRange, setDateRange } = useDateRange();
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef<HTMLDivElement>(null);

    // Local state for draft selection
    const [draftDate, setDraftDate] = useState<{ startDate: Date | null, endDate: Date | null }>({
        startDate: dateRange.startDate || null,
        endDate: dateRange.endDate || null
    });

    // Reset draft when opening
    useEffect(() => {
        if (isOpen) {
            setDraftDate({
                startDate: dateRange.startDate,
                endDate: dateRange.endDate
            });
        }
    }, [isOpen, dateRange]);

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

    const handleDateChange = (date: Date | null) => {
        if (!date) return;

        const { startDate, endDate } = draftDate;

        if (!startDate || (startDate && endDate)) {
            // Start new range
            setDraftDate({ startDate: date, endDate: null });
        } else if (date < startDate) {
            // Clicked before start, new start
            setDraftDate({ startDate: date, endDate: null });
        } else {
            // Complete range
            setDraftDate({ startDate: startDate, endDate: date });
            // Auto commit if complete? User usually expects to see it first.
            // Let's keep it draft until they click "Apply" or we can auto-apply if preferred.
            // For now, let's auto-apply like previous logic to be smooth.
            setDateRange({ startDate: startDate, endDate: date });
            setIsOpen(false);
        }
    };

    const formatDateRange = () => {
        const start = format(dateRange.startDate, 'dd/MM', { locale: ptBR });
        const end = format(dateRange.endDate, 'dd/MM/yyyy', { locale: ptBR });
        return `${start} - ${end}`;
    };

    // Shared Header Component
    const CustomHeader = ({ date, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: any) => (
        <div className="flex items-center justify-between px-2 py-2">
            <button
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                type="button"
                className={`p-1 hover:bg-white/10 rounded-lg transition-colors ${prevMonthButtonDisabled ? 'opacity-50 cursor-not-allowed hidden' : 'text-gray-400 hover:text-white'}`}
            >
                <ChevronLeft size={20} />
            </button>

            <span className="text-white font-bold capitalize">
                {format(date, 'MMMM yyyy', { locale: ptBR })}
            </span>

            <button
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                type="button"
                className={`p-1 hover:bg-white/10 rounded-lg transition-colors ${nextMonthButtonDisabled ? 'opacity-50 cursor-not-allowed hidden' : 'text-gray-400 hover:text-white'}`}
            >
                <ChevronRight size={20} />
            </button>
        </div>
    );

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
                    <div className="bg-[#0F1015] border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-4 min-w-[340px] md:min-w-fit">
                        <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
                            <h4 className="text-sm font-bold text-white">Selecionar Período</h4>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row gap-6 justify-center">
                            {/* Calendar 1 */}
                            <div className="date-picker-wrapper">
                                <DatePicker
                                    selected={draftDate.startDate}
                                    onChange={handleDateChange}
                                    startDate={draftDate.startDate}
                                    endDate={draftDate.endDate}
                                    selectsStart
                                    inline
                                    locale={ptBR}
                                    dateFormat="dd/MM/yyyy"
                                    calendarClassName="nexus-calendar"
                                    monthsShown={1}
                                    renderCustomHeader={CustomHeader}
                                />
                            </div>

                            {/* Divider for desktop */}
                            <div className="hidden md:block w-px bg-white/10"></div>

                            {/* Calendar 2 - Auto adjusted to next month initially if needed, logic handled by DatePicker state but we want independence */}
                            <div className="date-picker-wrapper">
                                <DatePicker
                                    selected={draftDate.endDate}
                                    onChange={handleDateChange}
                                    startDate={draftDate.startDate}
                                    endDate={draftDate.endDate}
                                    selectsEnd
                                    inline
                                    locale={ptBR}
                                    dateFormat="dd/MM/yyyy"
                                    calendarClassName="nexus-calendar"
                                    monthsShown={1}
                                    renderCustomHeader={CustomHeader}
                                    // Default to next month if no selection, or just let it float.
                                    // To ensure it doesn't duplicate the first calendar on open, we might want to set openToDate?
                                    // Note: React-Datepicker defaults to 'today' or 'selected'.
                                    // If we want it to show Next Month by default:
                                    openToDate={draftDate.endDate || new Date(new Date().setMonth(new Date().getMonth() + 1))}
                                />
                            </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-white/10 flex gap-2">
                            <button
                                onClick={() => {
                                    const start = new Date(new Date().setDate(new Date().getDate() - 7));
                                    const end = new Date();
                                    setDateRange({ startDate: start, endDate: end });
                                    setIsOpen(false);
                                }}
                                className="flex-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white transition-colors"
                            >
                                Últimos 7 dias
                            </button>
                            <button
                                onClick={() => {
                                    const start = new Date(new Date().setDate(new Date().getDate() - 30));
                                    const end = new Date();
                                    setDateRange({ startDate: start, endDate: end });
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
