import { LayoutDashboard, Users, Zap, TrendingUp, LogOut, Hexagon, BarChart3, UserPlus, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { NavLink } from 'react-router-dom';
import { supabase } from '../lib/supabase';

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
];

export function Sidebar({ }: SidebarProps) {
    return (
        <aside className="fixed left-0 top-0 h-screen w-72 p-4 flex flex-col z-50">
            <div className="h-full bg-[#0A0A0A]/80 backdrop-blur-xl border border-white/5 rounded-2xl flex flex-col shadow-2xl">

                {/* Logo Area */}
                <div className="p-8 flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/20">
                        <Hexagon className="text-white fill-white" size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-wide">BF LABS</h1>
                        <p className="text-[10px] text-gray-400 font-medium tracking-wider uppercase">Intelligence</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 px-4 space-y-2">
                    <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-4">Menu</p>
                    {NAV_ITEMS.map((item) => (
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
                            GA
                        </div>
                        <div className="flex-1">
                            <p className="text-white text-sm font-medium">Guilherme</p>
                            <p className="text-xs text-gray-500">Admin</p>
                        </div>
                    </div>

                    {/* New Client Button in User Area */}
                    <NavLink
                        to="/clients/new"
                        className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-colors w-full px-1 mb-2"
                    >
                        <UserPlus size={14} />
                        <span>Novo Cliente</span>
                    </NavLink>

                    <button
                        onClick={async () => {
                            await supabase.auth.signOut();
                            window.location.reload(); // Force reload to clear state and likely redirect to login
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
