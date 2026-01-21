import { LayoutDashboard, Users, Zap, TrendingUp, LogOut, Hexagon, BarChart3, UserPlus, Settings, MessageSquare, MessageSquareQuote, QrCode, ChevronDown, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';


interface SidebarProps {
    currentPath: string; // Kept for compatibility but unused
    // onNavigate no longer needed with NavLink
}

const NAV_ITEMS = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Relatório de Leads', path: '/leads-report', icon: BarChart3 },
    { label: 'Leads', path: '/leads', icon: Users },
    { label: 'Meta Ads', path: '/meta', icon: Zap },
    { label: 'Google Ads', path: '/google', icon: TrendingUp },
    { label: 'Qr Code', path: '/whatsapp-connection', icon: QrCode },
    { label: 'WhatsApp', path: '/whatsapp', icon: MessageSquare },
    { label: 'Frases e Origens', path: '/phrases', icon: MessageSquareQuote },
];

import { useClient } from '../contexts/ClientContext';
import { useAuthStore } from '../store/authStore';

export function Sidebar({ }: SidebarProps) {
    const user = useAuthStore((state) => state.user);
    const { clients, selectedClient, selectClient, isLoading } = useClient();
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const navigate = useNavigate();

    return (
        <aside className="fixed left-0 top-0 h-screen w-72 p-4 flex flex-col z-50">
            <div className="h-full bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col shadow-2xl">

                {/* Logo Area */}
                <div className="p-6 flex items-center gap-3 border-b border-white/5">
                    <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/20">
                        <Hexagon className="text-white fill-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-wide">BF LABS</h1>
                        <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Intelligence</p>
                    </div>
                </div>

                {/* Client Selector (Moved to Sidebar) */}
                <div className="px-4 py-4 relative">
                    <button
                        onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors group"
                    >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/10 text-white text-xs font-bold">
                            {selectedClient ? selectedClient.nome.substring(0, 2).toUpperCase() : <Users size={14} />}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">Cliente</p>
                            <div className="flex items-center justify-between gap-2">
                                <h2 className="text-white font-semibold text-sm truncate">
                                    {isLoading ? '...' : (selectedClient?.nome || 'Selecione')}
                                </h2>
                                <ChevronDown size={14} className={clsx("text-gray-500 transition-transform duration-300 flex-shrink-0", isClientDropdownOpen && "rotate-180")} />
                            </div>
                        </div>
                    </button>

                    {isClientDropdownOpen && (
                        <div className="absolute left-4 right-4 top-full mt-2 bg-[#0F1015] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden p-1 animate-in fade-in slide-in-from-top-2">
                            <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                {clients.map(client => (
                                    <button
                                        key={client.id}
                                        onClick={() => {
                                            selectClient(client.id);
                                            setIsClientDropdownOpen(false);
                                        }}
                                        className={clsx(
                                            "w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3 mb-0.5",
                                            selectedClient?.id === client.id
                                                ? "bg-white/10 text-white"
                                                : "text-gray-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        <div className={clsx(
                                            "w-1.5 h-1.5 rounded-full flex-shrink-0",
                                            selectedClient?.id === client.id ? "bg-indigo-500 shadow-[0_0_10px_#6366f1]" : "bg-gray-700"
                                        )} />
                                        <span className="font-medium text-sm truncate">{client.nome}</span>
                                    </button>
                                ))}
                                {clients.length === 0 && !isLoading && (
                                    <div className="p-3 text-center text-gray-500 text-xs">Nenhum cliente</div>
                                )}

                                <button
                                    onClick={() => {
                                        navigate('/clients/new');
                                        setIsClientDropdownOpen(false);
                                    }}
                                    className="w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3 text-indigo-400 hover:text-white hover:bg-white/5 border-t border-white/5 mt-1"
                                >
                                    <Plus size={14} />
                                    <span className="font-medium text-sm">Novo Cliente</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2">
                    <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Menu</p>
                    {NAV_ITEMS.filter(item => {
                        // Hide WhatsApp for regular users
                        if (item.label === 'Qr Code' && user?.role === 'user') return false;

                        // Hide Meta Ads if inactive for selected client
                        if (item.label === 'Meta Ads' && selectedClient?.active_meta === false) return false;

                        // Hide Google Ads if inactive for selected client
                        if (item.label === 'Google Ads' && selectedClient?.active_google === false) return false;

                        return true;
                    }).map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => clsx(
                                "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden",
                                isActive
                                    ? "text-white shadow-lg shadow-purple-500/10"
                                    : "text-gray-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            {({ isActive }) => (
                                <>
                                    {isActive && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-l-2 border-indigo-500" />
                                    )}
                                    <item.icon
                                        size={20}
                                        className={clsx(
                                            "relative z-10 transition-colors duration-300",
                                            isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-gray-300"
                                        )}
                                    />
                                    <span className="relative z-10 font-medium text-sm tracking-wide">{item.label}</span>
                                </>
                            )}
                        </NavLink>
                    ))}

                    {/* Add Client Edit Link */}
                    <NavLink
                        to="/clients/edit"
                        className={({ isActive }) => clsx(
                            "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden mt-4",
                            isActive
                                ? "text-white shadow-lg shadow-purple-500/10"
                                : "text-gray-400 hover:text-white hover:bg-white/5"
                        )}
                    >
                        {({ isActive }) => (
                            <>
                                {isActive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border-l-2 border-indigo-500" />
                                )}
                                <Settings
                                    size={20}
                                    className={clsx(
                                        "relative z-10 transition-colors duration-300",
                                        isActive ? "text-indigo-400" : "text-gray-500 group-hover:text-gray-300"
                                    )}
                                />
                                <span className="relative z-10 font-medium text-sm tracking-wide">Dados do Cliente</span>
                            </>
                        )}
                    </NavLink>
                </nav>

                {/* User / Logout */}
                <div className="p-4 mx-4 mb-4 mt-auto rounded-xl bg-white/5 border border-white/5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-400 to-orange-500 flex items-center justify-center font-bold text-black text-xs">
                            {user?.email?.substring(0, 2).toUpperCase() || 'US'}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-white text-sm font-medium truncate" title={user?.email}>{user?.email?.split('@')[0] || 'Usuário'}</p>
                            <p className="text-xs text-gray-500 capitalize">{user?.role?.replace('_', ' ') || 'User'}</p>
                        </div>
                    </div>

                    {/* New Client Button - Only for Super Admin */}
                    {user?.role === 'super_admin' && (
                        <NavLink
                            to="/clients/new"
                            className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors w-full px-1 mb-2"
                        >
                            <UserPlus size={14} />
                            <span>Novo Cliente</span>
                        </NavLink>
                    )}

                    {/* Users Management Link - Only for Super Admin */}
                    {(user?.role === 'super_admin') && (
                        <NavLink
                            to="/users"
                            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 text-xs font-medium transition-colors w-full px-1 mb-2"
                        >
                            <Users size={14} />
                            <span>Gerenciar Usuários</span>
                        </NavLink>
                    )}

                    <button
                        onClick={() => {
                            useAuthStore.getState().logout();
                            // window.location.reload(); 
                        }}
                        className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-xs font-medium transition-colors w-full px-1"
                    >
                        <LogOut size={14} />
                        <span>Sair do Sistema</span>
                    </button>
                </div>

            </div>
        </aside>
    );
}

