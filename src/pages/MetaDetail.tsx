import { useEffect, useState, useMemo } from 'react';
import { Zap, Activity, Video, MessageCircle, TrendingUp, ChevronDown, ChevronRight, Eye, MousePointer, DollarSign, Target } from 'lucide-react';
import { useDateRange } from '../contexts/DateContext';
import { useClient } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';
import { Progress } from '../components/ui/progress';

interface Campaign {
    id: number;
    name: string;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    videoViews: number;
    engagements: number;
    conversations: number;
    ctr: number;
    cpm: number;
    isExpanded?: boolean;
    adsets?: AdSet[];
}

interface AdSet {
    id: number;
    name: string;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    videoViews: number;
    conversations: number;
    ctr: number;
    cpm: number;
    isExpanded?: boolean;
    ads?: Ad[];
}

interface Ad {
    id: number;
    name: string;
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    videoViews: number;
    conversations: number;
    ctr: number;
    cpm: number;
}

export function MetaDetail() {
    const { dateRange } = useDateRange();
    const { selectedClient } = useClient();

    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingAdsets, setLoadingAdsets] = useState<number | null>(null);
    const [loadingAds, setLoadingAds] = useState<number | null>(null);

    // Fetch Campaigns
    useEffect(() => {
        async function fetchCampaigns() {
            if (!selectedClient) return;
            setIsLoading(true);

            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                // Get facts grouped by campaign
                const { data: facts, error } = await supabase
                    .from('relatorio_meta_fact_ad_daily')
                    .select('campaign_id, spend, impressions, reach, clicks, video_views, post_engagements, messaging_conversations')
                    .eq('cliente_id', selectedClient.id)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr);

                if (error) throw error;

                // Aggregate by campaign
                const byCampaign = (facts || []).reduce((acc: any, row) => {
                    const cid = row.campaign_id;
                    if (!acc[cid]) acc[cid] = { spend: 0, imp: 0, reach: 0, clicks: 0, video: 0, eng: 0, conv: 0 };
                    acc[cid].spend += Number(row.spend) || 0;
                    acc[cid].imp += Number(row.impressions) || 0;
                    acc[cid].reach += Number(row.reach) || 0;
                    acc[cid].clicks += Number(row.clicks) || 0;
                    acc[cid].video += Number(row.video_views) || 0;
                    acc[cid].eng += Number(row.post_engagements) || 0;
                    acc[cid].conv += Number(row.messaging_conversations) || 0;
                    return acc;
                }, {});

                const campaignIds = Object.keys(byCampaign);
                if (campaignIds.length === 0) {
                    setCampaigns([]);
                    setIsLoading(false);
                    return;
                }

                // Get campaign names
                const { data: dims } = await supabase
                    .from('relatorio_meta_dim_campaigns')
                    .select('id, campaign_name')
                    .in('id', campaignIds);

                const merged: Campaign[] = (dims || []).map(dim => {
                    const stats = byCampaign[dim.id];
                    return {
                        id: dim.id,
                        name: dim.campaign_name,
                        spend: stats.spend,
                        impressions: stats.imp,
                        reach: stats.reach,
                        clicks: stats.clicks,
                        videoViews: stats.video,
                        engagements: stats.eng,
                        conversations: stats.conv,
                        ctr: stats.imp > 0 ? (stats.clicks / stats.imp) * 100 : 0,
                        cpm: stats.imp > 0 ? (stats.spend / stats.imp) * 1000 : 0,
                        isExpanded: false,
                        adsets: []
                    };
                }).sort((a, b) => b.spend - a.spend);

                setCampaigns(merged);
            } catch (err) {
                console.error('Error fetching Meta data:', err);
            } finally {
                setIsLoading(false);
            }
        }

        fetchCampaigns();
    }, [selectedClient, dateRange]);

    // Toggle Campaign -> Load AdSets
    const toggleCampaign = async (campaignId: number) => {
        const camp = campaigns.find(c => c.id === campaignId);
        if (!camp) return;

        if (camp.isExpanded) {
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, isExpanded: false } : c));
            return;
        }

        if (!camp.adsets || camp.adsets.length === 0) {
            setLoadingAdsets(campaignId);
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                // Get adsets for this campaign
                const { data: adsetDims } = await supabase
                    .from('relatorio_meta_dim_adsets')
                    .select('id, adset_name')
                    .eq('campaign_id', campaignId);

                if (adsetDims && adsetDims.length > 0) {
                    const adsetIds = adsetDims.map(a => a.id);

                    const { data: facts } = await supabase
                        .from('relatorio_meta_fact_ad_daily')
                        .select('adset_id, spend, impressions, reach, clicks, video_views, messaging_conversations')
                        .in('adset_id', adsetIds)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    const byAdset = (facts || []).reduce((acc: any, row) => {
                        const aid = row.adset_id;
                        if (!acc[aid]) acc[aid] = { spend: 0, imp: 0, reach: 0, clicks: 0, video: 0, conv: 0 };
                        acc[aid].spend += Number(row.spend) || 0;
                        acc[aid].imp += Number(row.impressions) || 0;
                        acc[aid].reach += Number(row.reach) || 0;
                        acc[aid].clicks += Number(row.clicks) || 0;
                        acc[aid].video += Number(row.video_views) || 0;
                        acc[aid].conv += Number(row.messaging_conversations) || 0;
                        return acc;
                    }, {});

                    const adsets: AdSet[] = adsetDims.map(dim => {
                        const stats = byAdset[dim.id] || { spend: 0, imp: 0, reach: 0, clicks: 0, video: 0, conv: 0 };
                        return {
                            id: dim.id,
                            name: dim.adset_name,
                            spend: stats.spend,
                            impressions: stats.imp,
                            reach: stats.reach,
                            clicks: stats.clicks,
                            videoViews: stats.video,
                            conversations: stats.conv,
                            ctr: stats.imp > 0 ? (stats.clicks / stats.imp) * 100 : 0,
                            cpm: stats.imp > 0 ? (stats.spend / stats.imp) * 1000 : 0,
                            isExpanded: false,
                            ads: []
                        };
                    }).filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend);

                    setCampaigns(prev => prev.map(c =>
                        c.id === campaignId ? { ...c, isExpanded: true, adsets } : c
                    ));
                }
            } catch (err) {
                console.error('Error loading adsets:', err);
            } finally {
                setLoadingAdsets(null);
            }
        } else {
            setCampaigns(prev => prev.map(c => c.id === campaignId ? { ...c, isExpanded: true } : c));
        }
    };

    // Toggle AdSet -> Load Ads
    const toggleAdset = async (campaignId: number, adsetId: number) => {
        const camp = campaigns.find(c => c.id === campaignId);
        const adset = camp?.adsets?.find(a => a.id === adsetId);
        if (!adset) return;

        if (adset.isExpanded) {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    adsets: c.adsets?.map(a => a.id === adsetId ? { ...a, isExpanded: false } : a)
                } : c
            ));
            return;
        }

        if (!adset.ads || adset.ads.length === 0) {
            setLoadingAds(adsetId);
            const startDateStr = format(startOfDay(dateRange.startDate), 'yyyy-MM-dd');
            const endDateStr = format(endOfDay(dateRange.endDate), 'yyyy-MM-dd');

            try {
                const { data: adDims } = await supabase
                    .from('relatorio_meta_dim_ads')
                    .select('id, ad_name')
                    .eq('adset_id', adsetId);

                if (adDims && adDims.length > 0) {
                    const adIds = adDims.map(a => a.id);

                    const { data: facts } = await supabase
                        .from('relatorio_meta_fact_ad_daily')
                        .select('ad_id, spend, impressions, reach, clicks, video_views, ctr, messaging_conversations')
                        .in('ad_id', adIds)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    const byAd = (facts || []).reduce((acc: any, row) => {
                        const aid = row.ad_id;
                        if (!acc[aid]) acc[aid] = { spend: 0, imp: 0, reach: 0, clicks: 0, video: 0, ctrSum: 0, count: 0, conv: 0 };
                        acc[aid].spend += Number(row.spend) || 0;
                        acc[aid].imp += Number(row.impressions) || 0;
                        acc[aid].reach += Number(row.reach) || 0;
                        acc[aid].clicks += Number(row.clicks) || 0;
                        acc[aid].video += Number(row.video_views) || 0;
                        acc[aid].ctrSum += Number(row.ctr) || 0;
                        acc[aid].conv += Number(row.messaging_conversations) || 0;
                        acc[aid].count++;
                        return acc;
                    }, {});

                    const ads: Ad[] = adDims.map(dim => {
                        const stats = byAd[dim.id] || { spend: 0, imp: 0, reach: 0, clicks: 0, video: 0, ctrSum: 0, count: 0, conv: 0 };
                        const imp = stats.imp;
                        return {
                            id: dim.id,
                            name: dim.ad_name,
                            spend: stats.spend,
                            impressions: stats.imp,
                            reach: stats.reach,
                            clicks: stats.clicks,
                            videoViews: stats.video,
                            conversations: stats.conv,
                            ctr: stats.count > 0 ? stats.ctrSum / stats.count : 0,
                            cpm: imp > 0 ? (stats.spend / imp) * 1000 : 0
                        };
                    }).filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend);

                    setCampaigns(prev => prev.map(c =>
                        c.id === campaignId ? {
                            ...c,
                            adsets: c.adsets?.map(a => a.id === adsetId ? { ...a, isExpanded: true, ads } : a)
                        } : c
                    ));
                }
            } catch (err) {
                console.error('Error loading ads:', err);
            } finally {
                setLoadingAds(null);
            }
        } else {
            setCampaigns(prev => prev.map(c =>
                c.id === campaignId ? {
                    ...c,
                    adsets: c.adsets?.map(a => a.id === adsetId ? { ...a, isExpanded: true } : a)
                } : c
            ));
        }
    };

    // Global metrics
    const metrics = useMemo(() => {
        return campaigns.reduce((acc, c) => ({
            spend: acc.spend + c.spend,
            clicks: acc.clicks + c.clicks,
            videoViews: acc.videoViews + c.videoViews,
            engagements: acc.engagements + c.engagements,
            conversations: acc.conversations + c.conversations
        }), { spend: 0, clicks: 0, videoViews: 0, engagements: 0, conversations: 0 });
    }, [campaigns]);

    const custoMensagem = metrics.conversations > 0 ? metrics.spend / metrics.conversations : 0;

    const formatCurrency = (val: number) => val >= 1000 ? `R$ ${(val / 1000).toFixed(2)}k` : `R$ ${val.toFixed(2)}`;
    const formatNumber = (val: number) => val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toString();

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <img src="/icon-meta-ads.png" alt="Meta Ads" className="w-8 h-8 object-contain brightness-0 invert" />
                    Meta Ads
                </h2>
                <p className="text-gray-400 mt-1 text-sm">
                    Clique nas campanhas para expandir → Conjuntos → Anúncios
                </p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass-card p-6 rounded-[2rem] h-40 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={64} className="text-cyan-400" /></div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Investimento</p>
                    <p className="text-3xl font-bold text-white">{isLoading ? '...' : formatCurrency(metrics.spend)}</p>
                </div>
                <div className="glass-card p-6 rounded-[2rem] h-40 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64} className="text-orange-400" /></div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Cliques</p>
                    <p className="text-3xl font-bold text-white">{isLoading ? '...' : formatNumber(metrics.clicks)}</p>
                </div>
                <div className="glass-card p-6 rounded-[2rem] h-40 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><MessageCircle size={64} className="text-green-400" /></div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Conversas</p>
                    <p className="text-3xl font-bold text-white">{isLoading ? '...' : formatNumber(metrics.conversations)}</p>
                </div>
                <div className="glass-card p-6 rounded-[2rem] h-40 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} className="text-blue-400" /></div>
                    <p className="text-gray-400 text-xs font-bold uppercase">Custo/Conversa</p>
                    <p className="text-3xl font-bold text-white">{isLoading ? '...' : formatCurrency(custoMensagem)}</p>
                </div>
            </div>

            {/* Extra metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass-card p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                        <Video className="text-pink-400" size={24} />
                        <p className="text-gray-400 text-xs font-bold uppercase">Video Views</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{isLoading ? '...' : formatNumber(metrics.videoViews)}</p>
                </div>
                <div className="glass-card p-6 rounded-[2rem]">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity className="text-purple-400" size={24} />
                        <p className="text-gray-400 text-xs font-bold uppercase">Engajamentos</p>
                    </div>
                    <p className="text-3xl font-bold text-white">{isLoading ? '...' : formatNumber(metrics.engagements)}</p>
                </div>
            </div>

            {/* Campaigns Drill-down Table */}
            <div className="glass-card rounded-[2rem] overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="w-2 h-8 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-full" />
                        Campanhas
                    </h3>
                </div>

                {isLoading ? (
                    <div className="p-12 text-center">
                        <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">Nenhuma campanha encontrada.</div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {campaigns.map(camp => (
                            <div key={camp.id}>
                                {/* Campaign Row */}
                                <div className="p-4 hover:bg-white/[0.02] cursor-pointer flex items-center gap-4" onClick={() => toggleCampaign(camp.id)}>
                                    <div className="w-6">
                                        {loadingAdsets === camp.id ? (
                                            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                        ) : camp.isExpanded ? (
                                            <ChevronDown className="text-cyan-400" size={20} />
                                        ) : (
                                            <ChevronRight className="text-gray-500" size={20} />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white font-bold">{camp.name}</p>
                                    </div>
                                    <div className="flex gap-6 text-right overflow-x-auto no-scrollbar">
                                        <div className="min-w-[80px]"><p className="text-[10px] text-gray-500 uppercase">Gasto</p><p className="text-cyan-400 font-mono font-bold text-sm">{formatCurrency(camp.spend)}</p></div>
                                        <div className="min-w-[80px]"><p className="text-[10px] text-gray-500 uppercase">Impr.</p><p className="text-gray-300 font-mono text-sm">{formatNumber(camp.impressions)}</p></div>
                                        <div className="min-w-[60px]"><p className="text-[10px] text-gray-500 uppercase">Clicks</p><p className="text-gray-300 font-mono text-sm">{camp.clicks}</p></div>
                                        <div className="min-w-[60px]"><p className="text-[10px] text-gray-500 uppercase">CTR</p><p className="text-orange-400 font-mono text-sm">{camp.ctr.toFixed(2)}%</p></div>
                                        <div className="min-w-[70px]"><p className="text-[10px] text-gray-500 uppercase">CPM</p><p className="text-purple-400 font-mono text-sm">R$ {camp.cpm.toFixed(2)}</p></div>
                                        <div className="min-w-[70px]"><p className="text-[10px] text-gray-500 uppercase">Conv.</p><p className="text-green-400 font-mono text-sm">{camp.conversations}</p></div>
                                    </div>
                                </div>

                                {/* AdSets - REDESIGNED WITH CARDS */}
                                {camp.isExpanded && camp.adsets && (
                                    <div className="p-4 bg-white/[0.01] border-l-2 border-cyan-500/30 ml-6 space-y-3">
                                        {camp.adsets.map(adset => {
                                            const spendPercentage = camp.spend > 0 ? (adset.spend / camp.spend) * 100 : 0;

                                            return (
                                                <div key={adset.id}>
                                                    {/* AdSet Card */}
                                                    <div
                                                        className="bg-white/[0.03] rounded-2xl p-4 border border-white/5 hover:border-cyan-500/30 transition-all cursor-pointer"
                                                        onClick={() => toggleAdset(camp.id, adset.id)}
                                                    >
                                                        {/* Header */}
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                                                                    {loadingAds === adset.id ? (
                                                                        <div className="w-3 h-3 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
                                                                    ) : adset.isExpanded ? (
                                                                        <ChevronDown className="text-cyan-400" size={14} />
                                                                    ) : (
                                                                        <ChevronRight className="text-cyan-400" size={14} />
                                                                    )}
                                                                </div>
                                                                <p className="text-white font-medium">{adset.name}</p>
                                                            </div>
                                                        </div>

                                                        {/* Progress Bar */}
                                                        <div className="mb-4">
                                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                                <span>Proporção do Gasto</span>
                                                                <span className="text-cyan-400 font-mono">{formatCurrency(adset.spend)} / {formatCurrency(camp.spend)}</span>
                                                            </div>
                                                            <Progress value={spendPercentage} variant="cyan" size="md" />
                                                        </div>

                                                        {/* Metrics Badges */}
                                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                                            <div className="bg-cyan-500/10 rounded-xl p-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                    <DollarSign size={12} className="text-cyan-400" />
                                                                    <span className="text-[10px] text-gray-500 uppercase">Gasto</span>
                                                                </div>
                                                                <p className="text-cyan-400 font-mono font-bold text-sm">{formatCurrency(adset.spend)}</p>
                                                            </div>
                                                            <div className="bg-gray-500/10 rounded-xl p-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                    <Eye size={12} className="text-gray-400" />
                                                                    <span className="text-[10px] text-gray-500 uppercase">Impr.</span>
                                                                </div>
                                                                <p className="text-gray-300 font-mono font-bold text-sm">{formatNumber(adset.impressions)}</p>
                                                            </div>
                                                            <div className="bg-blue-500/10 rounded-xl p-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                    <MousePointer size={12} className="text-blue-400" />
                                                                    <span className="text-[10px] text-gray-500 uppercase">Clicks</span>
                                                                </div>
                                                                <p className="text-blue-400 font-mono font-bold text-sm">{adset.clicks}</p>
                                                            </div>
                                                            <div className="bg-orange-500/10 rounded-xl p-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                    <TrendingUp size={12} className="text-orange-400" />
                                                                    <span className="text-[10px] text-gray-500 uppercase">CTR</span>
                                                                </div>
                                                                <p className="text-orange-400 font-mono font-bold text-sm">{adset.ctr.toFixed(2)}%</p>
                                                            </div>
                                                            <div className="bg-green-500/10 rounded-xl p-2.5 text-center">
                                                                <div className="flex items-center justify-center gap-1.5 mb-1">
                                                                    <Target size={12} className="text-green-400" />
                                                                    <span className="text-[10px] text-gray-500 uppercase">Conv.</span>
                                                                </div>
                                                                <p className="text-green-400 font-mono font-bold text-sm">{adset.conversations}</p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Ads - REDESIGNED */}
                                                    {adset.isExpanded && adset.ads && (
                                                        <div className="mt-3 ml-4 space-y-2">
                                                            {adset.ads.map(ad => {
                                                                const adSpendPercentage = adset.spend > 0 ? (ad.spend / adset.spend) * 100 : 0;

                                                                return (
                                                                    <div
                                                                        key={ad.id}
                                                                        className="bg-white/[0.02] rounded-xl p-3 border border-white/5 hover:border-blue-500/20 transition-all"
                                                                    >
                                                                        {/* Ad Name */}
                                                                        <p className="text-gray-300 text-sm font-medium mb-2 truncate">{ad.name}</p>

                                                                        {/* Mini Progress */}
                                                                        <div className="mb-3">
                                                                            <Progress value={adSpendPercentage} variant="blue" size="sm" />
                                                                        </div>

                                                                        {/* Ad Metrics */}
                                                                        <div className="grid grid-cols-5 gap-2">
                                                                            <div className="text-center">
                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Gasto</p>
                                                                                <p className="text-cyan-400/80 font-mono text-xs">{formatCurrency(ad.spend)}</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Impr.</p>
                                                                                <p className="text-gray-400 font-mono text-xs">{formatNumber(ad.impressions)}</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Clicks</p>
                                                                                <p className="text-blue-400/80 font-mono text-xs">{ad.clicks}</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">CTR</p>
                                                                                <p className="text-orange-400/80 font-mono text-xs">{ad.ctr.toFixed(2)}%</p>
                                                                            </div>
                                                                            <div className="text-center">
                                                                                <p className="text-[9px] text-gray-600 uppercase mb-0.5">Conv.</p>
                                                                                <p className="text-green-400/80 font-mono text-xs">{ad.conversations}</p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
