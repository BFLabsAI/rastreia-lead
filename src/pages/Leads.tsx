import { useEffect, useState, useCallback, useMemo } from 'react';
import { Users, Phone, Search, Filter, AlignLeft, Calendar, Link as LinkIcon, MessageSquare } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

interface Lead {
    id: number;
    created_at: string;
    telefone_lead: string;
    origem: string;
    source_url?: string;
    conversion_source?: string;
    ctwa_clid?: string;
    lead_name?: string;
    instance_name?: string;
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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrigin, setFilterOrigin] = useState('todos');
    const [filterInstance, setFilterInstance] = useState('todos');
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

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

    const displayPhone = (phone: string) => {
        return phone.replace('@s.whatsapp.net', '');
    };

    // Helper to process lead data
    const processLead = (lead: Lead) => {
        let originType = 'Orgânico';
        let adUrl = null;
        let parsedJson: any = {};

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
                    parsedJson = parsed as OriginJSON;
                    const json = parsedJson;
                    const isTraffic =
                        json.conversionSource === 'FB_Ads' ||
                        json.sourceType === 'ad' ||
                        json.entryPointConversionSource === 'ctwa_ad';

                    // Determine main origin label
                    if (json.conversionSource) {
                        originType = json.conversionSource;
                    } else if (isTraffic) {
                        originType = 'Tráfego Pago';
                    } else if (json.sourceApp) {
                        originType = json.sourceApp;
                    }

                    if (lead.conversion_source) {
                        originType = lead.conversion_source;
                    }

                    adUrl = json.sourceUrl || json.mediaUrl || null;
                } else if (typeof parsed === 'string') {
                    originType = parsed;
                }
            }
        } catch (err) {
            console.error('Error parsing origin:', err);
        }

        // Fallback checks
        if (!originType || originType === 'Orgânico') {
            if (lead.conversion_source) originType = lead.conversion_source;
        }

        return { originType, adUrl, parsedJson };
    };

    // Memoize processed leads for filtering and display
    const processedLeads = useMemo(() => {
        return leads.map(lead => {
            const { originType, adUrl, parsedJson } = processLead(lead);
            return {
                ...lead,
                processedOrigin: originType,
                adUrl,
                parsedJson
            };
        });
    }, [leads]);

    // Unique origins for filter dropdown
    const uniqueOrigins = useMemo(() => {
        const origins = new Set(processedLeads.map(l => l.processedOrigin));
        return Array.from(origins).sort();
    }, [processedLeads]);

    // Unique instances for filter dropdown
    const uniqueInstances = useMemo(() => {
        const instances = new Set(processedLeads.map(l => l.instance_name).filter(Boolean));
        return Array.from(instances).sort() as string[];
    }, [processedLeads]);

    // Filter leads
    const filteredLeads = useMemo(() => {
        return processedLeads.filter(lead => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                (lead.lead_name || '').toLowerCase().includes(searchLower) ||
                (lead.telefone_lead || '').includes(searchLower);

            const matchesOrigin = filterOrigin === 'todos' || lead.processedOrigin === filterOrigin;
            const matchesInstance = filterInstance === 'todos' || lead.instance_name === filterInstance;

            return matchesSearch && matchesOrigin && matchesInstance;
        });
    }, [processedLeads, searchTerm, filterOrigin]);

    const handleOpenDetails = (lead: any) => {
        setSelectedLead(lead);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Page Title & Filters */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Users className="text-primary" size={32} />
                        Leads
                    </h2>
                    <p className="text-gray-400 mt-1 text-sm">
                        Gerencie seus leads e visualize detalhes de conversão
                    </p>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <Input
                            placeholder="Buscar por nome ou telefone..."
                            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary/50 focus:ring-primary/20"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="relative min-w-[180px]">
                        <select
                            className="w-full h-10 px-3 py-2 bg-[#0F1015] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            value={filterOrigin}
                            onChange={(e) => setFilterOrigin(e.target.value)}
                        >
                            <option value="todos">Todas origens</option>
                            {uniqueOrigins.map(origin => (
                                <option key={origin} value={origin}>{origin}</option>
                            ))}
                        </select>
                        <Filter className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                    </div>

                    <div className="relative min-w-[180px]">
                        <select
                            className="w-full h-10 px-3 py-2 bg-[#0F1015] border border-white/10 rounded-md text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer"
                            value={filterInstance}
                            onChange={(e) => setFilterInstance(e.target.value)}
                        >
                            <option value="todos">Todas instâncias</option>
                            {uniqueInstances.map(instance => (
                                <option key={instance} value={instance}>{instance}</option>
                            ))}
                        </select>
                        <MessageSquare className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card rounded-[2rem] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-white/[0.02]">
                            <tr>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Nome</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Telefone</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Origem</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Instância</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase">Data</th>
                                <th className="p-4 text-xs font-semibold text-gray-500 uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
                                        <p className="text-gray-500 mt-4">Carregando leads...</p>
                                    </td>
                                </tr>
                            ) : filteredLeads.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Users size={48} className="mb-4 text-gray-600" />
                                            <p>Nenhum lead encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredLeads.map((lead) => (
                                    <tr key={lead.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-xs">
                                                    {(lead.lead_name || 'L').charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-white font-medium">
                                                    {lead.lead_name || 'Lead sem nome'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-300 font-mono text-sm">
                                            {displayPhone(lead.telefone_lead)}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${lead.processedOrigin === 'Orgânico'
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : 'bg-primary/10 text-primary border-primary/20'
                                                }`}>
                                                {lead.processedOrigin}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {lead.instance_name && (
                                                <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                                                    {lead.instance_name}
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {format(new Date(lead.created_at), 'dd/MM/yyyy - HH:mm', { locale: ptBR })}
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleOpenDetails(lead)}
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white text-xs font-medium transition-all border border-white/5"
                                            >
                                                <AlignLeft size={14} />
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Lead Details Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="bg-[#0F1015] border-white/10 text-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Users size={20} className="text-primary" />
                            Detalhes do Lead
                        </DialogTitle>
                    </DialogHeader>

                    {selectedLead && (
                        <div className="space-y-6 mt-4">
                            {/* Header Info */}
                            <div className="flex items-start gap-4 p-4 bg-white/5 rounded-xl border border-white/5">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-background font-bold text-lg">
                                    {(selectedLead.lead_name || 'L').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg text-white">
                                        {selectedLead.lead_name || 'Lead sem nome'}
                                    </h3>
                                    <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
                                        <Phone size={12} />
                                        {displayPhone(selectedLead.telefone_lead)}
                                    </div>
                                    {selectedLead.instance_name && (
                                        <div className="flex items-center gap-2 text-blue-400 text-sm mt-1">
                                            <MessageSquare size={12} />
                                            {selectedLead.instance_name}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 text-gray-500 text-xs mt-1">
                                        <Calendar size={12} />
                                        Criado em {format(new Date(selectedLead.created_at), 'dd/MM/yyyy às HH:mm', { locale: ptBR })}
                                    </div>
                                </div>
                            </div>

                            {/* Origin Details */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <LinkIcon size={14} />
                                    Origem da Conversão
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                        <span className="text-xs text-gray-500 block mb-1">Fonte</span>
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                                            {(selectedLead as any).processedOrigin}
                                        </Badge>
                                    </div>
                                    {(selectedLead as any).adUrl && (
                                        <div className="p-3 bg-white/[0.02] rounded-lg border border-white/5">
                                            <span className="text-xs text-gray-500 block mb-1">Link do Anúncio</span>
                                            <a
                                                href={(selectedLead as any).adUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-blue-400 hover:text-blue-300 hover:underline truncate block"
                                            >
                                                Visualizar Mídia
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Technical Data (Parsed) */}
                            {(selectedLead as any).parsedJson && Object.keys((selectedLead as any).parsedJson).length > 0 && (
                                <div className="space-y-3 pt-2 border-t border-white/5">
                                    <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                        <MessageSquare size={14} />
                                        Dados Técnicos
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                        {Object.entries({
                                            'Fonte de Conversão': (selectedLead as any).parsedJson.conversionSource,
                                            'Tipo de Fonte': (selectedLead as any).parsedJson.sourceType,
                                            'ID da Fonte': (selectedLead as any).parsedJson.sourceId,
                                            'App de Origem': (selectedLead as any).parsedJson.sourceApp,
                                            'Ponto de Entrada': (selectedLead as any).parsedJson.entryPointConversionSource,
                                            'App do Ponto de Entrada': (selectedLead as any).parsedJson.entryPointConversionApp,
                                            'Click ID (CTWA)': (selectedLead as any).parsedJson.ctwaClid,
                                            'Click ID (WhatsApp Call)': (selectedLead as any).parsedJson.clickToWhatsappCall,
                                            'URL da Fonte': (selectedLead as any).parsedJson.sourceUrl,
                                            'URL da Mídia': (selectedLead as any).parsedJson.mediaUrl,
                                        }).map(([label, value]) => {
                                            if (!value) return null;
                                            return (
                                                <div key={label} className="p-2 bg-white/[0.02] rounded-lg border border-white/5 flex flex-col">
                                                    <span className="text-gray-500 mb-0.5">{label}</span>
                                                    <span className="text-gray-300 font-mono break-all line-clamp-2" title={value as string}>
                                                        {value as string}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="pt-2">
                                <a
                                    href={formatPhone(selectedLead.telefone_lead)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-2 w-full p-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-medium transition-all shadow-lg shadow-green-900/20"
                                >
                                    <Phone size={18} />
                                    Iniciar Conversa no WhatsApp
                                </a>
                            </div>

                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </div>
    );
}
