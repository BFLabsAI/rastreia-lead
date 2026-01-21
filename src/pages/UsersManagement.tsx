import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Shield, Loader2, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';

interface UserData {
    id: string;
    email: string;
    role: string;
    client_ids: string[];
    created_at: string;
}

interface ClientData {
    id: string;
    nome: string;
}

export function UsersManagement() {
    const { user: currentUser } = useAuthStore();
    const [users, setUsers] = useState<UserData[]>([]);
    const [clients, setClients] = useState<ClientData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserData | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        role: 'user',
        client_ids: [] as string[]
    });

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (editingUser) {
            setFormData({
                email: editingUser.email,
                password: '', // Leave empty to keep unchanged
                role: editingUser.role,
                client_ids: Array.isArray(editingUser.client_ids) ? editingUser.client_ids : []
            });
        } else {
            setFormData({
                email: '',
                password: '',
                role: 'user',
                client_ids: []
            });
        }
    }, [editingUser]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch Users
            const { data: usersData, error: usersError } = await supabase
                .from('users_clientes_bf_labs')
                .select('*')
                .order('created_at', { ascending: false });

            if (usersError) throw usersError;

            // Fetch Clients for selection
            const { data: clientsData, error: clientsError } = await supabase
                .from('relatorio_clientes_bf_labs')
                .select('id, nome')
                .order('nome');

            if (clientsError) throw clientsError;

            setUsers(usersData || []);
            setClients(clientsData || []);
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error('Erro ao carregar dados');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            const payload: any = {
                email: formData.email,
                role: formData.role,
                client_ids: formData.client_ids
            };

            // Only update password if provided
            if (formData.password) {
                payload.password = formData.password;
            } else if (!editingUser) {
                toast.error('Senha é obrigatória para novos usuários');
                return;
            }

            if (editingUser) {
                const { error } = await supabase
                    .from('users_clientes_bf_labs')
                    .update(payload)
                    .eq('id', editingUser.id);
                if (error) throw error;
                toast.success('Usuário atualizado!');
            } else {
                const { error } = await supabase
                    .from('users_clientes_bf_labs')
                    .insert([payload]);
                if (error) throw error;
                toast.success('Usuário criado!');
            }

            setIsDialogOpen(false);
            setEditingUser(null);
            fetchData();
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error('Erro ao salvar usuário');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

        try {
            const { error } = await supabase
                .from('users_clientes_bf_labs')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Usuário excluído');
            fetchData();
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Erro ao excluir usuário');
        }
    };

    const toggleClientAccess = (clientId: string) => {
        setFormData(prev => {
            const current = prev.client_ids || [];
            if (current.includes(clientId)) {
                return { ...prev, client_ids: current.filter(id => id !== clientId) };
            } else {
                return { ...prev, client_ids: [...current, clientId] };
            }
        });
    };

    const toggleAdminAccess = () => {
        setFormData(prev => {
            const current = prev.client_ids || [];
            if (current.includes('*')) {
                return { ...prev, client_ids: [] };
            } else {
                return { ...prev, client_ids: ['*'] };
            }
        })
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-indigo-500 w-8 h-8" />
            </div>
        );
    }

    if (currentUser?.role !== 'super_admin') {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Shield size={48} className="mb-4 text-red-500" />
                <h2 className="text-xl font-bold text-white">Acesso Negado</h2>
                <p>Você não tem permissão para acessar esta página.</p>
            </div>
        )
    }

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Gestão de Usuários</h1>
                    <p className="text-gray-400">Adicione e gerencie o acesso de usuários ao sistema.</p>
                </div>
                <Button onClick={() => { setEditingUser(null); setIsDialogOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="w-5 h-5 mr-2" />
                    Novo Usuário
                </Button>
            </div>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-white/5 border-b border-white/5">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Usuário</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Função</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Acesso</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center font-bold text-white text-xs">
                                            {user.email.substring(0, 2).toUpperCase()}
                                        </div>
                                        <span className="text-white font-medium">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <Badge variant="outline" className={
                                        user.role === 'super_admin' ? 'border-purple-500 text-purple-400' :
                                            user.role === 'admin' ? 'border-indigo-500 text-indigo-400' :
                                                'border-gray-700 text-gray-400'
                                    }>
                                        {user.role}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4">
                                    {(user.client_ids?.includes('*') || user.role === 'super_admin') ? (
                                        <span className="text-green-400 text-sm font-medium">Acesso Total (Super Admin)</span>
                                    ) : (
                                        <span className="text-gray-400 text-sm">{user.client_ids?.length || 0} Clientes</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => { setEditingUser(user); setIsDialogOpen(true); }}
                                            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div >

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-lg bg-[#111] border-white/10 text-white">
                    <DialogHeader>
                        <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="bg-black/50 border-white/10"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Senha {editingUser && '(Deixe em branco para manter)'}</Label>
                            <Input
                                type="text"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="bg-black/50 border-white/10"
                                placeholder={editingUser ? '••••••••' : 'Nova senha'}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Função</Label>
                            <select
                                value={formData.role}
                                onChange={e => {
                                    const newRole = e.target.value;
                                    setFormData(prev => ({
                                        ...prev,
                                        role: newRole,
                                        // Auto-set wildcard for super_admin only
                                        client_ids: (newRole === 'super_admin') ? ['*'] : []
                                    }));
                                }}
                                className="w-full flex h-10 w-full rounded-md border border-input bg-black/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border-white/10 text-white"
                            >
                                <option value="user">Usuário Comum (Apenas Dashboards)</option>
                                <option value="admin">Administrador (Líder / Gestor)</option>
                                <option value="super_admin">Super Admin (Acesso Total)</option>
                            </select>
                        </div>

                        <div className="space-y-3">
                            <Label>Acesso a Clientes</Label>

                            <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                <button type="button" onClick={toggleAdminAccess} className="flex-1 text-left flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${formData.client_ids.includes('*') ? 'bg-purple-500 border-purple-500' : 'border-gray-500'}`}>
                                        {formData.client_ids.includes('*') && <Check size={12} className="text-white" />}
                                    </div>
                                    <span className="text-sm font-medium text-purple-200">Acesso Total (Todos os clientes)</span>
                                </button>
                            </div>

                            {!formData.client_ids.includes('*') && (
                                <div className="h-48 overflow-y-auto space-y-1 p-2 bg-black/30 rounded-lg border border-white/5">
                                    {clients.map(client => (
                                        <div key={client.id}
                                            className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-md cursor-pointer transition-colors"
                                            onClick={() => toggleClientAccess(client.id)}
                                        >
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${formData.client_ids.includes(client.id) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-600'}`}>
                                                {formData.client_ids.includes(client.id) && <Check size={12} className="text-white" />}
                                            </div>
                                            <span className="text-sm text-gray-300">{client.nome}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="hover:bg-white/10 text-white">
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                {isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Salvar Usuário'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div >
    );
}
