import { useEffect, useState, useMemo } from 'react';
import { MousePointer, Eye, Target, ChevronDown, ChevronRight, DollarSign, Search, TrendingUp } from 'lucide-react';
import { useDateRange } from '../contexts/DateContext';
import { useClient } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, format } from 'date-fns';
import { Progress } from '../components/ui/progress';

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
    adGroups?: AdGroup[];
}

interface AdGroup {
    id: number;
    name: string;
    status: string;
    clicks: number;
    impressions: number;
    cost: number;
    conversions: number;
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
    const [loadingAdGroups, setLoadingAdGroups] = useState<number | null>(null);
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
                // Fetch facts ONLY at campaign level (not ad group, keyword, or search term)
                const { data: facts, error: factsError } = await supabase
                    .from('relatorio_google_fact_search_term_performance')
                    .select('cost, impressions, clicks, conversions, ctr, average_cpc, campaign_id')
                    .eq('cliente_id', selectedClient.id)
                    .is('ad_group_id', null)  // Only campaign level
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

    // Toggle Campaign Expansion & Load Ad Groups
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

        // Load ad groups if not already loaded
        if (!camp.adGroups || camp.adGroups.length === 0) {
            setLoadingAdGroups(campaignId);
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                // Fetch Ad Groups
                let adGroups: AdGroup[] = [];
                const { data: dimAdGroups } = await supabase
                    .from('relatorio_google_dim_ad_groups')
                    .select('id, ad_group_name, status')
                    .eq('campaign_id', campaignId);

                if (dimAdGroups && dimAdGroups.length > 0) {
                    const adGroupIds = dimAdGroups.map(ag => ag.id);

                    // Fetch facts ONLY at ad group level (not keyword or search term level)
                    const { data: agFacts } = await supabase
                        .from('relatorio_google_fact_search_term_performance')
                        .select('ad_group_id, clicks, impressions, cost, conversions')
                        .in('ad_group_id', adGroupIds)
                        .is('keyword_id', null)  // Only ad group level
                        .is('search_term_id', null)  // Only ad group level
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    const agAgg = (agFacts || []).reduce((acc: any, curr) => {
                        const aid = curr.ad_group_id;
                        if (!acc[aid]) acc[aid] = { clicks: 0, imp: 0, cost: 0, conv: 0 };
                        acc[aid].clicks += curr.clicks || 0;
                        acc[aid].imp += curr.impressions || 0;
                        acc[aid].cost += Number(curr.cost) || 0;
                        acc[aid].conv += Number(curr.conversions) || 0;
                        return acc;
                    }, {});

                    adGroups = dimAdGroups.map(ag => ({
                        id: ag.id,
                        name: ag.ad_group_name,
                        status: ag.status,
                        clicks: agAgg[ag.id]?.clicks || 0,
                        impressions: agAgg[ag.id]?.imp || 0,
                        cost: agAgg[ag.id]?.cost || 0,
                        conversions: agAgg[ag.id]?.conv || 0,
                        isExpanded: false,
                        keywords: []
                    })).filter(ag => ag.clicks > 0 || ag.impressions > 0)
                        .sort((a, b) => b.cost - a.cost);
                }

                setCampaigns(prev => prev.map(c =>
                    c.id === campaignId ? { ...c, isExpanded: true, adGroups } : c
                ));

            } catch (err) {
                console.error("Error loading ad groups:", err);
            } finally {
                setLoadingAdGroups(null);
            }
        } else {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? { ...c, isExpanded: true } : c
            ));
        }
    };

    // Toggle Ad Group Expansion & Load Keywords
    const toggleAdGroup = async (campaignId: number, adGroupId: number) => {
        const camp = campaigns.find(c => c.id === campaignId);
        const adGroup = camp?.adGroups?.find(ag => ag.id === adGroupId);
        if (!adGroup) return;

        // If already expanded, collapse
        if (adGroup.isExpanded) {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    adGroups: c.adGroups?.map(ag =>
                        ag.id === adGroupId ? { ...ag, isExpanded: false } : ag
                    )
                } : c
            ));
            return;
        }

        // Load keywords if not already loaded
        if (!adGroup.keywords || adGroup.keywords.length === 0) {
            setLoadingKeywords(adGroupId);
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                let keywords: Keyword[] = [];
                const { data: dimKws } = await supabase
                    .from('relatorio_google_dim_keywords')
                    .select('id, keyword_text, match_type')
                    .eq('ad_group_id', adGroupId);

                if (dimKws && dimKws.length > 0) {
                    const kwIds = dimKws.map(k => k.id);
                    // Fetch facts ONLY at keyword level (not search term level)
                    const { data: kwFacts } = await supabase
                        .from('relatorio_google_fact_search_term_performance')
                        .select('keyword_id, clicks, impressions, cost, conversions')
                        .in('keyword_id', kwIds)
                        .is('search_term_id', null)  // Only keyword level
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    const kwAgg = (kwFacts || []).reduce((acc: any, curr) => {
                        const kid = curr.keyword_id;
                        if (!acc[kid]) acc[kid] = { clicks: 0, imp: 0, cost: 0, conv: 0 };
                        acc[kid].clicks += curr.clicks || 0;
                        acc[kid].imp += curr.impressions || 0;
                        acc[kid].cost += Number(curr.cost) || 0;
                        acc[kid].conv += Number(curr.conversions) || 0;
                        return acc;
                    }, {});

                    keywords = dimKws.map(k => ({
                        id: k.id,
                        text: k.keyword_text,
                        matchType: k.match_type,
                        clicks: kwAgg[k.id]?.clicks || 0,
                        impressions: kwAgg[k.id]?.imp || 0,
                        cost: kwAgg[k.id]?.cost || 0,
                        conversions: kwAgg[k.id]?.conv || 0,
                        isExpanded: false
                    })).filter(k => k.clicks > 0 || k.impressions > 0)
                        .sort((a, b) => b.clicks - a.clicks);
                }

                setCampaigns(prev => prev.map(c =>
                    c.id === campaignId ? {
                        ...c,
                        adGroups: c.adGroups?.map(ag =>
                            ag.id === adGroupId ? { ...ag, isExpanded: true, keywords } : ag
                        )
                    } : c
                ));

            } catch (err) {
                console.error("Error loading keywords:", err);
            } finally {
                setLoadingKeywords(null);
            }
        } else {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    adGroups: c.adGroups?.map(ag =>
                        ag.id === adGroupId ? { ...ag, isExpanded: true } : ag
                    )
                } : c
            ));
        }
    };

    // Toggle Keyword Expansion & Load Search Terms
    const toggleKeyword = async (campaignId: number, adGroupId: number, keywordId: number) => {
        const camp = campaigns.find(c => c.id === campaignId);
        const adGroup = camp?.adGroups?.find(ag => ag.id === adGroupId);
        const kw = adGroup?.keywords?.find(k => k.id === keywordId);
        if (!kw) return;

        // If already expanded, collapse
        if (kw.isExpanded) {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    adGroups: c.adGroups?.map(ag =>
                        ag.id === adGroupId ? {
                            ...ag,
                            keywords: ag.keywords?.map(k =>
                                k.id === keywordId ? { ...k, isExpanded: false } : k
                            )
                        } : ag
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
                // DEBUG: Log keyword ID
                console.log('Loading search terms for keyword:', keywordId);

                // Get Terms for this Keyword
                const { data: dimTerms, error: dimError } = await supabase
                    .from('relatorio_google_dim_search_terms')
                    .select('id, search_term_text')
                    .eq('keyword_id', keywordId);

                // DEBUG: Log results
                console.log('Search terms found:', dimTerms);

                if (dimError) throw dimError;

                if (dimTerms && dimTerms.length > 0) {
                    const termIds = dimTerms.map(t => t.id);

                    // Get Search Term-level facts
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
                            adGroups: c.adGroups?.map(ag =>
                                ag.id === adGroupId ? {
                                    ...ag,
                                    keywords: ag.keywords?.map(k =>
                                        k.id === keywordId ? { ...k, isExpanded: true, searchTerms } : k
                                    )
                                } : ag
                            )
                        } : c
                    ));
                } else {
                    setCampaigns(prev => prev.map(c =>
                        c.id === campaignId ? {
                            ...c,
                            adGroups: c.adGroups?.map(ag =>
                                ag.id === adGroupId ? {
                                    ...ag,
                                    keywords: ag.keywords?.map(k =>
                                        k.id === keywordId ? { ...k, isExpanded: true, searchTerms: [] } : k
                                    )
                                } : ag
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
                    adGroups: c.adGroups?.map(ag =>
                        ag.id === adGroupId ? {
                            ...ag,
                            keywords: ag.keywords?.map(k =>
                                k.id === keywordId ? { ...k, isExpanded: true } : k
                            )
                        } : ag
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

    const formatCurrency = (val: number) => val >= 1000 ? `R$ ${(val / 1000).toFixed(2)}k` : `R$ ${val.toFixed(2)}`;
    const formatNumber = (val: number) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toString();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header */}
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <img src="/icon-google-ads.png" alt="Google Ads" className="w-8 h-8 object-contain brightness-0 invert" />
                    Google Ads
                </h2>
                <p className="text-gray-400 mt-1 text-sm">
                    Clique nas campanhas para expandir grupos de anúncios → palavras-chave → termos de pesquisa
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <div
                            className="w-16 h-16 bg-[#CCFF00]"
                            style={{
                                maskImage: 'url(/cpc_medio-google.png)',
                                WebkitMaskImage: 'url(/cpc_medio-google.png)',
                                maskSize: 'contain',
                                WebkitMaskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                WebkitMaskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                WebkitMaskPosition: 'center'
                            }}
                        />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">CPC Médio</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : `R$ ${globalCPC.toFixed(2)}`}
                        </p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <div
                            className="w-16 h-16 bg-[#CCFF00]"
                            style={{
                                maskImage: 'url(/ctr_global-google.png)',
                                WebkitMaskImage: 'url(/ctr_global-google.png)',
                                maskSize: 'contain',
                                WebkitMaskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                WebkitMaskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                WebkitMaskPosition: 'center'
                            }}
                        />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">CTR Global</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : `${globalCTR.toFixed(2)}%`}
                        </p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <div
                            className="w-16 h-16 bg-[#CCFF00]"
                            style={{
                                maskImage: 'url(/total_cliques-google.png)',
                                WebkitMaskImage: 'url(/total_cliques-google.png)',
                                maskSize: 'contain',
                                WebkitMaskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                WebkitMaskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                WebkitMaskPosition: 'center'
                            }}
                        />
                    </div>
                    <div>
                        <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Cliques</p>
                        <p className="text-3xl font-bold text-white mt-2">
                            {isLoading ? '...' : globalMetrics.clicks.toLocaleString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between h-40 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} className="text-[#CCFF00]" /></div>
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
                                            {loadingAdGroups === camp.id ? (
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

                                    {/* Ad Groups - EXPANDABLE */}
                                    {camp.isExpanded && (
                                        <div className="p-4 bg-white/[0.01] border-l-2 border-lime-500/30 ml-6 space-y-3">
                                            {loadingAdGroups === camp.id ? (
                                                <div className="p-4 text-center">
                                                    <div className="w-6 h-6 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin mx-auto" />
                                                    <p className="text-gray-500 mt-2 text-sm">Carregando grupos de anúncios...</p>
                                                </div>
                                            ) : camp.adGroups && camp.adGroups.length > 0 ? (
                                                camp.adGroups.map(ag => {
                                                    const agCostPercentage = camp.cost > 0 ? (ag.cost / camp.cost) * 100 : 0;

                                                    return (
                                                        <div key={ag.id}>
                                                            {/* Ad Group Card */}
                                                            <div
                                                                className="bg-white/[0.03] rounded-2xl p-4 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer"
                                                                onClick={() => toggleAdGroup(camp.id, ag.id)}
                                                            >
                                                                {/* Ad Group Header */}
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                                                            {loadingKeywords === ag.id ? (
                                                                                <div className="w-3 h-3 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                                                            ) : ag.isExpanded ? (
                                                                                <ChevronDown className="text-cyan-400" size={14} />
                                                                            ) : (
                                                                                <ChevronRight className="text-cyan-400" size={14} />
                                                                            )}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-white font-medium">{ag.name}</p>
                                                                            <span className={`text-xs px-2 py-0.5 rounded ${ag.status === 'ENABLED' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                                                                                {ag.status === 'ENABLED' ? 'Ativo' : 'Pausado'}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Progress Bar */}
                                                                <div className="mb-4">
                                                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                                        <span>Proporção do Custo</span>
                                                                        <span className="text-cyan-400 font-mono">{formatCurrency(ag.cost)} / {formatCurrency(camp.cost)}</span>
                                                                    </div>
                                                                    <Progress value={agCostPercentage} variant="lime" size="md" />
                                                                </div>

                                                                {/* Ad Group Metrics */}
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                                                    <div className="bg-cyan-500/10 rounded-xl p-2.5 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                            <DollarSign size={12} className="text-cyan-400" />
                                                                            <span className="text-[10px] text-gray-500 uppercase">Custo</span>
                                                                        </div>
                                                                        <p className="text-cyan-400 font-mono font-bold text-sm">{formatCurrency(ag.cost)}</p>
                                                                    </div>
                                                                    <div className="bg-gray-500/10 rounded-xl p-2.5 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                            <Eye size={12} className="text-gray-400" />
                                                                            <span className="text-[10px] text-gray-500 uppercase">Impr.</span>
                                                                        </div>
                                                                        <p className="text-gray-300 font-mono font-bold text-sm">{formatNumber(ag.impressions)}</p>
                                                                    </div>
                                                                    <div className="bg-blue-500/10 rounded-xl p-2.5 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                            <MousePointer size={12} className="text-blue-400" />
                                                                            <span className="text-[10px] text-gray-500 uppercase">Cliques</span>
                                                                        </div>
                                                                        <p className="text-blue-400 font-mono font-bold text-sm">{ag.clicks}</p>
                                                                    </div>
                                                                    <div className="bg-green-500/10 rounded-xl p-2.5 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                            <Target size={12} className="text-green-400" />
                                                                            <span className="text-[10px] text-gray-500 uppercase">Conv.</span>
                                                                        </div>
                                                                        <p className="text-green-400 font-mono font-bold text-sm">{ag.conversions}</p>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            {/* Keywords inside Ad Group */}
                                                            {ag.isExpanded && ag.keywords && (
                                                                <div className="mt-3 ml-4 space-y-2">
                                                                    {ag.keywords.length > 0 ? (
                                                                        ag.keywords.map(kw => {
                                                                            const kwCostPercentage = ag.cost > 0 ? (kw.cost / ag.cost) * 100 : 0;

                                                                            return (
                                                                                <div key={kw.id}>
                                                                                    {/* Keyword Card */}
                                                                                    <div
                                                                                        className="bg-white/[0.02] rounded-xl p-3 border border-white/5 hover:border-lime-500/30 transition-all cursor-pointer"
                                                                                        onClick={() => toggleKeyword(camp.id, ag.id, kw.id)}
                                                                                    >
                                                                                        <div className="flex items-center gap-2 mb-2">
                                                                                            <div className="w-5 h-5 rounded bg-lime-500/10 flex items-center justify-center">
                                                                                                {loadingTerms === kw.id ? (
                                                                                                    <div className="w-2.5 h-2.5 border-2 border-lime-500/30 border-t-lime-500 rounded-full animate-spin" />
                                                                                                ) : kw.isExpanded ? (
                                                                                                    <ChevronDown className="text-lime-400" size={12} />
                                                                                                ) : (
                                                                                                    <ChevronRight className="text-lime-400" size={12} />
                                                                                                )}
                                                                                            </div>
                                                                                            <p className="text-gray-200 text-sm font-medium flex-1">{kw.text}</p>
                                                                                            {kw.matchType && (
                                                                                                <span className="text-[10px] text-gray-500 bg-white/5 px-1.5 py-0.5 rounded">
                                                                                                    {kw.matchType}
                                                                                                </span>
                                                                                            )}
                                                                                        </div>

                                                                                        <div className="mb-2">
                                                                                            <Progress value={kwCostPercentage} variant="lime" size="sm" />
                                                                                        </div>

                                                                                        <div className="grid grid-cols-4 gap-2">
                                                                                            <div className="text-center">
                                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Custo</p>
                                                                                                <p className="text-lime-400/80 font-mono text-xs">{formatCurrency(kw.cost)}</p>
                                                                                            </div>
                                                                                            <div className="text-center">
                                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Impr.</p>
                                                                                                <p className="text-gray-400 font-mono text-xs">{formatNumber(kw.impressions)}</p>
                                                                                            </div>
                                                                                            <div className="text-center">
                                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Cliques</p>
                                                                                                <p className="text-blue-400/80 font-mono text-xs">{kw.clicks}</p>
                                                                                            </div>
                                                                                            <div className="text-center">
                                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Conv.</p>
                                                                                                <p className="text-green-400/80 font-mono text-xs">{kw.conversions}</p>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>

                                                                                    {/* Search Terms */}
                                                                                    {kw.isExpanded && kw.searchTerms && (
                                                                                        <div className="mt-2 ml-4 space-y-1.5">
                                                                                            {kw.searchTerms.length > 0 ? (
                                                                                                kw.searchTerms.map(term => (
                                                                                                    <div
                                                                                                        key={term.id}
                                                                                                        className="bg-white/[0.015] rounded-lg p-2.5 border border-white/5"
                                                                                                    >
                                                                                                        <div className="flex items-center gap-2 mb-1.5">
                                                                                                            <Search size={10} className="text-lime-400/50" />
                                                                                                            <p className="text-gray-400 text-xs truncate flex-1">{term.text}</p>
                                                                                                        </div>
                                                                                                        <div className="grid grid-cols-4 gap-1.5">
                                                                                                            <div className="text-center">
                                                                                                                <p className="text-[8px] text-gray-600 uppercase">Custo</p>
                                                                                                                <p className="text-lime-400/70 font-mono text-[10px]">{formatCurrency(term.cost)}</p>
                                                                                                            </div>
                                                                                                            <div className="text-center">
                                                                                                                <p className="text-[8px] text-gray-600 uppercase">Impr.</p>
                                                                                                                <p className="text-gray-500 font-mono text-[10px]">{formatNumber(term.impressions)}</p>
                                                                                                            </div>
                                                                                                            <div className="text-center">
                                                                                                                <p className="text-[8px] text-gray-600 uppercase">Cliques</p>
                                                                                                                <p className="text-blue-400/70 font-mono text-[10px]">{term.clicks}</p>
                                                                                                            </div>
                                                                                                            <div className="text-center">
                                                                                                                <p className="text-[8px] text-gray-600 uppercase">Conv.</p>
                                                                                                                <p className="text-green-400/70 font-mono text-[10px]">{term.conversions}</p>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))
                                                                                            ) : (
                                                                                                <p className="px-4 py-1.5 text-gray-600 text-[10px]">Nenhum termo de pesquisa.</p>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })
                                                                    ) : (
                                                                        <p className="px-4 py-2 text-gray-600 text-xs">Nenhuma palavra-chave encontrada.</p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p className="p-4 pl-8 text-gray-500 text-sm">Nenhum grupo de anúncios encontrado.</p>
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
