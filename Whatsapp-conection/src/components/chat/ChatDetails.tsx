
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Globe, Calendar, User, ChevronLeft, ChevronRight, X, Download, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { supabase } from "@/services/supabaseClient";
import { toast } from "sonner";
import { UserTagManager } from "./UserTagManager";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ChatDetailsProps {
    selectedContact: any;
    className?: string;
    onUpdate?: () => void;
}

export function ChatDetails({ selectedContact, className, onUpdate }: ChatDetailsProps) {
    const [notes, setNotes] = useState("");
    const [savingNotes, setSavingNotes] = useState(false);
    const [campaign, setCampaign] = useState<any>(null);
    const [audienceNames, setAudienceNames] = useState<string[]>([]);
    const [audienceTags, setAudienceTags] = useState<any[]>([]);
    const [recentFiles, setRecentFiles] = useState<any[]>([]);

    // User Tags State 
    const [userTags, setUserTags] = useState<string[]>([]);

    // Preview File State
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    useEffect(() => {
        if (selectedContact) {
            // Initial optimistic set, but we will re-fetch to be sure
            setNotes(selectedContact.notes || "");
            fetchDetails();

            const tags = Array.isArray(selectedContact.tags) ? selectedContact.tags : [];
            setUserTags(tags);
        }
    }, [selectedContact]);

    // Helper to get phone number variations (with 8 and 9 digits, with and without +)
    const getPhoneVariations = (phone: string): string[] => {
        if (!phone) return [];
        // Basic cleanup
        const clean = phone.replace(/\D/g, '');
        const variations = [clean];

        // Brazil Logic: 55 + 2 digit DDD + Number
        if (clean.startsWith('55') && clean.length >= 12) {
            const ddd = clean.slice(2, 4);
            const numberPart = clean.slice(4);

            if (numberPart.length === 8) {
                // Has 8 digits, add version with 9
                variations.push(`55${ddd}9${numberPart}`);
            } else if (numberPart.length === 9 && numberPart.startsWith('9')) {
                // Has 9 digits, add version without 9
                variations.push(`55${ddd}${numberPart.slice(1)}`);
            }
        }

        // Add "+" prefixed versions for all
        const plusVariations = variations.map(v => `+${v}`);
        return [...variations, ...plusVariations];
    };

    const fetchDetails = async () => {
        if (!selectedContact) return;

        const phoneVariations = getPhoneVariations(selectedContact.phone);
        console.log("Fetching details for:", selectedContact.name, "Phones:", phoneVariations);


        // 1. Fetch Fresh Notes
        const { data: contactData } = await supabase
            .from("contacts_dispara_lead_saas_02")
            .select("notes, tags")
            .eq("id", selectedContact.id)
            .single();

        if (contactData) {
            setNotes(contactData.notes || "");
            if (Array.isArray(contactData.tags)) {
                setUserTags(contactData.tags);
            }
        }

        // 2. Fetch Last Campaign (Try message logs first as source of truth for sent messages)
        // We look for message logs for this contact's phone variations that have a campaign_id
        // NOTE: Using message_logs_dispara_lead_saas_03 as found in DB inspection
        const { data: latestLog } = await supabase
            .from("message_logs_dispara_lead_saas_03")
            .select(`
                created_at,
                campaigns_dispara_lead_saas_02 (
                    name, 
                    target_audience,
                    created_at
                )
            `)
            .in("phone_number", phoneVariations)
            .not("campaign_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (latestLog && latestLog.campaigns_dispara_lead_saas_02) {
            // Supabase helper: handle if relation returns array or object
            const campaignData = Array.isArray(latestLog.campaigns_dispara_lead_saas_02)
                ? latestLog.campaigns_dispara_lead_saas_02[0]
                : latestLog.campaigns_dispara_lead_saas_02;

            if (campaignData) {
                setCampaign({
                    name: campaignData.name,
                    target_audience: campaignData.target_audience,
                    sent_at: latestLog.created_at
                });
            }
        } else if (selectedContact.last_campaign_id) {
            // Fallback to contact's last_campaign_id if log fetch fails
            const { data: camp } = await supabase
                .from("campaigns_dispara_lead_saas_02")
                .select("name, target_audience, created_at")
                .eq("id", selectedContact.last_campaign_id)
                .single();
            if (camp) {
                setCampaign(camp);
            } else {
                setCampaign(null);
            }
        } else {
            setCampaign(null);
        }

        // 3. Fetch Audiences & Audience Tags
        // We find all audiences this phone belongs to
        const { data: audienceData } = await supabase
            .from("audience_contacts_dispara_lead_saas_02")
            .select(`
                audiences_dispara_lead_saas_02 (
                    name,
                    audience_tags_dispara_lead_saas_02 (
                        tags_dispara_lead_saas_02 (name, color)
                    )
                )
            `)
            .in("phone_number", phoneVariations);

        if (audienceData && audienceData.length > 0) {
            const names: string[] = [];
            const tags: any[] = [];

            audienceData.forEach((item: any) => {
                const aud = item.audiences_dispara_lead_saas_02;
                if (aud) {
                    if (aud.name && !names.includes(aud.name)) {
                        names.push(aud.name);
                    }
                    if (aud.audience_tags_dispara_lead_saas_02) {
                        aud.audience_tags_dispara_lead_saas_02.forEach((t: any) => {
                            if (t.tags_dispara_lead_saas_02) tags.push(t.tags_dispara_lead_saas_02);
                        });
                    }
                }
            });

            setAudienceNames(names);
            // Deduplicate tags by name/id if needed, simplistic dedupe here
            const uniqueTags = tags.filter((tag, index, self) =>
                index === self.findIndex((t) => t.name === tag.name)
            );
            setAudienceTags(uniqueTags);
        } else {
            setAudienceNames([]);
            setAudienceTags([]);
        }

        // 4. Fetch Recent Files (Using contact ID is usually safest, but double check with logs if needed)
        // Usually messages table uses contact_id correctly if linked.
        const { data: mediaMessages } = await supabase
            .from("messages_dispara_lead_saas_02")
            .select("id, media_url, message_type, sent_at, content")
            .eq("contact_id", selectedContact.id)
            .not("media_url", "is", null)
            .order("sent_at", { ascending: false })
            .limit(20);

        if (mediaMessages) {
            setRecentFiles(mediaMessages);
        } else {
            setRecentFiles([]);
        }
    };

    const handleSaveNotes = async () => {
        if (!selectedContact) return;
        setSavingNotes(true);
        const { error } = await supabase
            .from("contacts_dispara_lead_saas_02")
            .update({ notes })
            .eq("id", selectedContact.id);

        if (error) {
            toast.error("Erro ao salvar notas.");
        } else {
            toast.success("Notas salvas.");
            if (onUpdate) onUpdate();
        }
        setSavingNotes(false);
    };

    const handleUpdateTags = async (newTags: string[]) => {
        setUserTags(newTags); // Optimistic update

        if (selectedContact) {
            const { error } = await supabase
                .from("contacts_dispara_lead_saas_02")
                .update({ tags: newTags })
                .eq("id", selectedContact.id);

            if (error) {
                toast.error("Erro ao salvar etiquetas.");
                // Revert optimistic update if there's an error, or refetch
                fetchDetails();
                return;
            }
            toast.success("Etiquetas atualizadas.");
            if (onUpdate) onUpdate();
        }
    };

    const getFileType = (url: string) => {
        if (!url) return 'other';
        const lower = url.toLowerCase();
        if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/) || url.startsWith('data:image')) return 'image';
        if (lower.match(/\.(mp4|webm|ogg|mov)$/)) return 'video';
        return 'other';
    };

    const handleNext = () => {
        if (previewIndex === null) return;
        if (previewIndex < recentFiles.length - 1) {
            setPreviewIndex(previewIndex + 1);
        }
    };

    const handlePrev = () => {
        if (previewIndex === null) return;
        if (previewIndex > 0) {
            setPreviewIndex(previewIndex - 1);
        }
    };

    const currentPreviewFile = previewIndex !== null ? recentFiles[previewIndex] : null;
    const currentFileType = currentPreviewFile ? getFileType(currentPreviewFile.media_url) : null;


    if (!selectedContact) {
        return (
            <div className={cn("w-72 border-l bg-background p-4 hidden xl:flex items-center justify-center text-muted-foreground text-xs dark:border-gray-800", className)}>
                Selecione um contato
            </div>
        );
    }

    return (
        <div className={cn("w-72 flex flex-col border-l bg-background dark:border-gray-800 h-full", className)}>

            {/* -- User Header -- */}
            <div className="flex flex-col items-center p-4 border-b dark:border-gray-800 bg-muted/5 shrink-0">
                <Avatar className="h-12 w-12 mb-2 shadow-sm ring-1 ring-border/50">
                    <AvatarImage src={selectedContact.profile_pic_url} />
                    <AvatarFallback className="text-sm bg-primary/10 text-primary"><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <h2 className="text-sm font-semibold text-center leading-tight mb-0.5 max-w-full truncate px-2">{selectedContact.name || "Sem Nome"}</h2>
                <p className="text-[10px] text-muted-foreground">{selectedContact.phone}</p>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">

                    {/* -- Section 1: Latest Campaign -- */}
                    <div className="border rounded-md p-2.5 space-y-2 bg-card/50">
                        <h4 className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest mb-1.5">
                            Última Campanha
                        </h4>
                        {campaign ? (
                            <div className="space-y-1.5">
                                <div>
                                    <p className="text-[9px] text-muted-foreground uppercase">Nome</p>
                                    <p className="text-xs font-medium truncate min-w-0" title={campaign.name}>{campaign.name}</p>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground border-t pt-1.5 mt-1.5">
                                    <Calendar className="h-2.5 w-2.5" />
                                    <span>
                                        {format(new Date(campaign.sent_at || campaign.created_at), "dd/MM/yyyy", { locale: ptBR })}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[10px] text-muted-foreground italic">Nenhuma campanha recente.</p>
                        )}
                    </div>

                    {/* -- Section 2: Audience (Público & Etiqueta) -- */}
                    <div className="border rounded-md p-2.5 space-y-2.5 bg-card/50">
                        <h4 className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                            Audiência
                        </h4>

                        {/* Sub-item: Publico (Audience Names) */}
                        <div>
                            <p className="text-[9px] text-muted-foreground mb-0.5">Público</p>
                            <p className="text-xs font-medium flex items-center gap-1.5 truncate min-w-0">
                                <Globe className="h-3 w-3 text-primary/70 shrink-0" />
                                <span className="truncate" title={audienceNames.join(", ")}>
                                    {audienceNames.length > 0 ? audienceNames.join(", ") : (campaign?.target_audience || "Geral")}
                                </span>
                            </p>
                        </div>

                        <Separator className="bg-border/50" />

                        {/* Sub-item: Etiquetas (Audience Tags) */}
                        <div>
                            <p className="text-[9px] text-muted-foreground mb-1">Etiquetas (Audiência)</p>
                            <div className="flex flex-wrap gap-1">
                                {audienceTags.length > 0 ? audienceTags.map((tag, i) => (
                                    <span key={i} className="text-[9px] px-1.5 py-0.5 bg-secondary text-secondary-foreground rounded border truncate max-w-full">
                                        {tag.name}
                                    </span>
                                )) : (
                                    <span className="text-[10px] text-muted-foreground italic">Sem etiquetas</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* -- Section 3: User Tags (Boxed) -- */}
                    <div className="border rounded-md p-2.5 space-y-2 bg-card/50">
                        <div className="flex items-center justify-between pointer-events-none">
                            <h4 className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest pointer-events-auto">
                                Tags do Usuário
                            </h4>
                            <span className="text-[9px] text-muted-foreground pointer-events-auto">{userTags.length}/3</span>
                        </div>
                        <UserTagManager
                            contactId={selectedContact.id}
                            assignedTagIds={userTags}
                            onUpdateTags={handleUpdateTags}
                        />
                    </div>

                    {/* -- Section 4: Notes (Boxed) -- */}
                    <div className="border rounded-md p-2.5 bg-card/50 space-y-2">
                        <h4 className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                            Notas
                        </h4>
                        <Textarea
                            className="min-h-[80px] text-xs resize-none bg-background focus-visible:ring-1"
                            placeholder="Adicione notas sobre este lead..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <Button
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={handleSaveNotes}
                                disabled={savingNotes}
                            >
                                <Save className="h-3 w-3 mr-1" />
                                {savingNotes ? "Salvando..." : "Salvar"}
                            </Button>
                        </div>
                    </div>

                    {/* -- Section 5: Recent Files (Boxed) -- */}
                    <div className="border rounded-md p-2.5 bg-card/50 flex flex-col">
                        <h4 className="text-[9px] font-bold uppercase text-muted-foreground tracking-widest mb-2.5">
                            Arquivos Recentes
                        </h4>

                        <ScrollArea className="h-[140px] w-full rounded-md border border-border/20 bg-muted/10 p-1">
                            <div className="grid grid-cols-3 gap-1.5 p-1">
                                {recentFiles.length === 0 && <span className="col-span-3 text-[10px] text-muted-foreground italic text-center py-4">Nenhum arquivo encontrado.</span>}

                                {recentFiles.map((file, index) => (
                                    <div
                                        key={file.id}
                                        onClick={() => setPreviewIndex(index)}
                                        className="aspect-square bg-background rounded-sm flex items-center justify-center overflow-hidden cursor-pointer hover:ring-2 ring-primary/20 transition-all border border-border/50 relative group"
                                        title={file.content || "Arquivo"}
                                    >
                                        {file.message_type?.toLowerCase().includes('image') || (file.media_url && (file.media_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) || file.media_url.startsWith('data:image'))) ? (
                                            <img
                                                src={file.media_url.startsWith('http') || file.media_url.startsWith('data') ? file.media_url : `data:image/jpeg;base64,${file.media_url}`}
                                                alt="Thumbnail"
                                                className="h-full w-full object-cover"
                                            />
                                        ) : file.message_type?.toLowerCase().includes('video') ? (
                                            <div className="flex flex-col items-center justify-center w-full h-full bg-black/5">
                                                <span className="text-xs">🎥</span>
                                            </div>
                                        ) : (
                                            <FileText className="h-4 w-4 text-muted-foreground/70" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                </div>
            </ScrollArea>

            {/* File Preview Dialog */}
            <Dialog open={previewIndex !== null} onOpenChange={(open) => !open && setPreviewIndex(null)}>
                <DialogContent
                    className="max-w-none w-screen h-screen p-0 bg-black/60 backdrop-blur-sm border-none shadow-none flex items-center justify-center outline-none"
                    onClick={() => setPreviewIndex(null)}
                >
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="fixed top-4 right-4 z-[70] text-white hover:text-white hover:bg-white/20 h-10 w-10 rounded-full"
                        >
                            <X className="h-6 w-6" />
                        </Button>
                    </DialogClose>

                    <div className="flex items-center justify-center gap-6 w-full h-full p-4 pointer-events-none">
                        <div className="shrink-0 w-12 flex justify-end pointer-events-auto">
                            {previewIndex !== null && previewIndex > 0 && (
                                <Button
                                    variant="default"
                                    size="icon"
                                    className="h-12 w-12 rounded-full shadow-xl border-2 border-white/10 hover:scale-110 transition-transform z-[60]"
                                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </Button>
                            )}
                        </div>

                        {currentPreviewFile && (
                            <div
                                className="relative flex-col flex items-center justify-center max-w-[80vw] max-h-[85vh] pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {currentFileType === 'image' && (
                                    <img
                                        src={currentPreviewFile.media_url.startsWith('http') || currentPreviewFile.media_url.startsWith('data') ? currentPreviewFile.media_url : `data:image/jpeg;base64,${currentPreviewFile.media_url}`}
                                        alt="Preview"
                                        className="max-h-[80vh] max-w-full object-contain rounded-md shadow-2xl"
                                    />
                                )}
                                {currentFileType === 'video' && (
                                    <video controls className="max-h-[80vh] max-w-full rounded-md shadow-2xl bg-black" autoPlay>
                                        <source src={currentPreviewFile.media_url} />
                                        Seu navegador não suporta este vídeo.
                                    </video>
                                )}
                                {currentFileType === 'other' && (
                                    <div className="bg-background/95 p-8 rounded-lg shadow-xl text-center min-w-[300px] backdrop-blur text-foreground">
                                        <FileText className="h-20 w-20 mx-auto text-primary mb-4" />
                                        <h3 className="text-xl font-medium mb-3">Arquivo não suportado para pré-visualização</h3>
                                        <div className="text-sm text-muted-foreground mb-6 max-w-[300px] truncate mx-auto border px-2 py-1 rounded bg-muted">
                                            {currentPreviewFile.content || "Sem nome"}
                                        </div>
                                        <Button asChild size="lg" className="w-full">
                                            <a href={currentPreviewFile.media_url} target="_blank" rel="noreferrer">
                                                <Download className="mr-2 h-5 w-5" /> Baixar / Abrir
                                            </a>
                                        </Button>
                                    </div>
                                )}

                                {(currentFileType === 'image' || currentFileType === 'video') && (
                                    <div className="mt-4 text-white text-sm font-medium bg-black/60 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 flex items-center gap-3 shadow-lg">
                                        <span className="font-mono text-xs opacity-70">
                                            {previewIndex !== null ? previewIndex + 1 : 0} / {recentFiles.length}
                                        </span>
                                        {currentPreviewFile.content && <span className="w-px h-4 bg-white/20"></span>}
                                        {currentPreviewFile.content && <span className="opacity-90 max-w-[300px] truncate">{currentPreviewFile.content}</span>}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="shrink-0 w-12 flex justify-start pointer-events-auto">
                            {previewIndex !== null && previewIndex < recentFiles.length - 1 && (
                                <Button
                                    variant="default"
                                    size="icon"
                                    className="h-12 w-12 rounded-full shadow-xl border-2 border-white/10 hover:scale-110 transition-transform z-[60]"
                                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            )}
                        </div>

                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
