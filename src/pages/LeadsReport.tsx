import { useEffect, useState, useMemo } from 'react';
import { BarChart3, TrendingUp, Users, Info, ChevronDown, ChevronUp } from 'lucide-react';
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

interface Lead {
    id: number;
    created_at: string;
    origem: string;
    source_url?: string;
    conversion_source?: string;
    ctwa_clid?: string;
    lead_status?: string;
}

export function LeadsReport() {
    const { selectedClient } = useClient();
    const { dateRange } = useDateRange();

    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [showStatusInfo, setShowStatusInfo] = useState(false);

    useEffect(() => {
        async function fetchLeads() {
            if (!selectedClient) return;

            setLoading(true);
            const startDateStr = startOfDay(dateRange.startDate).toISOString();
            const endDateStr = endOfDay(dateRange.endDate).toISOString();

            const { data, error } = await supabase
                .from('relatorio_leads_cliente')
                .select('*')
                .eq('cliente_id', selectedClient.id)
                .gte('created_at', startDateStr)
                .lte('created_at', endDateStr);

            if (error) {
                console.error('Error fetching leads:', error);
            } else {
                setLeads(data || []);
            }
            setLoading(false);
        }

        fetchLeads();
    }, [selectedClient, dateRange]);

    // Process Metrics
    const metrics = useMemo(() => {
        // Harmonized platform colors - using primary and variations
        const PLATFORM_COLORS: Record<string, string> = {
            'Google Ads': '#CCFF00',
            'Facebook Ads': '#B8E600',
            'Instagram Ads': '#A3CC00',
            'Meta Ads (WhatsApp)': '#8FB300',
            'Orgânico': '#7A9900',
            'Outros': '#6B7280'
        };

        const total = leads.length;
        const bySource: Record<string, number> = {};
        const byStatus: Record<string, number> = {
            'Novo': 0,
            'Conectado': 0,
            'Engajado': 0,
            'SuperEngajado': 0
        };
        const timeline: Record<string, { Novo: number, Conectado: number, Engajado: number, SuperEngajado: number, date: string }> = {};
        const adsCount: Record<string, number> = {};

        leads.forEach(lead => {
            let source = 'Outros';
            let platform = 'Orgânico';

            try {
                let parsedJson: any = {};
                if (lead.origem) {
                    let parsed = lead.origem;
                    if (typeof parsed === 'string') {
                        try { parsed = JSON.parse(parsed); } catch (e) { }
                    }
                    if (typeof parsed === 'string' && parsed.trim().startsWith('{')) {
                        try { parsed = JSON.parse(parsed); } catch (e) { }
                    }

                    if (typeof parsed === 'object' && parsed !== null) {
                        parsedJson = parsed as OriginJSON;
                        const isTraffic =
                            parsedJson.conversionSource === 'FB_Ads' ||
                            parsedJson.sourceType === 'ad' ||
                            parsedJson.entryPointConversionSource === 'ctwa_ad';
                        source = isTraffic ? 'Tráfego' : 'Orgânico';
                    } else if (typeof parsed === 'string') {
                        source = 'Orgânico';
                    }
                }

                const lowerSourceUrl = (lead.source_url || '').toLowerCase();
                const lowerConvSource = (lead.conversion_source || '').toLowerCase();
                const sourceUrl = lowerSourceUrl || (parsedJson.sourceUrl || '').toLowerCase();
                const convSource = lowerConvSource || (parsedJson.conversionSource || '').toLowerCase();
                const sourceApp = (parsedJson.sourceApp || '').toLowerCase();

                if (sourceUrl.includes('google') || sourceUrl.includes('gclid')) {
                    platform = 'Google Ads';
                    source = 'Tráfego';
                } else if (sourceUrl.includes('facebook') || convSource === 'fb_ads' || sourceApp === 'facebook') {
                    platform = 'Facebook Ads';
                    source = 'Tráfego';
                } else if (sourceUrl.includes('instagram') || sourceApp === 'instagram') {
                    platform = 'Instagram Ads';
                    source = 'Tráfego';
                } else if (lead.ctwa_clid || parsedJson.ctwaClid) {
                    platform = 'Meta Ads (WhatsApp)';
                    source = 'Tráfego';
                } else if (lead.conversion_source) {
                    platform = lead.conversion_source;
                }

                if (platform === 'Orgânico' && parsedJson.conversionSource) {
                    platform = parsedJson.conversionSource;
                }

                if (sourceUrl && source === 'Tráfego') {
                    adsCount[sourceUrl] = (adsCount[sourceUrl] || 0) + 1;
                }

            } catch (e) {
                console.error('Error parsing lead origin', e);
            }

            bySource[platform] = (bySource[platform] || 0) + 1;

            const dateKey = format(parseISO(lead.created_at), 'dd/MM');
            if (!timeline[dateKey]) {
                timeline[dateKey] = { Novo: 0, Conectado: 0, Engajado: 0, SuperEngajado: 0, date: dateKey };
            }

            const status = lead.lead_status || 'Novo';
            byStatus[status] = (byStatus[status] || 0) + 1;

            if (Object.prototype.hasOwnProperty.call(timeline[dateKey], status)) {
                (timeline[dateKey] as any)[status]++;
            } else {
                timeline[dateKey]['Novo']++;
            }
        });

        const pieData = Object.entries(bySource).map(([name, value]) => ({
            name,
            value,
            color: PLATFORM_COLORS[name] || PLATFORM_COLORS['Outros']
        })).sort((a, b) => b.value - a.value);

        const timelineData = Object.values(timeline).sort((a, b) => {
            return a.date.localeCompare(b.date);
        });

        const topAds = Object.entries(adsCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 2)
            .map(([url, count]) => ({ url, count }));

        return { total, pieData, timelineData, topAds, byStatus };

    }, [leads]);

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Page Title */}
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <BarChart3 className="text-gray-400" size={32} />
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
                        <div className="p-3 bg-surface border border-white/10 text-gray-400 rounded-2xl">
                            <Users size={24} />
                        </div>
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Total</span>
                    </div>
                    <p className="text-4xl font-bold text-primary">
                        {loading ? '...' : metrics.total}
                    </p>
                    <p className="text-sm text-gray-500 mt-2 flex items-center gap-1">
                        <TrendingUp size={14} />
                        Performance Atual
                    </p>
                </div>

                {/* Distribution Cards */}
                {metrics.pieData.slice(0, 2).map((source) => (
                    <div key={source.name} className="glass-card rounded-[2rem] p-6 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent" />
                        <div className="flex items-center gap-3 mb-4 relative z-10">
                            <div className="w-2 h-2 rounded-full bg-primary" />
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">{source.name}</span>
                        </div>
                        <p className="text-4xl font-bold text-primary relative z-10">{source.value}</p>
                        <p className="text-sm text-gray-500 mt-2 relative z-10">
                            {metrics.total > 0 ? ((source.value / metrics.total) * 100).toFixed(1) : 0}% do total
                        </p>
                    </div>
                ))}

                {/* Top Ad Card */}
                <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Top 2 Anúncios</span>
                    </div>
                    <div className="space-y-3">
                        {metrics.topAds.length > 0 ? (
                            metrics.topAds.map((ad, i) => (
                                <div key={i} className="flex items-center justify-between text-sm">
                                    <a
                                        href={ad.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:text-primary/80 truncate max-w-[120px] underline"
                                        title={ad.url}
                                    >
                                        Anúncio {i + 1}
                                    </a>
                                    <span className="text-white font-mono bg-white/10 px-2 py-0.5 rounded text-xs">{ad.count} leads</span>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 text-sm">Nenhum dado de anúncio</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Engagement Status Funnel */}
                <div className="glass-card p-10 rounded-[2rem]">
                    <h3 className="text-xl font-bold text-white mb-8 flex items-center gap-3">
                        <div className="w-2 h-10 bg-primary rounded-full" />
                        Funil de Engajamento
                    </h3>

                    <div className="relative max-w-lg mx-auto aspect-[16/9]">
                        <svg viewBox="0 0 520 320" className="w-full h-full drop-shadow-2xl">
                            {/* Novo */}
                            <g className="group cursor-pointer">
                                <polygon
                                    points="0,0 400,0 360,80 40,80"
                                    className="fill-white/5 stroke-white/10 transition-all group-hover:fill-white/10"
                                />
                                <text x="200" y="45" textAnchor="middle" className="fill-primary font-bold text-2xl">
                                    {metrics.byStatus['Novo'] || 0}
                                </text>
                                <text x="420" y="45" className="fill-gray-400 text-sm font-medium">Novo</text>
                                <line x1="380" y1="40" x2="410" y2="40" className="stroke-white/10" />
                            </g>

                            {/* Conectado */}
                            <g className="group cursor-pointer">
                                <polygon
                                    points="40,80 360,80 320,160 80,160"
                                    className="fill-primary/10 stroke-primary/20 transition-all group-hover:fill-primary/15"
                                />
                                <text x="200" y="125" textAnchor="middle" className="fill-primary font-bold text-2xl">
                                    {metrics.byStatus['Conectado'] || 0}
                                </text>
                                <text x="420" y="125" className="fill-primary/60 text-sm font-medium">Conectado</text>
                                <line x1="340" y1="120" x2="410" y2="120" className="stroke-primary/20" />
                            </g>

                            {/* Engajado */}
                            <g className="group cursor-pointer">
                                <polygon
                                    points="80,160 320,160 280,240 120,240"
                                    className="fill-primary/20 stroke-primary/30 transition-all group-hover:fill-primary/25"
                                />
                                <text x="200" y="205" textAnchor="middle" className="fill-primary font-bold text-2xl">
                                    {metrics.byStatus['Engajado'] || 0}
                                </text>
                                <text x="420" y="205" className="fill-primary/70 text-sm font-medium">Engajado</text>
                                <line x1="300" y1="200" x2="410" y2="200" className="stroke-primary/30" />
                            </g>

                            {/* Super Engajado */}
                            <g className="group cursor-pointer">
                                <polygon
                                    points="120,240 280,240 240,320 160,320"
                                    className="fill-primary/30 stroke-primary/40 transition-all group-hover:fill-primary/35"
                                />
                                <text x="200" y="285" textAnchor="middle" className="fill-primary font-bold text-2xl">
                                    {metrics.byStatus['SuperEngajado'] || 0}
                                </text>
                                <text x="420" y="285" className="fill-primary text-sm font-medium">Super Engajado</text>
                                <line x1="260" y1="280" x2="410" y2="280" className="stroke-primary/40" />
                            </g>
                        </svg>
                    </div>

                    {/* Status Legend Dropdown */}
                    <div className="mt-4 border-t border-white/5 pt-4">
                        <button
                            onClick={() => setShowStatusInfo(!showStatusInfo)}
                            className="flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white transition-colors mx-auto"
                        >
                            <Info size={14} />
                            Entenda os Status
                            {showStatusInfo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        {showStatusInfo && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 animate-in fade-in slide-in-from-top-2">
                                <div className="bg-surface rounded-xl p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-white/30" />
                                        <span className="text-sm font-bold text-gray-300">Novo</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Lead recém importado ou capturado, sem interação.
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-primary/40" />
                                        <span className="text-sm font-bold text-primary/80">Conectado</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Lead respondeu à ativação inicial do vendedor.
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-primary/60" />
                                        <span className="text-sm font-bold text-primary/90">Engajado</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Lead com 4 ou mais janelas de conexão (trocas de mensagens).
                                    </p>
                                </div>

                                <div className="bg-surface rounded-xl p-3 border border-white/5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="w-2 h-2 rounded-full bg-primary" />
                                        <span className="text-sm font-bold text-primary">Super Engajado</span>
                                    </div>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Lead com 10 ou mais janelas de conexão (alta interatividade).
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Distribuição Pie Chart */}
                <div className="glass-card p-8 rounded-[2rem]">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                        <div className="w-2 h-8 bg-primary rounded-full" />
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
                                <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
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

            {/* Timeline Chart */}
            <div className="glass-card p-8 rounded-[2rem]">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3">
                    <div className="w-2 h-8 bg-primary rounded-full" />
                    Leads ao Longo do Tempo
                </h3>
                <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metrics.timelineData}>
                            <defs>
                                <linearGradient id="gradNovo" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradConectado" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradEngajado" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradSuper" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.5} />
                                    <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" stroke="#6B7280" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#6B7280" style={{ fontSize: '12px' }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1A1A1A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="Novo" stackId="1" stroke="#CCFF00" strokeOpacity={0.3} strokeWidth={1} fill="url(#gradNovo)" name="Novo" />
                            <Area type="monotone" dataKey="Conectado" stackId="1" stroke="#CCFF00" strokeOpacity={0.5} strokeWidth={1} fill="url(#gradConectado)" name="Conectado" />
                            <Area type="monotone" dataKey="Engajado" stackId="1" stroke="#CCFF00" strokeOpacity={0.7} strokeWidth={1} fill="url(#gradEngajado)" name="Engajado" />
                            <Area type="monotone" dataKey="SuperEngajado" stackId="1" stroke="#CCFF00" strokeWidth={2} fill="url(#gradSuper)" name="Super Engajado" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
