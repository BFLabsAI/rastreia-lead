import { useEffect, useState, useCallback } from 'react';
import { Users, Phone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Lead {
    id: number;
    created_at: string;
    telefone_lead: string;
    origem: string;
    source_url?: string; // New
    conversion_source?: string; // New
    ctwa_clid?: string; // New
}

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

export function Leads() {
    const { selectedClient } = useClient();
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchLeads = useCallback(async () => {
        if (!selectedClient) return;

        setLoading(true);
        const { data, error } = await supabase
            .from('relatorio_leads_cliente')
            .select('*')
            .eq('cliente_id', selectedClient.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching leads:', error);
        } else {
            setLeads(data || []);
        }
        setLoading(false);
    }, [selectedClient]);

    useEffect(() => {
        if (!selectedClient) return;
        fetchLeads();

        const channel = supabase
            .channel('table-db-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'relatorio_leads_cliente',
                filter: `cliente_id=eq.${selectedClient.id}`
            }, () => {
                fetchLeads();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedClient, fetchLeads]);

    const formatPhone = (phone: string) => {
        const cleaned = phone.replace(/\D/g, '');
        return `https://wa.me/55${cleaned}`;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Page Title */}
            <div>
                <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                    <Users className="text-indigo-400" size={32} />
                    Leads
                </h2>
                <p className="text-gray-400 mt-1 text-sm">
                    Lista de leads (tabela simplificada)
                </p>
            </div>

            {/* Simple Table */}
            <div className="glass-card rounded-[2rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/[0.02]">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Plataforma</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Origem</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Anúncio</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Data</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mx-auto" />
                                        <p className="text-gray-500 mt-4">Carregando leads...</p>
                                    </td>
                                </tr>
                            ) : leads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Users size={48} className="mb-4 text-gray-600" />
                                            <p>Nenhum lead encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                leads.map((lead) => {
                                    // Parse Origin Logic
                                    // Removed let declaration to avoid conflict with outer scope logic if merged
                                    let originType = 'Orgânico';
                                    let adUrl = null;

                                    // Use a temporary variable for the app source inside this block scope
                                    let internalSourceApp = '';

                                    try {
                                        if (lead.origem) {
                                            let parsed = lead.origem;
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

                                                originType = isTraffic ? 'Tráfego' : 'Orgânico';
                                                adUrl = json.sourceUrl || json.mediaUrl || null;
                                                internalSourceApp = json.sourceApp || json.entryPointConversionApp || '';
                                            } else if (typeof parsed === 'string') {
                                                originType = parsed;
                                            }
                                        }
                                    } catch (err) {
                                        console.error('Error parsing origin:', err);
                                    }

                                    // Platform Detection Logic
                                    let platform = 'Orgânico';
                                    let platformColor = 'bg-gray-500/10 text-gray-400 border-gray-500/20';

                                    const lowerSourceUrl = (lead.source_url || '').toLowerCase();
                                    const lowerConvSource = (lead.conversion_source || '').toLowerCase();

                                    // Helper to check parsed JSON if columns are empty
                                    let parsedJson: any = {};
                                    try {
                                        if (lead.origem && typeof lead.origem === 'string') {
                                            parsedJson = JSON.parse(lead.origem);
                                            if (typeof parsedJson === 'string') parsedJson = JSON.parse(parsedJson);
                                        } else if (typeof lead.origem === 'object') {
                                            parsedJson = lead.origem;
                                        }
                                    } catch (e) { }

                                    // Combined checks (DB columns + JSON fallback)
                                    const sourceUrl = lowerSourceUrl || (parsedJson.sourceUrl || '').toLowerCase();
                                    const convSource = lowerConvSource || (parsedJson.conversionSource || '').toLowerCase();
                                    const sourceApp = (internalSourceApp || '').toLowerCase();

                                    if (sourceUrl.includes('google') || sourceUrl.includes('gclid')) {
                                        platform = 'Google Ads';
                                        platformColor = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
                                    } else if (sourceUrl.includes('facebook') || convSource === 'fb_ads' || sourceApp === 'facebook') {
                                        platform = 'Facebook Ads';
                                        platformColor = 'bg-blue-600/10 text-blue-500 border-blue-600/20';
                                    } else if (sourceUrl.includes('instagram') || sourceApp === 'instagram') {
                                        platform = 'Instagram Ads';
                                        platformColor = 'bg-pink-500/10 text-pink-400 border-pink-500/20';
                                    } else if (lead.ctwa_clid || parsedJson.ctwaClid) {
                                        platform = 'Meta Ads (WhatsApp)';
                                        platformColor = 'bg-green-500/10 text-green-400 border-green-500/20';
                                    }

                                    // Display Phone Logic
                                    const displayPhone = lead.telefone_lead.replace('@s.whatsapp.net', '');

                                    return (
                                        <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="p-4">
                                                <p className="text-white font-medium font-mono">{displayPhone}</p>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${platformColor}`}>
                                                    {platform}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${originType === 'Tráfego'
                                                        ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                        }`}>
                                                        {originType}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {originType === 'Tráfego' && adUrl ? (
                                                    <a
                                                        href={adUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
                                                        title="Ver Anúncio"
                                                    >
                                                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/10">
                                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </div>
                                                        <span className="text-xs underline decoration-gray-600 hover:decoration-white hidden lg:inline">Link</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-gray-700 text-xs">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-gray-400 text-sm">
                                                {format(new Date(lead.created_at), 'dd/MM/yyyy - HH:mm', { locale: ptBR })}
                                            </td>
                                            <td className="p-4 text-right">
                                                <a
                                                    href={formatPhone(lead.telefone_lead)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium transition-all"
                                                >
                                                    <Phone size={14} />
                                                    WhatsApp
                                                </a>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
