import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, MousePointer, Eye, Target, ChevronDown, ChevronRight } from 'lucide-react';
import { useDateRange } from '../contexts/DateContext';
import { useClient } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, format } from 'date-fns';

// --- Types ---

interface Campaign {
    id: number;
    name: string;
    status: string;
    type: string;
    cost: number;
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    isExpanded?: boolean;
    keywords?: Keyword[];
}

interface Keyword {
    id: number;
    text: string;
    matchType: string | null;
    clicks: number;
    impressions: number;
    cost: number;
    conversions: number;
    isExpanded?: boolean;
    searchTerms?: SearchTerm[];
}

interface SearchTerm {
    id: number;
    text: string;
    clicks: number;
    impressions: number;
    cost: number;
    conversions: number;
}

export function GoogleDetail() {
    const { dateRange } = useDateRange();
    const { selectedClient } = useClient();

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingKeywords, setLoadingKeywords] = useState<number | null>(null);
    const [loadingTerms, setLoadingTerms] = useState<number | null>(null);

    // Fetch Campaigns (only those with impressions > 0)
    useEffect(() => {
        async function fetchCampaigns() {
            if (!selectedClient) return;
            setIsLoading(true);

            // Format dates for DATE type columns
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                // Fetch ALL facts from unified fact table and aggregate by campaign
                const { data: facts, error: factsError } = await supabase
                    .from('relatorio_google_fact_search_term_performance')
                    .select('cost, impressions, clicks, conversions, ctr, average_cpc, campaign_id')
                    .eq('cliente_id', selectedClient.id)
                    .is('keyword_id', null)
                    .is('search_term_id', null)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr);

                if (factsError) throw factsError;

                // Group facts by campaign_id
                const factsByCamp = (facts || []).reduce((acc: any, curr) => {
                    const cid = curr.campaign_id;
                    if (!acc[cid]) acc[cid] = { cost: 0, imp: 0, clicks: 0, conv: 0 };
                    acc[cid].cost += Number(curr.cost || 0);
                    acc[cid].imp += Number(curr.impressions || 0);
                    acc[cid].clicks += Number(curr.clicks || 0);
                    acc[cid].conv += Number(curr.conversions || 0);
                    return acc;
                }, {});

                // Filter campaigns with impressions > 0
                const campaignIds = Object.keys(factsByCamp).filter(id => factsByCamp[id].imp > 0);

                if (campaignIds.length > 0) {
                    const { data: dims, error: dimsError } = await supabase
                        .from('relatorio_google_dim_campaigns')
                        .select('id, campaign_name, status, type')
                        .in('id', campaignIds);

                    if (dimsError) throw dimsError;

                    const merged = (dims || []).map(dim => {
                        const stats = factsByCamp[dim.id];
                        return {
                            id: dim.id,
                            name: dim.campaign_name,
                            status: dim.status,
                            type: dim.type,
                            cost: stats.cost,
                            impressions: stats.imp,
                            clicks: stats.clicks,
                            conversions: stats.conv,
                            ctr: stats.imp > 0 ? (stats.clicks / stats.imp) * 100 : 0,
                            isExpanded: false,
                            keywords: []
                        };
                    });
                    setCampaigns(merged);
                } else {
                    setCampaigns([]);
                }
            } catch (err) {
                console.error("Error fetching campaigns:", err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchCampaigns();
    }, [selectedClient, dateRange]);

    // Toggle Campaign Expansion & Load Keywords
    const toggleCampaign = async (campaignId: number) => {
        const camp = campaigns.find(c => c.id === campaignId);
        if (!camp) return;

        // If already expanded, just collapse
        if (camp.isExpanded) {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? { ...c, isExpanded: false } : c
            ));
            return;
        }

        // Load keywords if not already loaded
        if (!camp.keywords || camp.keywords.length === 0) {
            setLoadingKeywords(campaignId);
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                // Get Keyword Dims for this campaign
                const { data: dimKws, error: dimError } = await supabase
                    .from('relatorio_google_dim_keywords')
                    .select('id, keyword_text, match_type')
                    .eq('campaign_id', campaignId);

                if (dimError) throw dimError;

                if (dimKws && dimKws.length > 0) {
                    const kwIds = dimKws.map(k => k.id);

                    // Get ALL facts for these keywords (not just keyword-level summaries)
                    const { data: facts, error: factsError } = await supabase
                        .from('relatorio_google_fact_search_term_performance')
                        .select('keyword_id, clicks, impressions, cost, conversions')
                        .in('keyword_id', kwIds)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    if (factsError) throw factsError;

                    // Aggregate by keyword_id
                    const agg = (facts || []).reduce((acc: any, curr) => {
                        const kid = curr.keyword_id;
                        if (!acc[kid]) acc[kid] = { clicks: 0, imp: 0, cost: 0, conv: 0 };
                        acc[kid].clicks += curr.clicks || 0;
                        acc[kid].imp += curr.impressions || 0;
                        acc[kid].cost += Number(curr.cost) || 0;
                        acc[kid].conv += Number(curr.conversions) || 0;
                        return acc;
                    }, {});

                    const keywords: Keyword[] = dimKws.map(k => ({
                        id: k.id,
                        text: k.keyword_text,
                        matchType: k.match_type,
                        clicks: agg[k.id]?.clicks || 0,
                        impressions: agg[k.id]?.imp || 0,
                        cost: agg[k.id]?.cost || 0,
                        conversions: agg[k.id]?.conv || 0,
                        isExpanded: false,
                        searchTerms: []
                    })).filter(k => k.clicks > 0 || k.impressions > 0)
                        .sort((a, b) => b.clicks - a.clicks);

                    setCampaigns(prev => prev.map(c =>
                        c.id === campaignId ? { ...c, isExpanded: true, keywords } : c
                    ));
                } else {
                    // No keywords exist - show search terms directly as "keywords"
                    const { data: stDims } = await supabase
                        .from('relatorio_google_dim_search_terms')
                        .select('id, search_term_text')
                        .eq('campaign_id', campaignId);

                    if (stDims && stDims.length > 0) {
                        const stIds = stDims.map(s => s.id);

                        const { data: facts } = await supabase
                            .from('relatorio_google_fact_search_term_performance')
                            .select('search_term_id, clicks, impressions, cost, conversions')
                            .in('search_term_id', stIds)
                            .gte('date', startDateStr)
                            .lte('date', endDateStr);

                        const agg = (facts || []).reduce((acc: any, curr) => {
                            const sid = curr.search_term_id;
                            if (!acc[sid]) acc[sid] = { clicks: 0, imp: 0, cost: 0, conv: 0 };
                            acc[sid].clicks += curr.clicks || 0;
                            acc[sid].imp += curr.impressions || 0;
                            acc[sid].cost += Number(curr.cost) || 0;
                            acc[sid].conv += Number(curr.conversions) || 0;
                            return acc;
                        }, {});

                        // Show search terms as "keywords" (with isExpanded false so they don't expand further)
                        const keywords: Keyword[] = stDims.map(s => ({
                            id: s.id,
                            text: s.search_term_text,
                            matchType: 'Termo de Pesquisa',
                            clicks: agg[s.id]?.clicks || 0,
                            impressions: agg[s.id]?.imp || 0,
                            cost: agg[s.id]?.cost || 0,
                            conversions: agg[s.id]?.conv || 0,
                            isExpanded: false,
                            searchTerms: []
                        })).filter(k => k.clicks > 0 || k.impressions > 0)
                            .sort((a, b) => b.clicks - a.clicks);

                        setCampaigns(prev => prev.map(c =>
                            c.id === campaignId ? { ...c, isExpanded: true, keywords } : c
                        ));
                    } else {
                        setCampaigns(prev => prev.map(c =>
                            c.id === campaignId ? { ...c, isExpanded: true, keywords: [] } : c
                        ));
                    }
                }
            } catch (err) {
                console.error("Error loading keywords:", err);
            } finally {
                setLoadingKeywords(null);
            }
        } else {
            // Just expand
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? { ...c, isExpanded: true } : c
            ));
        }
    };

    // Toggle Keyword Expansion & Load Search Terms
    const toggleKeyword = async (campaignId: number, keywordId: number) => {
        const camp = campaigns.find(c => c.id === campaignId);
        const kw = camp?.keywords?.find(k => k.id === keywordId);
        if (!kw) return;

        // If already expanded, collapse
        if (kw.isExpanded) {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    keywords: c.keywords?.map(k =>
                        k.id === keywordId ? { ...k, isExpanded: false } : k
                    )
                } : c
            ));
            return;
        }

        // Load search terms for this keyword
        if (!kw.searchTerms || kw.searchTerms.length === 0) {
            setLoadingTerms(keywordId);
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                // Get Terms for this Keyword (now properly linked via keyword_id!)
                const { data: dimTerms, error: dimError } = await supabase
                    .from('relatorio_google_dim_search_terms')
                    .select('id, search_term_text')
                    .eq('keyword_id', keywordId);

                if (dimError) throw dimError;

                if (dimTerms && dimTerms.length > 0) {
                    const termIds = dimTerms.map(t => t.id);

                    // Get Search Term-level facts from unified table
                    const { data: facts, error: factsError } = await supabase
                        .from('relatorio_google_fact_search_term_performance')
                        .select('search_term_id, clicks, impressions, cost, conversions')
                        .in('search_term_id', termIds)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    if (factsError) throw factsError;

                    const agg = (facts || []).reduce((acc: any, curr) => {
                        const tid = curr.search_term_id;
                        if (!acc[tid]) acc[tid] = { clicks: 0, imp: 0, cost: 0, conv: 0 };
                        acc[tid].clicks += curr.clicks || 0;
                        acc[tid].imp += curr.impressions || 0;
                        acc[tid].cost += Number(curr.cost) || 0;
                        acc[tid].conv += Number(curr.conversions) || 0;
                        return acc;
                    }, {});

                    const searchTerms: SearchTerm[] = dimTerms.map(t => ({
                        id: t.id,
                        text: t.search_term_text,
                        clicks: agg[t.id]?.clicks || 0,
                        impressions: agg[t.id]?.imp || 0,
                        cost: agg[t.id]?.cost || 0,
                        conversions: agg[t.id]?.conv || 0
                    })).filter(t => t.clicks > 0)
                        .sort((a, b) => b.clicks - a.clicks);

                    setCampaigns(prev => prev.map(c =>
                        c.id === campaignId ? {
                            ...c,
                            keywords: c.keywords?.map(k =>
                                k.id === keywordId ? { ...k, isExpanded: true, searchTerms } : k
                            )
                        } : c
                    ));
                } else {
                    setCampaigns(prev => prev.map(c =>
                        c.id === campaignId ? {
                            ...c,
                            keywords: c.keywords?.map(k =>
                                k.id === keywordId ? { ...k, isExpanded: true, searchTerms: [] } : k
                            )
                        } : c
                    ));
                }
            } catch (err) {
                console.error("Error loading search terms:", err);
            } finally {
                setLoadingTerms(null);
            }
        } else {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    keywords: c.keywords?.map(k =>
                        k.id === keywordId ? { ...k, isExpanded: true } : k
                    )
                } : c
            ));
        }
    };

    // Global Metrics
    const globalMetrics = useMemo(() => {
        return campaigns.reduce((acc, curr) => ({
            cost: acc.cost + curr.cost,
            clicks: acc.clicks + curr.clicks,
            imp: acc.imp + curr.impressions,
            conv: acc.conv + curr.conversions
        }), { cost: 0, clicks: 0, imp: 0, conv: 0 });
    }, [campaigns]);

    const globalCPC = globalMetrics.clicks > 0 ? globalMetrics.cost / globalMetrics.clicks : 0;
    const globalCTR = globalMetrics.imp > 0 ? (globalMetrics.clicks / globalMetrics.imp) * 100 : 0;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <TrendingUp className="text-lime-400" size={32} />
                    Google Ads
                </h2>
                <p className="text-gray-400 mt-1 text-sm">
                    Clique nas campanhas para expandir palavras-chave → termos de pesquisa
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><MousePointer size={64} className="text-blue-400" /></div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">CPC Médio</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : `R$ ${globalCPC.toFixed(2)}`}
                        </p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Eye size={64} className="text-purple-400" /></div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">CTR Global</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : `${globalCTR.toFixed(2)}%`}
                        </p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Target size={64} className="text-green-400" /></div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Cliques</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : globalMetrics.clicks.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} className="text-yellow-400" /></div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Conversões</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : globalMetrics.conv}
                        </p>
                    </div>
                </div>
            </div>

            {/* Campaigns Table with Dropdown */}
            <div className="glass-card rounded-[2rem] overflow-hidden min-h-[400px]">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="w-2 h-8 bg-gradient-to-b from-lime-400 to-green-500 rounded-full" />
                        Campanhas Ativas
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    {isLoading ? (
                        <div className="p-12 text-center">
                            <div className="w-10 h-10 border-4 border-lime-500/30 border-t-lime-500 rounded-full animate-spin mx-auto" />
                            <p className="text-gray-500 mt-4">Carregando campanhas...</p>
                        </div>
                    ) : campaigns.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                            Nenhuma campanha com impressões encontrada no período.
                        </div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {campaigns.map(camp => (
                                <div key={camp.id}>
                                    {/* Campaign Row */}
                                    <div
                                        className="p-4 hover:bg-white/[0.02] cursor-pointer transition-colors flex items-center gap-4"
                                        onClick={() => toggleCampaign(camp.id)}
                                    >
                                        <div className="w-6">
                                            {loadingKeywords === camp.id ? (
                                                <div className="w-4 h-4 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin" />
                                            ) : camp.isExpanded ? (
                                                <ChevronDown className="text-lime-400" size={20} />
                                            ) : (
                                                <ChevronRight className="text-gray-500" size={20} />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-white font-bold">{camp.name}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className={`w-2 h-2 rounded-full ${camp.status === 'ENABLED' ? 'bg-green-500' : 'bg-gray-500'}`} />
                                                <span className="text-xs text-gray-400">{camp.status === 'ENABLED' ? 'Ativa' : 'Pausada'}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-4 gap-8 text-right">
                                            <div>
                                                <p className="text-xs text-gray-500">Impressões</p>
                                                <p className="text-gray-300 font-mono">{camp.impressions.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Cliques</p>
                                                <p className="text-gray-300 font-mono">{camp.clicks.toLocaleString('pt-BR')}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">CTR</p>
                                                <p className="text-gray-300 font-mono">{camp.ctr.toFixed(2)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500">Custo</p>
                                                <p className="text-lime-400 font-mono font-bold">R$ {camp.cost.toFixed(2)}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Keywords (Expanded) */}
                                    {camp.isExpanded && (
                                        <div className="bg-white/[0.01] border-l-2 border-lime-500/30 ml-6">
                                            {camp.keywords && camp.keywords.length > 0 ? (
                                                camp.keywords.map(kw => (
                                                    <div key={kw.id}>
                                                        {/* Keyword Row */}
                                                        <div
                                                            className={`p-3 pl-6 hover:bg-white/[0.02] transition-colors flex items-center gap-4 ${kw.matchType !== 'Termo de Pesquisa' ? 'cursor-pointer' : ''}`}
                                                            onClick={() => kw.matchType !== 'Termo de Pesquisa' && toggleKeyword(camp.id, kw.id)}
                                                        >
                                                            <div className="w-5">
                                                                {kw.matchType === 'Termo de Pesquisa' ? (
                                                                    <div className="w-4" /> // Placeholder
                                                                ) : loadingTerms === kw.id ? (
                                                                    <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                                                ) : kw.isExpanded ? (
                                                                    <ChevronDown className="text-blue-400" size={16} />
                                                                ) : (
                                                                    <ChevronRight className="text-gray-600" size={16} />
                                                                )}
                                                            </div>
                                                            <div className="flex-1">
                                                                <p className="text-gray-300 text-sm font-medium">{kw.text}</p>
                                                                {kw.matchType && (
                                                                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">
                                                                        {kw.matchType}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-6">
                                                                <div className="text-right">
                                                                    <p className="text-xs text-gray-600">Impressões</p>
                                                                    <p className="text-gray-400 font-mono text-sm">{kw.impressions.toLocaleString('pt-BR')}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-xs text-gray-600">Cliques</p>
                                                                    <p className="text-gray-400 font-mono text-sm">{kw.clicks}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-xs text-gray-600">Custo</p>
                                                                    <p className="text-lime-400/80 font-mono text-sm">R$ {kw.cost.toFixed(2)}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="text-xs text-gray-600">Conv</p>
                                                                    <p className="text-lime-400 font-mono text-sm">{kw.conversions}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Search Terms (Expanded) */}
                                                        {kw.isExpanded && (
                                                            <div className="bg-white/[0.01] border-l-2 border-blue-500/20 ml-10 py-2">
                                                                {kw.searchTerms && kw.searchTerms.length > 0 ? (
                                                                    kw.searchTerms.map(term => (
                                                                        <div key={term.id} className="px-6 py-2 flex items-center gap-4">
                                                                            <p className="flex-1 text-gray-400 text-xs">{term.text}</p>
                                                                            <div className="flex gap-4">
                                                                                <span className="text-gray-500 text-xs font-mono">{term.impressions} imp</span>
                                                                                <span className="text-gray-500 text-xs font-mono">{term.clicks} cliques</span>
                                                                                <span className="text-lime-400/70 text-xs font-mono">R$ {term.cost.toFixed(2)}</span>
                                                                                <span className="text-lime-400/70 text-xs font-mono">{term.conversions} conv</span>
                                                                            </div>
                                                                        </div>
                                                                    ))
                                                                ) : (
                                                                    <p className="px-6 py-2 text-gray-600 text-xs">Nenhum termo de pesquisa encontrado.</p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="p-4 pl-8 text-gray-500 text-sm">Nenhuma palavra-chave encontrada.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
}
