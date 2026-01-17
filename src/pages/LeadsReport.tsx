import { useEffect, useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { useDateRange } from '../contexts/DateContext';
import { useClient } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OriginJSON {
    conversionSource?: string;
    mediaUrl?: string;
    sourceType?: string;
    sourceId?: string;
    sourceUrl?: string;
    ctwaClid?: string;
    clickToWhatsappCall?: string;
    sourceApp?: string;
    entryPointConversionSource?: string;
    entryPointConversionApp?: string;
}

const COLORS = {
    'Tráfego': '#E1306C', // Using Instagram color for Traffic as representative
    'Orgânico': '#10B981',
    'Outros': '#6B7280'
};

export function LeadsReport() {
    // ... (existing hooks)

    // Process Metrics
    const metrics = useMemo(() => {
        const total = leads.length;
        const bySource: Record<string, number> = {};
        const timeline: Record<string, { trafego: number, organico: number, date: string }> = {};

        leads.forEach(lead => {
            let source = 'Outros';

            // Parsing Logic
            try {
                if (lead.origem) {
                    let parsed = lead.origem;
                    // Handle potential double stringification
                    if (typeof parsed === 'string') {
                        try { parsed = JSON.parse(parsed); } catch (e) { }
                    }
                    if (typeof parsed === 'string' && parsed.trim().startsWith('{')) {
                        try { parsed = JSON.parse(parsed); } catch (e) { }
                    }

                    if (typeof parsed === 'object' && parsed !== null) {
                        const json = parsed as OriginJSON;
                        const isTraffic =
                            json.conversionSource === 'FB_Ads' ||
                            json.sourceType === 'ad' ||
                            json.entryPointConversionSource === 'ctwa_ad';
                        source = isTraffic ? 'Tráfego' : 'Orgânico';
                    } else if (typeof parsed === 'string') {
                        // Simplify known string origins if needed, or default to Organico for unknown simple strings
                        // Checking common known simple strings if they exist, otherwise Organico
                        // For now, assuming if it's a simple string and not JSON, might be older organic data
                        source = 'Orgânico';
                    }
                }
            } catch (e) {
                console.error('Error parsing lead origin', e);
            }

            bySource[source] = (bySource[source] || 0) + 1;

            const dateKey = format(parseISO(lead.created_at), 'dd/MM');
            if (!timeline[dateKey]) {
                timeline[dateKey] = { trafego: 0, organico: 0, date: dateKey };
            }

            if (source === 'Tráfego') timeline[dateKey].trafego++;
            else timeline[dateKey].organico++;
        });

        const pieData = Object.entries(bySource).map(([name, value]) => ({
            name,
            value,
            color: COLORS[name as keyof typeof COLORS] || COLORS['Outros']
        })).sort((a, b) => b.value - a.value);

        const timelineData = Object.values(timeline).sort((a, b) => {
            // Simple string sort works for dd/MM if strictly within same year/month logic, 
            // but for safety in chart usually we want real dates. 
            // For now, sorting by date string simple.
            return a.date.localeCompare(b.date);
        });

        return { total, pieData, timelineData };

    }, [leads]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Page Title */}
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <BarChart3 className="text-purple-400" size={32} />
                    Relatório de Leads
                </h2>
                <p className="text-gray-400 mt-1 text-sm">
                    Análise detalhada de origem e performance • {format(dateRange.startDate, 'dd/MM', { locale: ptBR })} - {format(dateRange.endDate, 'dd/MM/yyyy', { locale: ptBR })}
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

                {/* Total Leads */}
                <div className="glass-card rounded-[2rem] p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl shadow-[0_0_15px_rgba(168,85,247,0.2)]">
                            <Users size={24} />
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Total</span>
                    </div>
                    <p className="text-4xl font-bold text-white">
                        {loading ? '...' : metrics.total}
                    </p>
                    <p className="text-sm text-purple-400 mt-2 flex items-center gap-1">
                        <TrendingUp size={14} />
                        Performance Atual
                    </p>
                </div>

                {/* Top Sources */}
                {metrics.pieData.slice(0, 3).map((source) => (
                    <div key={source.name} className="glass-card rounded-[2rem] p-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">{source.name}</span>
                        </div>
                        <p className="text-4xl font-bold text-white relative z-10">{source.value}</p>
                        <p className="text-sm text-gray-500 mt-2 relative z-10">
                            {metrics.total > 0 ? ((source.value / metrics.total) * 100).toFixed(1) : 0}% do total
                        </p>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Timeline Chart */}
                <div className="glass-card p-8 rounded-[2rem]">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-gradient-to-b from-purple-400 to-pink-500 rounded-full" />
                        Leads ao Longo do Tempo
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={metrics.timelineData}>
                                <defs>
                                    <linearGradient id="trafego" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#E1306C" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#E1306C" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="organico" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '12px' }} />
                                <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px' }} />
                                <Area type="monotone" dataKey="trafego" stroke="#E1306C" strokeWidth={2} fill="url(#trafego)" name="Tráfego" />
                                <Area type="monotone" dataKey="organico" stroke="#10B981" strokeWidth={2} fill="url(#organico)" name="Orgânico" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Distribuição Pie Chart */}
                <div className="glass-card p-8 rounded-[2rem]">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
                        Distribuição por Origem
                    </h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={metrics.pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {metrics.pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                        {metrics.pieData.map((source) => (
                            <div key={source.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }} />
                                <span className="text-xs text-gray-400">{source.name}</span>
                                <span className="text-xs font-bold text-white ml-auto">{source.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

        </div>
    );
}
