import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { uazapiClient } from '../services/uazapiClient';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../components/ui/card';
import { Loader2, Wifi, RefreshCw, LogOut, CheckCircle2, AlertCircle, Timer, QrCode } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export function InstanceConnection() {
    const { token } = useParams();
    const [instance, setInstance] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [checkingStatus, setCheckingStatus] = useState(false);

    // QR Code State
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [generatingQr, setGeneratingQr] = useState(false);
    const [timeLeft, setTimeLeft] = useState(0);

    // Initial Load
    useEffect(() => {
        if (!token) {
            setError('Token inválido');
            setLoading(false);
            return;
        }

        const fetchInstance = async () => {
            try {
                // Tenta buscar por share_token primeiro, depois por uazapi_instance_id
                let { data, error } = await supabase
                    .from('instances_clientes_bf_labs')
                    .select('*')
                    .eq('share_token', token)
                    .single();

                // Se não encontrou por share_token, tenta por uazapi_instance_id
                if (error || !data) {
                    const result = await supabase
                        .from('instances_clientes_bf_labs')
                        .select('*')
                        .eq('uazapi_instance_id', token)
                        .single();
                    data = result.data;
                    error = result.error;
                }

                if (error || !data) {
                    throw new Error('Instância não encontrada ou link expirado');
                }

                setInstance(data);

                // If connected, sync status
                if (data.status === 'connected') {
                    checkStatus(data.instance_name);
                }

            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchInstance();
    }, [token]);

    // Realtime Updates
    useEffect(() => {
        if (!instance?.id) return;

        const channel = supabase
            .channel(`public-instance-${instance.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'instances_clientes_bf_labs',
                    filter: `id=eq.${instance.id}`
                },
                (payload) => {
                    const updated = payload.new;
                    setInstance((prev: any) => ({ ...prev, ...updated }));

                    // Clear QR if connected
                    if (updated.status === 'connected') {
                        setQrCode(null);
                        setTimeLeft(0);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [instance?.id]);

    // Timer Effect
    useEffect(() => {
        if (timeLeft <= 0) return;
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    checkStatus(instance.instance_name); // Check status on timeout
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [timeLeft]);


    const checkStatus = async (instanceName: string, isManual = false) => {
        setCheckingStatus(true);
        try {
            const res = await uazapiClient.getConnectionStatus(instanceName);
            // If manual check and not connected, warn user
            if (isManual && (!res?.status || res.status !== 'connected')) {
                toast.warning('Ainda não identificamos a conexão. Aguarde um momento...');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setCheckingStatus(false);
        }
    };

    const handleGenerateQr = async () => {
        if (!instance) return;

        setGeneratingQr(true);
        setQrCode(null);

        try {
            // Trigger QR generation
            const res = await uazapiClient.getQrCode(instance.instance_name);

            if (res.qrcode) {
                setQrCode(res.qrcode);
                setTimeLeft(120); // Reset timer 2 mins
                toast.success('QR Code gerado com sucesso');
            } else if (instance.status === 'connected') {
                toast.success('Instância já conectada!');
            } else {
                toast.error('Não foi possível gerar o QR Code. Tente novamente.');
            }
        } catch (e) {
            console.error(e);
            toast.error('Erro ao gerar QR Code');
        } finally {
            setGeneratingQr(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Desconectar instância?')) return;
        setCheckingStatus(true);
        try {
            await uazapiClient.disconnectInstance(instance.instance_name);
            toast.success('Desconectado');
            setQrCode(null);
        } catch (e) {
            toast.error('Erro ao desconectar');
        } finally {
            setCheckingStatus(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center text-white">
                <Loader2 className="animate-spin w-8 h-8 text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <Card className="max-w-md w-full bg-zinc-900 border-red-900/50 text-white">
                    <CardHeader>
                        <CardTitle className="text-red-500 flex items-center gap-2">
                            <AlertCircle /> Erro
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-zinc-400">
                        {error}
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isConnected = instance.status === 'connected';

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute inset-0 bg-primary/5 blur-[100px]" />

            <Toaster theme="dark" position="top-center" />

            <div className="w-full max-w-md relative z-10 space-y-6">

                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/20 text-primary mb-4 ring-1 ring-inset ring-primary/30">
                        <Wifi size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Conexão Rápida</h1>
                    {!isConnected && (
                        <p className="text-gray-400 text-sm">Gerencie a conexão da instância</p>
                    )}
                </div>

                <Card className="bg-zinc-900/80 border-white/10 backdrop-blur-xl shadow-2xl text-white">
                    <CardHeader className="text-center pb-2">
                        <CardTitle className="text-xl">{instance.instance_name}</CardTitle>
                        <CardDescription className="flex items-center justify-center gap-2 pt-2">
                            <span className={`font-bold px-2 py-0.5 rounded text-xs uppercase tracking-wider ${isConnected
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-amber-500/20 text-amber-400'
                                }`}>
                                {isConnected ? 'Conectado' : 'Desconectado'}
                            </span>
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="flex flex-col items-center py-6">
                        {isConnected ? (
                            <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-500">
                                <div className="w-48 h-48 bg-green-500/10 rounded-full flex items-center justify-center border-2 border-green-500/30 shadow-[0_0_30px_rgba(34,197,94,0.2)]">
                                    <CheckCircle2 size={64} className="text-green-500" />
                                </div>
                                <p className="text-sm text-gray-400 text-center max-w-[200px]">
                                    Instância ativa e pronta para uso.
                                </p>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center gap-6">
                                {qrCode && timeLeft > 0 ? (
                                    <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in">
                                        <div className="bg-white p-4 rounded-xl shadow-lg relative">
                                            <img
                                                src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                                                alt="QR Code"
                                                className="w-64 h-64 object-contain"
                                            />
                                            {timeLeft < 10 && timeLeft > 0 && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                                    <span className="text-red-500 font-bold animate-pulse">Expirando...</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 text-amber-500 text-sm font-medium bg-amber-500/10 px-4 py-2 rounded-full">
                                            <Timer className="w-4 h-4" />
                                            <span>Expira em {timeLeft}s</span>
                                        </div>

                                        <Button
                                            onClick={() => checkStatus(instance.instance_name, true)}
                                            disabled={checkingStatus}
                                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                                        >
                                            {checkingStatus ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                            Já realizei a leitura
                                        </Button>

                                        <p className="text-xs text-gray-500 text-center max-w-[250px]">
                                            Abra o WhatsApp &gt; Aparelhos conectados &gt; Conectar aparelho e aponte para o código
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4 py-8">
                                        <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-2">
                                            <QrCode className="w-10 h-10 text-zinc-500" />
                                        </div>
                                        <div className="text-center space-y-1">
                                            <p className="text-zinc-300 font-medium">
                                                {timeLeft === 0 && qrCode ? 'QR Code Expirado' : 'Gerar QR Code'}
                                            </p>
                                            <p className="text-zinc-500 text-center text-sm max-w-[240px]">
                                                {timeLeft === 0 && qrCode
                                                    ? 'O tempo para conexão acabou. Gere um novo código.'
                                                    : 'Clique abaixo para gerar um novo QR Code de conexão.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="flex flex-col gap-3 pt-2 w-full">
                        {!isConnected && (
                            !qrCode ? (
                                <Button
                                    size="lg"
                                    className="w-full bg-primary hover:bg-primary/90 text-background font-medium h-12"
                                    onClick={handleGenerateQr}
                                    disabled={generatingQr}
                                >
                                    {generatingQr ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <QrCode className="mr-2 h-5 w-5" />}
                                    {generatingQr ? 'Gerando...' : 'Conectar WhatsApp'}
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full border-zinc-700 bg-transparent text-white hover:bg-zinc-800 h-12"
                                    onClick={handleGenerateQr} // Regenerate
                                    disabled={generatingQr}
                                >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${generatingQr ? 'animate-spin' : ''}`} />
                                    Gerar Novo Código
                                </Button>
                            )
                        )}

                        {isConnected && (
                            <Button
                                variant="destructive"
                                className="w-full bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/20 border h-12"
                                onClick={handleDisconnect}
                                disabled={checkingStatus}
                            >
                                {checkingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                                Desconectar Instância
                            </Button>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-zinc-500 hover:text-white text-xs mt-2"
                            onClick={() => checkStatus(instance.instance_name)}
                            disabled={checkingStatus}
                        >
                            Verificar status da conexão
                        </Button>
                    </CardFooter>
                </Card>

                <div className="text-center">
                    <p className="text-xs text-zinc-600">
                        Dashboard Cliente • Conexão Segura
                    </p>
                </div>
            </div>
        </div>
    );
}
