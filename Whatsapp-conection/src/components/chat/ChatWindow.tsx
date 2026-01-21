
import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { ArrowLeft, MoreVertical, Loader2, Search, Paperclip, Send, CheckCheck, FileText, Megaphone, Bot, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/services/supabaseClient";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { uploadFileToSupabase } from "@/services/supabaseStorage";
import { sendMediaMessage } from "@/services/uazapiClient";

// WhatsApp Web Color Palette
const COLORS = {
    light: {
        bg: "bg-[#EFEAE2]",
        messageOut: "bg-[#D9FDD3]",
        messageIn: "bg-white",
    },
    dark: {
        bg: "dark:bg-[#0b141a]",
        messageOut: "dark:bg-[#005c4b]",
        messageIn: "dark:bg-[#202c33]",
    }
};


interface ChatWindowProps {
    selectedInstance: string | null;
    selectedContact: any | null;
    onToggleDetails?: () => void;
    onBack?: () => void;
}

export function ChatWindow({ selectedInstance, selectedContact, onToggleDetails, onBack }: ChatWindowProps) {
    const [messages, setMessages] = useState<any[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [previewFile, setPreviewFile] = useState<{ url: string, type: 'image' | 'video' | 'other', file?: File } | null>(null);
    const [instanceData, setInstanceData] = useState<{ id: string, token: string, tenant_id: string, instance_name: string } | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch Instance Data (Token & IDs)
    useEffect(() => {
        const fetchInstanceData = async () => {
            let targetInstanceName = selectedInstance;

            // If "all" selected, try to infer from contact
            if (selectedInstance === 'all') {
                if (selectedContact?.instance_name) {
                    targetInstanceName = selectedContact.instance_name;
                } else {
                    setInstanceData(null);
                    return;
                }
            }

            if (!targetInstanceName) return;

            const { data, error } = await supabase
                .from("instances_dispara_lead_saas_02")
                .select("id, token, tenant_id, instance_name")
                .eq("instance_name", targetInstanceName)
                .single();

            if (data) {
                setInstanceData(data);
            } else {
                console.error("Failed to fetch instance data:", error);
                setInstanceData(null);
            }
        };
        fetchInstanceData();
    }, [selectedInstance, selectedContact]);

    // State for visual readiness (prevents scroll jump visibility)
    const [visualReady, setVisualReady] = useState(false);

    // ...

    // Fetch Logic
    useEffect(() => {
        if (!selectedContact) return;

        setMessages([]); // Clear on switch
        setVisualReady(false); // Hide until scrolled

        const fetchMessages = async () => {
            // ... match by ID ...
            if (!selectedContact.id) return;

            // Correct Logic:
            const { data: rawData, error } = await supabase
                .from("messages_dispara_lead_saas_02")
                .select(`*`)
                .eq("contact_id", selectedContact.id)
                .order("sent_at", { ascending: false })
                .limit(50);

            if (rawData) {
                // Reverse to standard chronological order
                setMessages(rawData.reverse());
                // Scroll will happen in useLayoutEffect
            }
        };

        fetchMessages();
        // ... subscription ...
    }, [selectedContact]);

    // Scroll Management with LayoutEffect to prevent visual jumping
    useLayoutEffect(() => {
        if (messages.length > 0) {
            // Check if we are "loading" (not ready) -> Instant Scroll to bottom
            if (!visualReady) {
                if (scrollRef.current) {
                    // Instant Scroll to Bottom
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
                // Small buffer to ensure layout paint, then show
                requestAnimationFrame(() => setVisualReady(true));
            } else {
                // Already ready (new message arrived), smooth scroll
                if (scrollRef.current) {
                    // For new messages, we want smooth scroll
                    scrollRef.current.scrollTo({
                        top: scrollRef.current.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }
        } else if (messages.length === 0) {
            setVisualReady(true); // Empty chat is "ready"
        }
    }, [messages]);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input value to allow selecting same file again if needed
        if (fileInputRef.current) fileInputRef.current.value = "";

        const objectUrl = URL.createObjectURL(file);
        let type: 'image' | 'video' | 'other' = 'other';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';

        setPreviewFile({
            url: objectUrl,
            type,
            file
        });
    };

    const handleConfirmSendMedia = async () => {
        if (!previewFile?.file || !selectedInstance || !selectedContact || !instanceData) return;

        // Capture data before clearing state
        const file = previewFile.file;
        const caption = newMessage.trim();

        // Immediate UI Cleanup (Optimistic)
        setPreviewFile(null);
        setNewMessage("");
        setSending(true);

        try {
            // 1. Upload to Supabase
            const { fileUrl, contentType } = await uploadFileToSupabase(file);

            // 2. Determine type
            let mediaType = 'document';
            if (contentType.startsWith('image/')) mediaType = 'image';
            else if (contentType.startsWith('video/')) mediaType = 'video';
            else if (contentType.startsWith('audio/')) mediaType = 'audio';

            // 3. Optimistic Update
            const tempId = crypto.randomUUID();
            const optimisticMsg = {
                id: tempId,
                content: caption || file.name,
                direction: 'outbound',
                contact_id: selectedContact.id,
                created_at: new Date().toISOString(),
                sent_at: new Date().toISOString(),
                media_url: fileUrl,
                message_type: mediaType,
                status: 'pending'
            };

            // @ts-ignore
            setMessages((prev) => [...prev, optimisticMsg]);
            setTimeout(() => scrollToBottom(), 100);

            // 4. Send via API
            const response = await sendMediaMessage({
                instanceName: instanceData.instance_name,
                number: selectedContact.phone,
                mediatype: mediaType,
                media: fileUrl,
                caption: caption
            });

            // Extract ID
            const uazapiId = response?.key?.id || response?.id;

            // 5. Update Optimistic with Real ID
            setMessages((prev) => prev.map(m =>
                m.id === tempId ? { ...m, uazapi_message_id: uazapiId } : m
            ));

            // 6. DB Insert
            const { error: insertError } = await supabase
                .from("messages_dispara_lead_saas_02")
                .insert({
                    id: tempId,
                    tenant_id: instanceData.tenant_id,
                    instance_id: instanceData.id,
                    contact_id: selectedContact.id,
                    content: caption || file.name,
                    direction: 'outbound',
                    message_type: mediaType,
                    media_url: fileUrl,
                    uazapi_message_id: uazapiId,
                    sent_at: new Date().toISOString(),
                    is_read: true
                });

            if (insertError) console.error("DB Insert Error:", insertError);

        } catch (error) {
            console.error("Failed to send media:", error);
            alert("Erro ao enviar arquivo. Verifique o console.");
        } finally {
            setSending(false);
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    };

    const handleSendMessage = async () => {
        if ((!newMessage.trim() && !previewFile?.file) || !selectedInstance || !selectedContact || !instanceData) return;

        // Branch: Media Message
        if (previewFile?.file) {
            // handleConfirmSendMedia already handles newMessage as caption
            await handleConfirmSendMedia();
            return;
        }

        const messageText = newMessage.trim();
        setNewMessage(""); // Clear input immediately
        setSending(true);

        // 1. Optimistic Update
        const tempId = crypto.randomUUID();
        const optimisticMsg = {
            id: tempId,
            content: messageText,
            direction: 'outbound',
            contact_id: selectedContact.id,
            created_at: new Date().toISOString(),
            sent_at: new Date().toISOString(),
            media_url: null,
            status: 'pending'
        };

        setMessages((prev) => [...prev, optimisticMsg]);
        setTimeout(() => scrollToBottom(), 100);

        try {
            // 2. Direct API Call (Client-Side) - No Cold Start
            const UAZAPI_URL = "https://bflabs.uazapi.com";
            const response = await fetch(`${UAZAPI_URL}/send/text`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "token": instanceData.token
                },
                body: JSON.stringify({
                    instanceName: instanceData.instance_name,
                    number: selectedContact.phone,
                    text: messageText
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} ${errText} `);
            }

            const apiResult = await response.json();
            const uazapiId = apiResult.key?.id || apiResult.id;

            // Update Optimistic Message with the real Uazapi ID
            setMessages((prev) => prev.map(m =>
                m.id === tempId ? { ...m, uazapi_message_id: uazapiId } : m
            ));

            // 3. Persist to Database
            const { error: insertError } = await supabase
                .from("messages_dispara_lead_saas_02")
                .insert({
                    id: tempId,
                    tenant_id: instanceData.tenant_id,
                    instance_id: instanceData.id,
                    contact_id: selectedContact.id,
                    content: messageText,
                    direction: 'outbound',
                    message_type: 'text',
                    uazapi_message_id: uazapiId,
                    sent_at: new Date().toISOString()
                });

            if (insertError) {
                console.error("DB Insert Error:", insertError);
            }

        } catch (err) {
            console.error("Failed to send message:", err);
            alert("Falha ao enviar mensagem de texto. Tente novamente.");
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFileClick = (url: string) => {
        if (!url) return;
        // Simple heuristic for type
        const lower = url.toLowerCase();
        let type: 'image' | 'video' | 'other' = 'other';
        if (lower.match(/\.(jpg|jpeg|png|gif|webp)$/) || url.startsWith('data:image') || url.includes('/9j/')) type = 'image';
        else if (lower.match(/\.(mp4|webm|ogg|mov)$/)) type = 'video';

        setPreviewFile({ url, type });
    };

    if (!selectedContact) {
        return (
            <div className="flex flex-1 items-center justify-center bg-muted/20 text-muted-foreground">
                <div className="text-center space-y-2">
                    <Megaphone className="h-10 w-10 mx-auto opacity-20" />
                    <p>Selecione uma conversa para começar</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-1 flex-col overflow-hidden", COLORS.light.bg, COLORS.dark.bg)}>
            {/* Header - Compact */}
            <div className="flex items-center gap-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-3 shadow-sm z-10 dark:border-gray-800">
                {onBack && (
                    <Button variant="ghost" size="icon" className="md:hidden shrink-0 -ml-2" onClick={onBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <Avatar className="h-9 w-9">
                    <AvatarImage src={selectedContact.profile_pic_url} />
                    <AvatarFallback className="text-xs">{selectedContact.name?.charAt(0) || <Bot className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate text-foreground">{selectedContact.name || selectedContact.phone}</h3>
                    <p className="text-[11px] text-muted-foreground truncate">{selectedContact.phone}</p>
                </div>
                <div className="flex items-center gap-1">
                    {/* Actions */}
                    <Button variant="ghost" size="icon" className="shrink-0 xl:hidden" onClick={onToggleDetails}>
                        <div className="h-5 w-5 rotate-180 scale-x-[-1]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-right"><rect width="18" height="18" x="3" y="3" rx="2" /><line x1="15" x2="15" y1="3" y2="21" /><path d="M15 8h5" /><path d="M15 16h5" /></svg>
                        </div>
                    </Button>
                </div>
            </div>

            {/* Messages Area */}
            {/* Messages Area - Native Scroll for Performance */}
            <div
                ref={scrollRef}
                className={cn(
                    "flex-1 overflow-y-auto p-2 sm:p-4 scroll-smooth",
                    !visualReady && "invisible"
                )}
            >
                <div className="flex flex-col gap-2 max-w-5xl mx-auto pb-2">
                    {messages.length === 0 && !visualReady && (
                        <div className="flex justify-center p-4">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const isMe = msg.direction === 'outbound';
                        // Determine styling based on direction
                        const bubbleColor = isMe
                            ? cn(COLORS.light.messageOut, COLORS.dark.messageOut)
                            : cn(COLORS.light.messageIn, COLORS.dark.messageIn);

                        const textColor = "text-gray-800 dark:text-gray-100";

                        return (
                            <div
                                key={msg.id || idx}
                                className={cn(
                                    "relative flex max-w-[85%] sm:max-w-[65%] flex-col rounded-lg px-3 py-1.5 shadow-sm text-sm group",
                                    bubbleColor,
                                    textColor,
                                    isMe ? "self-end rounded-tr-none" : "self-start rounded-tl-none"
                                )}
                            >
                                {/* Media Render */}
                                {msg.media_url && (
                                    <div className="mb-1 mt-1 rounded-sm overflow-hidden bg-black/10">
                                        <div
                                            onClick={() => handleFileClick(msg.media_url)}
                                            className="block cursor-pointer hover:opacity-90 transition-opacity"
                                        >
                                            {msg.media_url.startsWith('/9j/') || msg.media_url.startsWith('data:image') ? (
                                                <img src={`data:image/jpeg;base64,${msg.media_url.replace(/^data:image\/jpeg;base64,/, '')}`} alt="Media" className="max-w-full h-auto max-h-[300px] object-cover" />
                                            ) : (
                                                <img src={msg.media_url} alt="Media" className="max-w-full h-auto max-h-[300px] object-cover" />
                                            )}
                                        </div>
                                    </div>
                                )}

                                <p className="whitespace-pre-wrap leading-relaxed break-words text-[13px]">{msg.content}</p>

                                <div className={cn(
                                    "flex items-center justify-end gap-1 text-[10px] mt-0.5 select-none",
                                    "text-gray-500 dark:text-gray-400"
                                )}>
                                    <span>{msg.sent_at ? format(new Date(msg.sent_at), "HH:mm") : "..."}</span>
                                    {isMe && <CheckCheck className="h-3 w-3 text-blue-500" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Input Area - Compact */}
            < div className="border-t bg-background p-2 sm:p-3 dark:border-gray-800 z-20" >
                {/* Inline Preview Panel */}
                {
                    previewFile?.file && (
                        <div className="flex items-center gap-3 p-3 mb-2 bg-muted/30 rounded-lg border border-border/50 relative animate-in slide-in-from-bottom-2 fade-in duration-200">
                            {previewFile.type === 'image' && (
                                <img src={previewFile.url} className="h-16 w-16 object-cover rounded-md border border-border/50 shadow-sm" alt="Preview" />
                            )}
                            {previewFile.type === 'video' && (
                                <div className="h-16 w-16 bg-black/90 rounded-md flex items-center justify-center border border-border/50 shadow-sm">
                                    <span className="text-xs text-white">Video</span>
                                </div>
                            )}
                            {previewFile.type === 'other' && (
                                <div className="h-16 w-16 bg-muted/50 flex items-center justify-center rounded-md border border-border/50 shadow-sm">
                                    <FileText className="h-8 w-8 text-muted-foreground/70" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{previewFile.file.name}</p>
                                <p className="text-xs text-muted-foreground">{(previewFile.file.size / 1024 / 1024).toFixed(2)} MB • {previewFile.type === 'image' ? 'Imagem' : previewFile.type === 'video' ? 'Vídeo' : 'Arquivo'}</p>
                            </div>
                            <Button onClick={() => { setPreviewFile(null); setNewMessage(""); }} variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted hover:text-destructive transition-colors">
                                <span className="text-lg">×</span>
                            </Button>
                        </div>
                    )
                }

                <div className="flex items-end gap-2 max-w-5xl mx-auto">
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleFileSelect}
                        accept="image/*,video/*,application/pdf,audio/*"
                    />
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-9 w-9 text-muted-foreground hover:bg-muted/50 rounded-full"
                        disabled={sending}
                    >
                        <Paperclip className="h-5 w-5" />
                    </Button>

                    <div className="flex-1 bg-muted/30 dark:bg-gray-800 rounded-lg border border-transparent focus-within:border-ring/30 transition-all">
                        <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder={previewFile?.file ? "Adicione uma legenda..." : "Digite sua mensagem..."}
                            className="flex-1 border-none bg-transparent shadow-none focus-visible:ring-0 min-h-[36px] py-2 px-3 text-sm"
                            autoFocus={!!previewFile?.file}
                        />
                    </div>

                    <Button
                        onClick={handleSendMessage}
                        disabled={sending || (!newMessage.trim() && !previewFile?.file)}
                        className="shrink-0 h-9 w-9 rounded-full bg-[#00A884] hover:bg-[#008f6f] text-white p-0 shadow-sm flex items-center justify-center"
                    >
                        {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
                    </Button>
                </div>
                <div className="text-center mt-1.5 opacity-60">
                    <span className="text-[9px] text-muted-foreground flex items-center justify-center gap-1">
                        🔒 Protegida por criptografia de ponta a ponta
                    </span>
                </div>
            </div >

            {/* File Preview Dialog (Viewer Only for Received Files) */}
            < Dialog open={!!previewFile && !previewFile.file} onOpenChange={() => setPreviewFile(null)}>
                <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
                    {previewFile?.type === 'image' && (
                        <img
                            src={previewFile.url && (previewFile.url.startsWith('http') || previewFile.url.startsWith('data')) ? previewFile.url : `data: image / jpeg; base64, ${previewFile?.url} `}
                            alt="Preview"
                            className="max-h-[85vh] max-w-full rounded-md shadow-2xl object-contain bg-black/50"
                        />
                    )}
                    {previewFile?.type === 'video' && (
                        <video controls className="max-h-[85vh] max-w-full rounded-md shadow-2xl bg-black">
                            <source src={previewFile.url} />
                            Seu navegador não suporta este vídeo.
                        </video>
                    )}
                    {previewFile?.type === 'other' && (
                        <div className="bg-background p-6 rounded-lg shadow-xl text-center">
                            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium mb-2">Arquivo não suportado para pré-visualização</h3>
                            <Button asChild>
                                <a href={previewFile.url} target="_blank" rel="noreferrer">Baixar / Abrir Externamente</a>
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog >
        </div >
    );
}
