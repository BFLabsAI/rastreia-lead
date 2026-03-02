import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare, Image, FileText, Video, Mic, ArrowLeft, User, Clock, Phone, MapPin, Instagram, Facebook, LinkIcon, Info, Search, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useClient } from '../contexts/ClientContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';

interface Lead {
    id: string;
    telefone_lead: string;
    origem?: string;
    nome?: string;
}

interface LeadInfo {
    id: string;
    telefone_lead: string;
    lead_name: string | null;
    origem: string | null;
    instance_name: string | null;
    conversion_source: string | null;
    source_url: string | null;
    ctwa_clid: string | null;
    created_at: string | null;
}

interface OrigemData {
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

interface Message {
    id: string;
    client_id: string;
    instance_id: string | null;
    lead_id: string | null;
    direction: 'inbound' | 'outbound';
    message_type: string;
    content: string | null;
    media_url: string | null;
    sender_name: string | null;
    sent_at: string;
    is_read: boolean;
}

interface ConversationPreview {
    lead_id: string;
    lead_phone: string;
    lead_name: string | null;
    lead_source: string | null;
    lead_instance: string | null; // Added field
    last_message: string | null;
    last_message_at: string;
    unread_count: number;
}

// Helpers moved outside component
const parseOrigemData = (origem: string | null): OrigemData | null => {
    if (!origem) return null;
    try {
        let cleanJson = origem;
        if (cleanJson.startsWith('"')) {
            cleanJson = JSON.parse(cleanJson);
        }
        const data = typeof cleanJson === 'string' ? JSON.parse(cleanJson) : cleanJson;
        return data;
    } catch {
        return null;
    }
};

const hasRealOrigemData = (origemData: OrigemData | null): boolean => {
    if (!origemData) return false;
    return !!(
        origemData.conversionSource ||
        origemData.sourceApp ||
        origemData.sourceType ||
        origemData.sourceUrl ||
        origemData.mediaUrl
    );
};

const formatPhoneNumber = (phone: string): string => {
    const cleaned = phone.replace('@s.whatsapp.net', '');
    if (cleaned.length === 13 && cleaned.startsWith('55')) {
        return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    if (cleaned.length === 12 && cleaned.startsWith('55')) {
        return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return cleaned;
};

const getLeadSource = (lead: any) => {
    if (!lead) return null;
    if (lead.conversion_source) return lead.conversion_source;
    if (lead.origem) {
        const data = parseOrigemData(lead.origem);
        return data?.sourceApp || data?.conversionSource || null;
    }
    return null;
};

export function WhatsApp() {
    const { selectedClient } = useClient();
    const [conversations, setConversations] = useState<ConversationPreview[]>([]);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [leadInfo, setLeadInfo] = useState<LeadInfo | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [isLoadingConversations, setIsLoadingConversations] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [showLeadInfo, setShowLeadInfo] = useState(false);
    const selectedLeadIdRef = useRef<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterOrigem, setFilterOrigem] = useState<string>('all');
    const [filterInstance, setFilterInstance] = useState<string>('all');

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const fetchConversations = useCallback(async () => {
        if (!selectedClient) return;
        setIsLoadingConversations(true);
        try {
            // 1. Get all leads
            const { data: leads, error } = await supabase
                .from('relatorio_leads_cliente')
                .select('*')
                .eq('cliente_id', selectedClient.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (leads && leads.length > 0) {
                // 2. Get last message for each lead
                const leadIds = leads.map(l => l.id);
                const { data: lastMessages } = await supabase
                    .from('messages_relatorios_clientes')
                    .select('lead_id, content, sent_at')
                    .in('lead_id', leadIds)
                    .order('sent_at', { ascending: false });

                // Build a map of lead_id -> last message
                const lastMessageMap: Record<string, { content: string | null; sent_at: string }> = {};
                if (lastMessages) {
                    for (const msg of lastMessages) {
                        if (msg.lead_id && !lastMessageMap[msg.lead_id]) {
                            lastMessageMap[msg.lead_id] = { content: msg.content, sent_at: msg.sent_at };
                        }
                    }
                }

                const formatted: ConversationPreview[] = leads.map(lead => ({
                    lead_id: lead.id,
                    lead_phone: lead.telefone_lead,
                    lead_name: lead.lead_name || lead.nome,
                    lead_source: getLeadSource(lead),
                    lead_instance: lead.instance_name,
                    last_message: lastMessageMap[lead.id]?.content || null,
                    last_message_at: lastMessageMap[lead.id]?.sent_at || lead.created_at,
                    unread_count: 0
                }));

                // Sort by last_message_at descending
                formatted.sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

                setConversations(formatted);
            } else {
                setConversations([]);
            }
        } catch (error) {
            console.error('Error fetching conversations:', error);
        } finally {
            setIsLoadingConversations(false);
        }
    }, [selectedClient]);

    const fetchMessages = async (leadId: string) => {
        setIsLoadingMessages(true);
        try {
            const { data, error } = await supabase
                .from('messages_relatorios_clientes')
                .select('*')
                .eq('lead_id', leadId)
                .order('sent_at', { ascending: true });

            if (error) throw error;
            setMessages(data || []);
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setIsLoadingMessages(false);
        }
    };

    const fetchLeadInfo = async (leadId: string) => {
        try {
            const { data, error } = await supabase
                .from('relatorio_leads_cliente')
                .select('*')
                .eq('id', leadId)
                .single();

            if (error) throw error;
            setLeadInfo(data);
        } catch (error) {
            console.error('Error fetching lead info:', error);
        }
    };

    const handleSelectConversation = (conv: ConversationPreview) => {
        const lead: Lead = {
            id: conv.lead_id,
            telefone_lead: conv.lead_phone,
            nome: conv.lead_name || undefined,
            origem: undefined // LeadInfo will have the full data
        };
        setSelectedLead(lead);
        selectedLeadIdRef.current = conv.lead_id;
        fetchMessages(conv.lead_id);
        fetchLeadInfo(conv.lead_id);

        // Optimistically update unread count locally (optional)
        setConversations(prev => prev.map(c =>
            c.lead_id === conv.lead_id ? { ...c, unread_count: 0 } : c
        ));
    };

    // Realtime subscription
    useEffect(() => {
        if (!selectedClient) return;

        fetchConversations();

        const channel = supabase
            .channel(`whatsapp-dashboard-${selectedClient.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'messages_relatorios_clientes',
                    filter: `client_id=eq.${selectedClient.id}`
                },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new as Message;

                        // If chat is open, append message
                        if (newMessage.lead_id === selectedLeadIdRef.current) {
                            setMessages(prev => [...prev, newMessage]);
                        }

                        // Always refresh conversations to show new last_message/unread status
                        // Ideally we would optimize this to not re-fetch all, but for now safe approach
                        fetchConversations();
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'relatorio_leads_cliente',
                    filter: `client_id=eq.${selectedClient.id}`
                },
                () => {
                    fetchConversations();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [selectedClient, fetchConversations]);

    // Helpers
    const getMessageTypeIcon = (type: string) => {
        switch (type) {
            case 'image': return <Image size={14} className="text-gray-400" />;
            case 'video': return <Video size={14} className="text-gray-400" />;
            case 'audio': return <Mic size={14} className="text-gray-400" />;
            case 'document': return <FileText size={14} className="text-gray-400" />;
            default: return null;
        }
    };

    const renderMedia = (msg: Message) => {
        if (!msg.media_url) return null;

        if (msg.message_type === 'image') {
            return (
                <img
                    src={msg.media_url}
                    alt="Mídia"
                    className="max-w-full rounded-lg mb-1 border border-white/10"
                    loading="lazy"
                />
            );
        }
        if (msg.message_type === 'video') {
            return (
                <video
                    src={msg.media_url}
                    controls
                    className="max-w-full rounded-lg mb-1 border border-white/10"
                />
            );
        }
        if (msg.message_type === 'audio') {
            return (
                <audio
                    src={msg.media_url}
                    controls
                    className="max-w-full mb-1"
                />
            );
        }
        if (msg.message_type === 'document') {
            return (
                <a
                    href={msg.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-white/10 rounded-lg mb-1 hover:bg-white/20 transition-colors"
                >
                    <FileText size={20} className="text-white" />
                    <span className="text-sm underline">Ver documento</span>
                </a>
            );
        }
        return null;
    };


    // Filter calculations
    const uniqueOrigins = Array.from(new Set(conversations.map(c => c.lead_source).filter(Boolean))) as string[];
    const uniqueInstances = Array.from(new Set(conversations.map(c => c.lead_instance).filter(Boolean))) as string[];

    const filteredConversations = conversations.filter(conv => {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = searchTerm === '' ||
            (conv.lead_name?.toLowerCase().includes(searchLower) ||
                conv.lead_phone.includes(searchLower));

        const matchesOrigem = filterOrigem === 'all' || conv.lead_source === filterOrigem;
        const matchesInstance = filterInstance === 'all' || conv.lead_instance === filterInstance;

        return matchesSearch && matchesOrigem && matchesInstance;
    });

    return (
        <div className="flex flex-col h-full w-full p-4 overflow-hidden">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                        <MessageSquare className="text-white h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white leading-none">WhatsApp</h1>
                        <p className="text-gray-400 text-xs mt-1">
                            Visualize as conversas com seus leads.
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Container */}
            <div className="bg-[#0A0A0A] rounded-3xl border border-white/5 shadow-2xl overflow-hidden flex-1 flex flex-col min-h-0">
                <div className="flex h-full">
                    {/* Conversations List */}
                    <div className={`w-80 border-r border-white/5 flex flex-col ${selectedLead ? 'hidden md:flex' : 'flex'}`}>
                        <div className="p-4 border-b border-white/5 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">Conversas</h2>
                                <p className="text-xs text-gray-500">{filteredConversations.length} conversas</p>
                            </div>

                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
                                    <Input
                                        placeholder="Buscar..."
                                        className="pl-8 bg-white/5 border-white/10 text-white placeholder:text-gray-600 h-8 text-xs focus-visible:ring-green-500"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Filter className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
                                        <select
                                            className="w-full h-8 pl-8 bg-white/5 border border-white/10 text-white text-xs rounded-md appearance-none outline-none focus:border-green-500 cursor-pointer"
                                            value={filterOrigem}
                                            onChange={(e) => setFilterOrigem(e.target.value)}
                                        >
                                            <option value="all">Origem</option>
                                            {uniqueOrigins.map(origin => (
                                                <option key={origin} value={origin}>{origin}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="relative flex-1">
                                        <MessageSquare className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
                                        <select
                                            className="w-full h-8 pl-8 bg-white/5 border border-white/10 text-white text-xs rounded-md appearance-none outline-none focus:border-green-500 cursor-pointer"
                                            value={filterInstance}
                                            onChange={(e) => setFilterInstance(e.target.value)}
                                        >
                                            <option value="all">Instância</option>
                                            {uniqueInstances.map(inst => (
                                                <option key={inst} value={inst}>{inst}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {isLoadingConversations ? (
                                <div className="flex items-center justify-center h-32">
                                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-green-500 border-t-transparent" />
                                </div>
                            ) : filteredConversations.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-32 text-gray-500">
                                    <MessageSquare size={32} className="mb-2 opacity-50" />
                                    <p className="text-sm">Nenhuma conversa encontrada</p>
                                </div>
                            ) : (
                                filteredConversations.map((conv) => (
                                    <button
                                        key={conv.lead_id}
                                        onClick={() => handleSelectConversation(conv)}
                                        className={`w-full p-4 flex items-start gap-3 hover:bg-white/5 transition-colors border-b border-white/5 text-left ${selectedLead?.id === conv.lead_id ? 'bg-white/10' : ''
                                            }`}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0">
                                            <User size={18} className="text-white" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <p className="text-white font-medium truncate">
                                                    {conv.lead_name}
                                                </p>
                                                {conv.unread_count > 0 && (
                                                    <span className="bg-green-500 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                                                        {conv.unread_count}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 mt-1 mb-1">
                                                {conv.lead_source && (
                                                    <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10 h-5 px-1.5 font-normal">
                                                        {conv.lead_source}
                                                    </Badge>
                                                )}
                                                {conv.lead_instance && (
                                                    <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-500/30 bg-blue-500/10 h-5 px-1.5 font-normal">
                                                        {conv.lead_instance}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-400 truncate mt-1">
                                                {conv.last_message || 'Clique para ver mensagens'}
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                                {format(new Date(conv.last_message_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div >

                    {/* Chat Area */}
                    < div className={`flex-1 flex flex-col ${!selectedLead ? 'hidden md:flex' : 'flex'}`
                    }>
                        {
                            selectedLead ? (
                                <>
                                    {/* Chat Header */}
                                    < div className="p-4 border-b border-white/5 flex items-center justify-between gap-3" >
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => setSelectedLead(null)}
                                                className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
                                            >
                                                <ArrowLeft size={20} className="text-gray-400" />
                                            </button>
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                                                <User size={18} className="text-white" />
                                            </div>
                                            <div>
                                                <p className="text-white font-medium">
                                                    {selectedLead.nome || formatPhoneNumber(selectedLead.telefone_lead)}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowLeadInfo(!showLeadInfo)}
                                            className={`p-2 rounded-lg transition-colors ${showLeadInfo ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                                            title="Informações do Lead"
                                        >
                                            <Info size={20} />
                                        </button>
                                    </div >

                                    {/* Messages */}
                                    < div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#111]" >
                                        {
                                            isLoadingMessages ? (
                                                <div className="flex items-center justify-center h-full" >
                                                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent" />
                                                </div>
                                            ) : messages.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                                    <MessageSquare size={40} className="mb-2 opacity-50" />
                                                    <p>Nenhuma mensagem</p>
                                                </div>
                                            ) : (
                                                messages.map((msg) => (
                                                    <div
                                                        key={msg.id}
                                                        className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div
                                                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.direction === 'outbound'
                                                                ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-br-sm'
                                                                : 'bg-[#1a1a1a] text-gray-200 rounded-bl-sm border border-white/5'
                                                                }`}
                                                        >
                                                            {msg.sender_name && msg.direction === 'inbound' && (
                                                                <p className="text-xs text-green-400 font-medium mb-1">
                                                                    {msg.sender_name}
                                                                </p>
                                                            )}

                                                            {renderMedia(msg)}

                                                            {msg.content && (
                                                                <p className="text-sm whitespace-pre-wrap break-words">
                                                                    {msg.content}
                                                                </p>
                                                            )}

                                                            <div className={`flex items-center gap-1 mt-1 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'
                                                                }`}>
                                                                {getMessageTypeIcon(msg.message_type)}
                                                                <span className="text-[10px] opacity-60">
                                                                    {format(new Date(msg.sent_at), 'HH:mm', { locale: ptBR })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                    </div >

                                    {/* Input Area (Read-only indicator) */}
                                    < div className="p-4 border-t border-white/5 bg-[#0A0A0A]" >
                                        <div className="flex items-center gap-3 px-4 py-3 bg-[#111] rounded-xl border border-white/5">
                                            <Clock size={18} className="text-gray-500" />
                                            <p className="text-gray-500 text-sm">
                                                Visualização somente leitura
                                            </p>
                                        </div>
                                    </div >
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center mb-4">
                                        <img src="/icon-whatsapp.png" alt="WhatsApp" className="w-10 h-10 object-contain brightness-0 invert" />
                                    </div>
                                    <p className="text-xl font-medium text-white mb-2">WhatsApp</p>
                                    <p className="text-sm">Selecione uma conversa para visualizar</p>
                                </div>
                            )}
                    </div >

                    {/* Lead Info Panel - Right Side */}
                    {
                        selectedLead && showLeadInfo && leadInfo && (
                            <div className="w-72 border-l border-white/5 flex-col hidden lg:flex bg-[#0A0A0A]">
                                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold text-white">Informações do Lead</h3>
                                    <button
                                        onClick={() => setShowLeadInfo(false)}
                                        className="text-gray-500 hover:text-gray-300 text-xs"
                                    >
                                        Ocultar
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {/* Phone */}
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-gray-500">
                                            <Phone size={14} />
                                            <span className="text-xs font-medium uppercase">Telefone</span>
                                        </div>
                                        <p className="text-white text-sm pl-6">
                                            {formatPhoneNumber(leadInfo.telefone_lead)}
                                        </p>
                                    </div>

                                    {/* Instance */}
                                    {leadInfo.instance_name && (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <MessageSquare size={14} />
                                                <span className="text-xs font-medium uppercase">Instância</span>
                                            </div>
                                            <p className="text-white text-sm pl-6">{leadInfo.instance_name}</p>
                                        </div>
                                    )}

                                    {/* Origin - conversion_source is main */}
                                    {leadInfo.conversion_source && (
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <MapPin size={14} />
                                                <span className="text-xs font-medium uppercase">Origem</span>
                                            </div>
                                            <p className="text-green-400 text-sm pl-6 font-medium">
                                                {leadInfo.conversion_source}
                                            </p>
                                        </div>
                                    )}

                                    {/* Facebook/Instagram Ads Metadata */}
                                    {(() => {
                                        const origemData = parseOrigemData(leadInfo.origem);
                                        const hasData = hasRealOrigemData(origemData);

                                        if (hasData && origemData) {
                                            return (
                                                <div className="space-y-3 pt-2 border-t border-white/5">
                                                    <div className="flex items-center gap-2 text-gray-500">
                                                        <Info size={14} />
                                                        <span className="text-xs font-medium uppercase">Dados do Anúncio</span>
                                                    </div>

                                                    {origemData.conversionSource && (
                                                        <div className="pl-6 space-y-1">
                                                            <span className="text-xs text-gray-500">Fonte</span>
                                                            <p className="text-white text-sm">{origemData.conversionSource}</p>
                                                        </div>
                                                    )}

                                                    {origemData.sourceApp && (
                                                        <div className="pl-6 space-y-1 flex items-center gap-2">
                                                            {origemData.sourceApp === 'instagram' && <Instagram size={14} className="text-pink-400" />}
                                                            {origemData.sourceApp === 'facebook' && <Facebook size={14} className="text-blue-400" />}
                                                            <span className="text-white text-sm capitalize">{origemData.sourceApp}</span>
                                                        </div>
                                                    )}

                                                    {origemData.sourceType && (
                                                        <div className="pl-6 space-y-1">
                                                            <span className="text-xs text-gray-500">Tipo</span>
                                                            <p className="text-white text-sm capitalize">{origemData.sourceType}</p>
                                                        </div>
                                                    )}

                                                    {origemData.sourceUrl && (
                                                        <div className="pl-6 space-y-1">
                                                            <span className="text-xs text-gray-500">Link do Anúncio</span>
                                                            <a
                                                                href={origemData.sourceUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1"
                                                            >
                                                                <LinkIcon size={12} />
                                                                <span className="truncate max-w-[150px]">Ver anúncio</span>
                                                            </a>
                                                        </div>
                                                    )}

                                                    {origemData.mediaUrl && (
                                                        <div className="pl-6 space-y-1">
                                                            <span className="text-xs text-gray-500">Mídia</span>
                                                            <a
                                                                href={origemData.mediaUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-indigo-400 text-xs hover:text-indigo-300 flex items-center gap-1"
                                                            >
                                                                <LinkIcon size={12} />
                                                                <span className="truncate max-w-[150px]">Ver mídia</span>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}

                                    {/* Created At */}
                                    {leadInfo.created_at && (
                                        <div className="space-y-1 pt-2 border-t border-white/5">
                                            <div className="flex items-center gap-2 text-gray-500">
                                                <Clock size={14} />
                                                <span className="text-xs font-medium uppercase">Primeiro Contato</span>
                                            </div>
                                            <p className="text-white text-sm pl-6">
                                                {format(new Date(leadInfo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    }
                </div >
            </div >
        </div >
    );
}
