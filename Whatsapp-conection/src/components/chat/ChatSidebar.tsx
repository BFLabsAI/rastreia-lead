
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Search, User, Megaphone, Globe } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/services/supabaseClient";
import { cn } from "@/lib/utils";

interface ChatSidebarProps {
    selectedInstance: string | null;
    onSelectInstance: (instance: string) => void;
    selectedContact: any | null;
    onSelectContact: (contact: any) => void;
    refreshTrigger?: number;
    className?: string;
}

const cleanPhone = (phone: string | null | undefined) => {
    if (!phone) return "";
    return phone.replace(/\D/g, "");
};

// ... arePhonesEquivalent ...

export function ChatSidebar({
    selectedInstance,
    onSelectInstance,
    selectedContact,
    onSelectContact,
    refreshTrigger = 0,
    className
}: ChatSidebarProps) {
    // ... cleanPhone, arePhonesEquivalent ...
    const [instances, setInstances] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);

    // Fetch Instances
    useEffect(() => {
        // ... same logic ...
        const fetchInstances = async () => {
            const { data } = await supabase
                .from("instances_dispara_lead_saas_02")
                .select("instance_name, status")
                .order("created_at", { ascending: false });

            if (data) {
                setInstances(data);
                if (data.length > 0 && !selectedInstance) {
                    onSelectInstance("all");
                }
            }
        };
        fetchInstances();
    }, []);

    // Fetch Contacts for Instance
    useEffect(() => {
        if (!selectedInstance) return;

        setLoading(true);
        const fetchContacts = async () => {

            // Call the database function to get filtered contacts directly
            const { data, error } = await supabase
                .rpc('get_instance_contacts', {
                    p_instance_name: selectedInstance === 'all' ? null : selectedInstance
                });

            if (error) {
                console.error("Debug: Error fetching contacts via RPC", error);
                toast.error("Erro ao carregar contatos.");
                setLoading(false);
                return;
            }

            if (data) {
                setContacts(data);
            } else {
                setContacts([]);
            }
            setLoading(false);
        };

        fetchContacts();

        // Realtime subscription ...
        const subscription = supabase
            .channel(`chat_list_${selectedInstance}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "contacts_dispara_lead_saas_02",
                },
                () => {
                    fetchContacts();
                }
            )
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [selectedInstance, refreshTrigger]);

    const [tagDefs, setTagDefs] = useState<any[]>([]);

    // Fetch available tags for mapping
    useEffect(() => {
        const fetchTags = async () => {
            const { data } = await supabase
                .from("user_tags_dispara_lead_saas_02")
                .select("id, name, color");
            if (data) setTagDefs(data);
        };
        fetchTags();
    }, []);

    const getTagDetails = (tagId: string) => tagDefs.find(t => t.id === tagId);

    const [tagFilter, setTagFilter] = useState<string | null>("all");

    const filteredContacts = contacts.filter((c) => {
        const matchesSearch = (c.name || c.phone).toLowerCase().includes(search.toLowerCase());
        const matchesTag = tagFilter === "all" || (c.tags && Array.isArray(c.tags) && c.tags.includes(tagFilter));
        return matchesSearch && matchesTag;
    });

    // ...

    return (
        <div className={cn("flex w-full md:w-80 flex-col border-r bg-background dark:border-gray-800", className)}>
            {/* Header ... */}
            <div className="p-3 border-b dark:border-gray-800 bg-muted/10">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-foreground">Atendimento</h2>
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                        <span className={cn("h-1.5 w-1.5 rounded-full", "bg-green-500 animate-pulse")} />
                        <span className="text-[10px] font-medium text-green-600 dark:text-green-400">Online</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <Select value={selectedInstance || ""} onValueChange={onSelectInstance}>
                        <SelectTrigger className="h-9 text-sm">
                            <SelectValue placeholder="Selecione a instância" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-semibold text-primary">Todas</SelectItem>
                            {instances.map((inst) => (
                                <SelectItem key={inst.instance_name} value={inst.instance_name} className="text-sm">
                                    {inst.instance_name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Buscar conversa..."
                                className="pl-8 h-9 text-sm bg-background"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>

                        <Select value={tagFilter || "all"} onValueChange={setTagFilter}>
                            <SelectTrigger className="w-[85px] h-9 text-xs px-2">
                                <span className="truncate">
                                    {tagFilter === "all" ? "Tags" : tagDefs.find(t => t.id === tagFilter)?.name || "Tags"}
                                </span>
                            </SelectTrigger>
                            <SelectContent align="end" className="w-[180px]">
                                <SelectItem value="all" className="text-xs font-medium">Todas as Tags</SelectItem>
                                {tagDefs.map(tag => (
                                    <SelectItem key={tag.id} value={tag.id} className="text-xs">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2 h-2 rounded-full"
                                                style={{ backgroundColor: tag.color }}
                                            />
                                            {tag.name}
                                        </div>
                                    </SelectItem>
                                ))}
                                {tagFilter !== "all" && (
                                    <div className="p-1 border-t mt-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="w-full h-6 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50 justify-center"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setTagFilter("all");
                                            }}
                                        >
                                            Limpar Filtro
                                        </Button>
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="flex flex-col">
                    {filteredContacts.map((contact) => (
                        <button
                            key={contact.id}
                            onClick={() => onSelectContact(contact)}
                            className={cn(
                                "flex items-start gap-3 border-b p-3 text-left transition-all hover:bg-muted/50 dark:border-gray-800/50 group relative",
                                selectedContact?.id === contact.id && "bg-muted dark:bg-muted/20 border-l-4 border-l-primary"
                            )}
                        >
                            <Avatar className="h-10 w-10 border border-border/50 shrink-0 mt-1">
                                <AvatarImage src={contact.profile_pic_url} />
                                <AvatarFallback className="bg-muted text-muted-foreground">
                                    <User className="h-5 w-5" />
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                                {/* Row 1: Name and Time */}
                                <div className="flex items-center justify-between gap-2 w-full">
                                    <span className={cn(
                                        "font-bold text-sm truncate",
                                        selectedContact?.id === contact.id ? "text-foreground" : "text-foreground/90"
                                    )}>
                                        {contact.name || contact.phone}
                                    </span>
                                    {contact.last_message_at && (
                                        <span className={cn(
                                            "text-[10px] tabular-nums shrink-0",
                                            selectedContact?.id === contact.id ? "text-foreground/70" : "text-muted-foreground"
                                        )}>
                                            {format(new Date(contact.last_message_at), "HH:mm")}
                                        </span>
                                    )}
                                </div>

                                {/* Row 2: Phone (Left) and Instance (Right) */}
                                <div className="flex justify-between items-start -mt-0.5">
                                    <span className="text-xs text-muted-foreground truncate font-medium">
                                        {contact.phone}
                                    </span>

                                    {/* Instance Badge (Right) */}
                                    {contact.instance_name && (
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60 shrink-0 ml-2">
                                            <Megaphone className="h-3 w-3 text-green-500" />
                                            <span className="text-muted-foreground/80">{contact.instance_name}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Row 3: Tags (Left - wrapped) */}
                                {contact.tags && Array.isArray(contact.tags) && contact.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-0.5 mb-1">
                                        {contact.tags.slice(0, 3).map((tagId: string) => {
                                            const tag = getTagDetails(tagId);
                                            if (!tag) return null;
                                            return (
                                                <span
                                                    key={tagId}
                                                    className="px-1.5 py-0.5 rounded-full text-[9px] font-medium border"
                                                    style={{
                                                        backgroundColor: `${tag.color}15`,
                                                        color: tag.color,
                                                        borderColor: `${tag.color}30`
                                                    }}
                                                >
                                                    {tag.name}
                                                </span>
                                            );
                                        })}
                                        {contact.tags.length > 3 && (
                                            <span className="text-[10px] text-muted-foreground self-center">...</span>
                                        )}
                                    </div>
                                )}

                                {/* Row 4: Message Preview */}
                                <div className="flex items-center gap-1 h-4 text-xs text-muted-foreground min-w-0 mt-0.5">
                                    {/* Media Icon/Thumbnail */}
                                    {contact.last_message_type?.toLowerCase().includes('image') && contact.last_media_url ? (
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <Globe className="h-3 w-3" /> {/* Placeholder for image icon if needed, but text is fine */}
                                            <span className="truncate">Foto</span>
                                        </div>
                                    ) : contact.last_message_type?.toLowerCase().includes('video') ? (
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="shrink-0">🎥</span>
                                            <span className="truncate">Vídeo</span>
                                        </div>
                                    ) : contact.last_message_type?.toLowerCase().includes('audio') ? (
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="shrink-0">🎤</span>
                                            <span className="truncate">Áudio</span>
                                        </div>
                                    ) : (
                                        <p className="truncate flex-1 w-0 min-w-0 opacity-80 font-normal">
                                            {contact.last_message_content || "..."}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                    {filteredContacts.length === 0 && (
                        <div className="p-8 text-center">
                            <p className="text-sm text-muted-foreground">Nenhuma conversa</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
