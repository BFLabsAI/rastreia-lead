import { useEffect, useState, useMemo } from 'react';
import { Zap, Activity, Video, MessageCircle, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react';
import { useDateRange } from '../contexts/DateContext';
import { useClient } from '../contexts/ClientContext';
import { supabase } from '../lib/supabase';
import { format, startOfDay, endOfDay } from 'date-fns';

interface Campaign {
    id: number;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    videoViews: number;
    engagements: number;
    conversations: number;
    isExpanded?: boolean;
    adsets?: AdSet[];
}

interface AdSet {
    id: number;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    videoViews: number;
    isExpanded?: boolean;
    ads?: Ad[];
}

interface Ad {
    id: number;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    videoViews: number;
    ctr: number;
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
                    .select('campaign_id, spend, impressions, clicks, video_views, post_engagements, messaging_conversations')
                    .eq('cliente_id', selectedClient.id)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr);

                if (error) throw error;

                // Aggregate by campaign
                const byCampaign = (facts || []).reduce((acc: any, row) => {
                    const cid = row.campaign_id;
                    if (!acc[cid]) acc[cid] = { spend: 0, imp: 0, clicks: 0, video: 0, eng: 0, conv: 0 };
                    acc[cid].spend += Number(row.spend) || 0;
                    acc[cid].imp += Number(row.impressions) || 0;
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
                        clicks: stats.clicks,
                        videoViews: stats.video,
                        engagements: stats.eng,
                        conversations: stats.conv,
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
                        .select('adset_id, spend, impressions, clicks, video_views')
                        .in('adset_id', adsetIds)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    const byAdset = (facts || []).reduce((acc: any, row) => {
                        const aid = row.adset_id;
                        if (!acc[aid]) acc[aid] = { spend: 0, imp: 0, clicks: 0, video: 0 };
                        acc[aid].spend += Number(row.spend) || 0;
                        acc[aid].imp += Number(row.impressions) || 0;
                        acc[aid].clicks += Number(row.clicks) || 0;
                        acc[aid].video += Number(row.video_views) || 0;
                        return acc;
                    }, {});

                    const adsets: AdSet[] = adsetDims.map(dim => ({
                        id: dim.id,
                        name: dim.adset_name,
                        spend: byAdset[dim.id]?.spend || 0,
                        impressions: byAdset[dim.id]?.imp || 0,
                        clicks: byAdset[dim.id]?.clicks || 0,
                        videoViews: byAdset[dim.id]?.video || 0,
                        isExpanded: false,
                        ads: []
                    })).filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend);

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
                        .select('ad_id, spend, impressions, clicks, video_views, ctr')
                        .in('ad_id', adIds)
                        .gte('date', startDateStr)
                        .lte('date', endDateStr);

                    const byAd = (facts || []).reduce((acc: any, row) => {
                        const aid = row.ad_id;
                        if (!acc[aid]) acc[aid] = { spend: 0, imp: 0, clicks: 0, video: 0, ctrSum: 0, count: 0 };
                        acc[aid].spend += Number(row.spend) || 0;
                        acc[aid].imp += Number(row.impressions) || 0;
                        acc[aid].clicks += Number(row.clicks) || 0;
                        acc[aid].video += Number(row.video_views) || 0;
                        acc[aid].ctrSum += Number(row.ctr) || 0;
                        acc[aid].count++;
                        return acc;
                    }, {});

                    const ads: Ad[] = adDims.map(dim => ({
                        id: dim.id,
                        name: dim.ad_name,
                        spend: byAd[dim.id]?.spend || 0,
                        impressions: byAd[dim.id]?.imp || 0,
                        clicks: byAd[dim.id]?.clicks || 0,
                        videoViews: byAd[dim.id]?.video || 0,
                        ctr: byAd[dim.id]?.count > 0 ? byAd[dim.id].ctrSum / byAd[dim.id].count : 0
                    })).filter(a => a.spend > 0).sort((a, b) => b.spend - a.spend);

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
                    <Zap className="text-cyan-400" size={32} />
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
                                    <div className="flex gap-8 text-right">
                                        <div><p className="text-xs text-gray-500">Gasto</p><p className="text-cyan-400 font-mono font-bold">{formatCurrency(camp.spend)}</p></div>
                                        <div><p className="text-xs text-gray-500">Cliques</p><p className="text-gray-300 font-mono">{camp.clicks}</p></div>
                                        <div><p className="text-xs text-gray-500">Conversas</p><p className="text-green-400 font-mono">{camp.conversations}</p></div>
                                    </div>
                                </div>

                                {/* AdSets */}
                                {camp.isExpanded && camp.adsets && (
                                    <div className="bg-white/[0.01] border-l-2 border-cyan-500/30 ml-6">
                                        {camp.adsets.map(adset => (
                                            <div key={adset.id}>
                                                <div className="p-3 pl-6 hover:bg-white/[0.02] cursor-pointer flex items-center gap-4" onClick={() => toggleAdset(camp.id, adset.id)}>
                                                    <div className="w-5">
                                                        {loadingAds === adset.id ? (
                                                            <div className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                                        ) : adset.isExpanded ? (
                                                            <ChevronDown className="text-blue-400" size={16} />
                                                        ) : (
                                                            <ChevronRight className="text-gray-600" size={16} />
                                                        )}
                                                    </div>
                                                    <div className="flex-1"><p className="text-gray-300 text-sm font-medium">{adset.name}</p></div>
                                                    <div className="flex gap-6 text-right">
                                                        <div><p className="text-xs text-gray-600">Gasto</p><p className="text-cyan-400/80 font-mono text-sm">{formatCurrency(adset.spend)}</p></div>
                                                        <div><p className="text-xs text-gray-600">Cliques</p><p className="text-gray-400 font-mono text-sm">{adset.clicks}</p></div>
                                                    </div>
                                                </div>

                                                {/* Ads */}
                                                {adset.isExpanded && adset.ads && (
                                                    <div className="bg-white/[0.01] border-l-2 border-blue-500/20 ml-10 py-2">
                                                        {adset.ads.map(ad => (
                                                            <div key={ad.id} className="px-6 py-2 flex items-center gap-4">
                                                                <p className="flex-1 text-gray-400 text-xs">{ad.name}</p>
                                                                <div className="flex gap-4">
                                                                    <span className="text-cyan-400/70 text-xs font-mono">{formatCurrency(ad.spend)}</span>
                                                                    <span className="text-gray-500 text-xs font-mono">{ad.clicks} cliques</span>
                                                                    <span className="text-gray-500 text-xs font-mono">{ad.ctr.toFixed(2)}% CTR</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
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
