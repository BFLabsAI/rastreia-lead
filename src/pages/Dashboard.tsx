import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useClient } from '../contexts/ClientContext';
import { useDateRange } from '../contexts/DateContext';
import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, format } from 'date-fns';

export function Dashboard() {
    const { selectedClient } = useClient();
    const { dateRange } = useDateRange();

    // State for metrics
    const [metaTotal, setMetaTotal] = useState(0);
    const [googleTotal, setGoogleTotal] = useState(0);
    const [leadsTotal, setLeadsTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    // State for chart data (last 7 days)
    const [metaChartData, setMetaChartData] = useState<{ val: number }[]>([]);
    const [googleChartData, setGoogleChartData] = useState<{ val: number }[]>([]);
    const [leadsChartData, setLeadsChartData] = useState<{ val: number }[]>([]);

    useEffect(() => {
        async function fetchDashboardData() {
            if (!selectedClient) return;
            setIsLoading(true);

            // Format for DATE columns (Meta uses 'date' column)
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            // ISO format for timestamp columns (Google/Leads use timestamp)
            const startDateISO = startOfDay(dateRange.startDate).toISOString();
            const endDateISO = endOfDay(dateRange.endDate).toISOString();

            try {
                // 1. Fetch Meta Ads Total - using new fact_ad_daily table
                const { data: metaData, error: metaError } = await supabase
                    .from('relatorio_meta_fact_ad_daily')
                    .select('spend, date')
                    .eq('cliente_id', selectedClient.id)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr);

                if (!metaError && metaData) {
                    const total = metaData.reduce((sum, row) => sum + (Number(row.spend) || 0), 0);
                    setMetaTotal(total);

                    // Group by date for chart
                    const byDate = metaData.reduce((acc: any, row) => {
                        const d = row.date;
                        acc[d] = (acc[d] || 0) + (Number(row.spend) || 0);
                        return acc;
                    }, {});
                    setMetaChartData(Object.values(byDate).map((v: any) => ({ val: v })));
                }

                // 2. Fetch Google Ads Total (only campaign level)
                const { data: googleData, error: googleError } = await supabase
                    .from('relatorio_google_fact_search_term_performance')
                    .select('cost, date')
                    .eq('cliente_id', selectedClient.id)
                    .is('ad_group_id', null)  // Only campaign level
                    .is('keyword_id', null)
                    .is('search_term_id', null)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr);

                if (!googleError && googleData) {
                    const total = googleData.reduce((sum, row) => sum + (Number(row.cost) || 0), 0);
                    setGoogleTotal(total);

                    const byDate = googleData.reduce((acc: any, row) => {
                        const d = row.date;
                        acc[d] = (acc[d] || 0) + (Number(row.cost) || 0);
                        return acc;
                    }, {});
                    setGoogleChartData(Object.values(byDate).map((v: any) => ({ val: v })));
                }

                // 3. Fetch Leads Total
                const { data: leadsData, error: leadsError } = await supabase
                    .from('relatorio_leads_cliente')
                    .select('created_at')
                    .eq('cliente_id', selectedClient.id)
                    .gte('created_at', startDateISO)
                    .lte('created_at', endDateISO);

                if (!leadsError && leadsData) {
                    setLeadsTotal(leadsData.length);

                    // Group by date
                    const byDate = leadsData.reduce((acc: any, row) => {
                        const d = format(new Date(row.created_at), 'yyyy-MM-dd');
                        acc[d] = (acc[d] || 0) + 1;
                        return acc;
                    }, {});
                    setLeadsChartData(Object.values(byDate).map((v: any) => ({ val: v })));
                }

            } catch (err) {
                console.error("Error fetching dashboard data:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchDashboardData();
    }, [selectedClient, dateRange]);

    // Format currency
    const formatCurrency = (value: number) => {
        if (value >= 1000) {
            return `R$ ${(value / 1000).toFixed(2)}k`;
        }
        return `R$ ${value.toFixed(2)}`;
    };

    const activeMeta = selectedClient?.active_meta !== false;
    const activeGoogle = selectedClient?.active_google !== false;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Title Section */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Dashboard Overview</h2>
                    <p className="text-gray-400 mt-1 text-sm">
                        {isLoading ? 'Carregando...' : 'Métricas em tempo real'}
                    </p>
                </div>
            </div>

            {/* Hero Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Meta Ads Card */}
                {activeMeta && (
                    <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group h-[26rem] flex flex-col justify-between">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Top Icon */}
                        <div className="flex flex-col items-center relative z-10 pt-4">
                            <div className="w-14 h-14 rounded-2xl bg-surface border border-white/10 flex items-center justify-center text-gray-400 mb-4 p-3">
                                <img src="/icon-meta-ads.png" alt="Meta Ads" className="w-full h-full object-contain brightness-0 invert" />
                            </div>
                            <span className="text-gray-500 font-medium text-sm tracking-widest uppercase">Meta Ads</span>
                        </div>

                        {/* Main Value */}
                        <div className="text-center relative z-10">
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-5xl font-bold text-primary tracking-tighter">
                                    {isLoading ? '...' : formatCurrency(metaTotal)}
                                </span>
                            </div>
                            <p className="text-primary text-xs mt-2 font-medium bg-primary/10 py-1 px-3 rounded-full inline-block border border-primary/20">
                                TOTAL INVESTIDO
                            </p>
                        </div>

                        {/* Chart Area */}
                        <div className="h-24 -mx-6 -mb-6 relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metaChartData.length > 0 ? metaChartData : [{ val: 0 }]}>
                                    <defs>
                                        <linearGradient id="colorMeta" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="val" stroke="#CCFF00" strokeWidth={2} fill="url(#colorMeta)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Google Ads Card */}
                {activeGoogle && (
                    <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group h-[26rem] flex flex-col justify-between">
                        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                        <div className="flex flex-col items-center relative z-10 pt-4">
                            <div className="w-14 h-14 rounded-2xl bg-surface border border-white/10 flex items-center justify-center text-gray-400 mb-4 p-3">
                                <img src="/icon-google-ads.png" alt="Google Ads" className="w-full h-full object-contain brightness-0 invert" />
                            </div>
                            <span className="text-gray-500 font-medium text-sm tracking-widest uppercase">Google Ads</span>
                        </div>

                        <div className="text-center relative z-10">
                            <div className="flex items-baseline justify-center gap-1">
                                <span className="text-5xl font-bold text-primary tracking-tighter">
                                    {isLoading ? '...' : formatCurrency(googleTotal)}
                                </span>
                            </div>
                            <p className="text-primary text-xs mt-2 font-medium bg-primary/10 py-1 px-3 rounded-full inline-block border border-primary/20">
                                TOTAL INVESTIDO
                            </p>
                        </div>

                        <div className="h-24 -mx-6 -mb-6 relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={googleChartData.length > 0 ? googleChartData : [{ val: 0 }]}>
                                    <defs>
                                        <linearGradient id="colorGoogle" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area type="monotone" dataKey="val" stroke="#CCFF00" strokeWidth={2} fill="url(#colorGoogle)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Leads Card */}
                <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group h-[26rem] flex flex-col justify-between">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="flex flex-col items-center relative z-10 pt-4">
                        <div className="w-14 h-14 rounded-2xl bg-surface border border-white/10 flex items-center justify-center text-gray-400 mb-4">
                            <Users size={28} />
                        </div>
                        <span className="text-gray-500 font-medium text-sm tracking-widest uppercase">Leads</span>
                    </div>

                    <div className="text-center relative z-10">
                        <div className="flex items-baseline justify-center gap-1">
                            <span className="text-5xl font-bold text-primary tracking-tighter">
                                {isLoading ? '...' : leadsTotal}
                            </span>
                        </div>
                        <p className="text-primary text-xs mt-2 font-medium bg-primary/10 py-1 px-3 rounded-full inline-block border border-primary/20">
                            TOTAL NO PERÍODO
                        </p>
                    </div>

                    <div className="h-24 -mx-6 -mb-6 relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-primary/10 to-transparent pointer-events-none" />
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={leadsChartData.length > 0 ? leadsChartData : [{ val: 0 }]}>
                                <defs>
                                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#CCFF00" stopOpacity={0.4} />
                                        <stop offset="95%" stopColor="#CCFF00" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area type="monotone" dataKey="val" stroke="#CCFF00" strokeWidth={2} fill="url(#colorLeads)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Combined Investment Card */}
                <div className="glass-card rounded-[2rem] p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center p-2.5">
                            <img src="/icon-investment.png" alt="Investimento Total" className="w-full h-full object-contain brightness-0 invert" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Investimento Total</p>
                            <p className="text-2xl font-bold text-primary">
                                {isLoading ? '...' : formatCurrency((activeMeta ? metaTotal : 0) + (activeGoogle ? googleTotal : 0))}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        {activeMeta && (
                            <div className="flex-1 bg-surface rounded-xl p-4 border border-white/5">
                                <p className="text-gray-500 text-xs font-medium uppercase">Meta</p>
                                <p className="text-white font-bold">{formatCurrency(metaTotal)}</p>
                            </div>
                        )}
                        {activeGoogle && (
                            <div className="flex-1 bg-surface rounded-xl p-4 border border-white/5">
                                <p className="text-gray-500 text-xs font-medium uppercase">Google</p>
                                <p className="text-white font-bold">{formatCurrency(googleTotal)}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Performance Summary */}
                <div className="glass-card rounded-[2rem] p-8">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-surface border border-white/10 flex items-center justify-center p-2.5">
                            <img src="/icon-cost-per-lead.png" alt="Custo por Lead" className="w-full h-full object-contain brightness-0 invert" />
                        </div>
                        <div>
                            <p className="text-gray-400 text-sm">Custo por Lead</p>
                            <p className="text-2xl font-bold text-primary">
                                {isLoading || leadsTotal === 0 ? '...' : formatCurrency((metaTotal + googleTotal) / leadsTotal)}
                            </p>
                        </div>
                    </div>
                    <p className="text-gray-500 text-sm">
                        {leadsTotal > 0
                            ? `${leadsTotal} leads captados no período selecionado`
                            : 'Nenhum lead captado no período'
                        }
                    </p>
                </div>
            </div>

        </div>
    );
}
