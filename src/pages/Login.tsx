import { useState } from 'react';
import { Lock, Mail, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '../store/authStore';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const login = useAuthStore((state) => state.login);
    const isLoading = useAuthStore((state) => state.isLoading);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!email || !password) {
            toast.error('Por favor, preencha todos os campos');
            return;
        }

        const { success, error } = await login(email, password);

        if (!success) {
            toast.error(error || 'Erro ao fazer login');
        } else {
            toast.success('Login realizado com sucesso!');
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-20%] left-[-20%] w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-20%] right-[-20%] w-[800px] h-[800px] bg-secondary/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-md relative z-10">
                <div className="text-center mb-12">
                    <img src="/logo.png" alt="Rastreia Lead Logo" className="w-24 h-24 object-contain mx-auto mb-6 hover:scale-105 transition-transform duration-300 rounded-3xl shadow-2xl shadow-primary/30" />
                    <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Bem-vindo</h1>
                    <p className="text-gray-400 text-lg">Faça login para acessar o painel</p>
                </div>

                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 md:p-10 shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 ml-1">Email</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary/50 focus:bg-black/30 focus:ring-1 focus:ring-primary/50 transition-all outline-none"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center ml-1">
                                <label className="text-sm font-medium text-gray-300">Senha</label>
                            </div>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-11 pr-4 py-3.5 bg-black/20 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary/50 focus:bg-black/30 focus:ring-1 focus:ring-primary/50 transition-all outline-none"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-4 px-4 border border-transparent rounded-xl shadow-lg text-base font-bold text-background bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                                <span className="flex items-center gap-2">
                                    Entrar
                                    <ArrowRight size={20} />
                                </span>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-gray-600 text-sm mt-8">
                    © 2026 Rastreia Lead Dashboard
                </p>
            </div>
        </div>
    );
}
