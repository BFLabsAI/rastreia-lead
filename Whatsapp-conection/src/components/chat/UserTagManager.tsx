
import { useState, useEffect } from "react";
import { Plus, X, Search, Check, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/services/supabaseClient";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Tag {
    id: string;
    name: string;
    color: string;
    tenant_id?: string;
}

interface UserTagManagerProps {
    contactId: string;
    assignedTagIds: string[]; // JSON array of IDs from contact.tags
    onUpdateTags: (newTags: string[]) => void;
}

const COLORS = [
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#eab308", // yellow-500
    "#22c55e", // green-500
    "#06b6d4", // cyan-500
    "#3b82f6", // blue-500
    "#a855f7", // purple-500
    "#ec4899", // pink-500
    "#64748b", // slate-500
];

export function UserTagManager({ contactId, assignedTagIds = [], onUpdateTags }: UserTagManagerProps) {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [availableTags, setAvailableTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);

    // New Tag State
    const [isCreating, setIsCreating] = useState(false);
    const [newTagName, setNewTagName] = useState("");
    const [newTagColor, setNewTagColor] = useState(COLORS[5]); // Default blue

    useEffect(() => {
        fetchTags();
    }, [open]); // Re-fetch on open to ensure freshness, but also fetch on mount logic below (actually this handles mount if open is default false? No)

    // Ensure we fetch tags at least once to show the assigned list
    useEffect(() => {
        if (availableTags.length === 0) {
            fetchTags();
        }
    }, []);

    const fetchTags = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("user_tags_dispara_lead_saas_02")
            .select("*")
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Error fetching tags:", error);
            toast.error("Erro ao carregar etiquetas.");
        } else {
            setAvailableTags(data || []);
        }
        setLoading(false);
    };

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("User not found");

            // Fetch tenant_id explicitly from users table
            const { data: userData, error: userError } = await supabase
                .from("users_dispara_lead_saas_02")
                .select("tenant_id")
                .eq("id", user.id)
                .single();

            if (userError || !userData?.tenant_id) {
                console.error("Tenant Fetch Error:", userError);
                throw new Error("ID da conta não encontrado.");
            }

            const tenantId = userData.tenant_id;

            const { data, error } = await supabase
                .from("user_tags_dispara_lead_saas_02")
                .insert([{
                    name: newTagName.trim(),
                    color: newTagColor,
                    tenant_id: tenantId
                }])
                .select()
                .single();

            if (error) throw error;

            setAvailableTags([data, ...availableTags]);
            // Auto-assign the new tag? Optional. For now just go back to list.
            setIsCreating(false);
            setNewTagName("");
            toast.success("Etiqueta criada!");

            // Auto assign if requested?
            toggleTag(data.id, [...availableTags, data]);

        } catch (error) {
            console.error(error);
            toast.error("Erro ao criar etiqueta.");
        }
    };

    const toggleTag = async (tagId: string, currentTagsList = availableTags) => {
        const isAssigned = assignedTagIds.includes(tagId);
        let newTags = [...assignedTagIds];

        if (isAssigned) {
            newTags = newTags.filter(id => id !== tagId);
        } else {
            if (newTags.length >= 3) {
                toast.error("Limite de 3 etiquetas por contato atingido.");
                return;
            }
            newTags.push(tagId);
        }

        // Optimistic Update
        onUpdateTags(newTags);

        // Persist
        const { error } = await supabase
            .from("contacts_dispara_lead_saas_02")
            .update({ tags: newTags })
            .eq("id", contactId);

        if (error) {
            console.error("Error updating contact tags:", error);
            toast.error("Erro ao atualizar etiquetas.");
            // Revert (could be improved)
            fetchTags();
        }
    };

    // Filter tags
    const filteredTags = availableTags.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col gap-2">

            {/* Display Assigned Tags */}
            <div className="flex flex-wrap gap-1.5">
                {assignedTagIds.map(tagId => {
                    const tag = availableTags.find(t => t.id === tagId);

                    // If we don't have the tag in restricted list (availableTags might be empty if not opened yet)
                    // We might need to render something if we want them visible before opening.
                    // But in ChatDetails, we might want to pass standard tags or fetch them there.
                    // THIS COMPONENT fetches on open. So if not opened, we might miss names if looking only here.
                    // However, for this specific request, the user wants the interaction to be cleaner.

                    // Quick fix: If we are not open, we might not have tags. 
                    // But typically ChatDetails *also* fetches contact details. 
                    // Ideally, ChatDetails should pass available tags or this component should fetch on mount.
                    // For now, let's fetch on mount if assignedTagIds > 0 and availableTags is empty to ensure we show them.

                    // Note: If we really want to show them immediately, we should fetch.

                    if (!tag) return null;

                    return (
                        <span
                            key={tagId}
                            className="px-2 py-0.5 rounded text-[10px] font-medium border flex items-center gap-1"
                            style={{
                                backgroundColor: `${tag.color}10`, // Very light bg
                                color: tag.color,
                                borderColor: `${tag.color}20`
                            }}
                        >
                            {tag.name}
                        </span>
                    );
                })}

                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-5 px-2 text-[10px] rounded border-dashed opacity-70 hover:opacity-100 bg-transparent"
                            disabled={assignedTagIds.length >= 3}
                        >
                            <Plus className="h-3 w-3 mr-1" />
                            Adicionar
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[240px] p-0" align="start">
                        <div className="flex flex-col">
                            {!isCreating ? (
                                <>
                                    <div className="p-2 border-b">
                                        <div className="relative">
                                            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                                            <Input
                                                placeholder="Buscar..."
                                                className="h-7 pl-7 text-xs bg-background"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <ScrollArea className="h-[180px]">
                                        <div className="p-1 space-y-0.5">
                                            {loading && <p className="text-xs text-center p-2 text-muted-foreground">Carregando...</p>}

                                            {!loading && filteredTags.length === 0 && (
                                                <div className="text-center p-2">
                                                    <p className="text-[10px] text-muted-foreground mb-1.5">Nenhuma etiqueta.</p>
                                                    <Button size="sm" variant="secondary" className="h-6 text-[10px] w-full" onClick={() => setIsCreating(true)}>
                                                        Criar "{searchTerm}"
                                                    </Button>
                                                </div>
                                            )}

                                            {filteredTags.map(tag => {
                                                const isSelected = assignedTagIds.includes(tag.id);
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        onClick={() => toggleTag(tag.id)}
                                                        className={cn(
                                                            "w-full flex items-center justify-between px-2 py-1.5 text-xs rounded-sm hover:bg-muted transition-colors text-left",
                                                            isSelected && "bg-muted/50"
                                                        )}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-2 w-2 rounded-full shrink-0"
                                                                style={{ backgroundColor: tag.color }}
                                                            />
                                                            <span className={cn("truncate", isSelected && "font-medium")}>{tag.name}</span>
                                                        </div>
                                                        {isSelected && <Check className="h-3 w-3 text-primary shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-1 border-t bg-muted/5">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 w-full text-xs justify-start px-2 text-muted-foreground hover:text-foreground"
                                            onClick={() => setIsCreating(true)}
                                        >
                                            <Plus className="h-3 w-3 mr-2" />
                                            Nova Etiqueta
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="p-2 space-y-3">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-muted-foreground">Nome da Etiqueta</label>
                                        <Input
                                            value={newTagName}
                                            onChange={(e) => setNewTagName(e.target.value)}
                                            placeholder="Ex: Cliente VIP"
                                            className="h-7 text-xs"
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-medium text-muted-foreground">Cor</label>
                                        <div className="flex flex-wrap gap-1.5">
                                            {COLORS.map(color => (
                                                <button
                                                    key={color}
                                                    onClick={() => setNewTagColor(color)}
                                                    className={cn(
                                                        "h-4 w-4 rounded-full border transition-all hover:scale-110",
                                                        newTagColor === color ? "ring-1 ring-offset-1 ring-primary border-transparent" : "border-transparent opacity-70"
                                                    )}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex justify-between pt-1">
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setIsCreating(false)}>
                                            Voltar
                                        </Button>
                                        <Button size="sm" className="h-6 text-[10px] px-3" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                                            Criar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
