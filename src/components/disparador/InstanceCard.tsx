import type { Instance } from '@/store/disparadorStore';
import { useDisparadorStore } from '@/store/disparadorStore';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Wifi, WifiOff, RefreshCw, Trash2, LogOut } from 'lucide-react';
import { useState } from 'react';
import { QrDialog } from './QrDialog';

interface InstanceCardProps {
    instance: Instance;
}

export function InstanceCard({ instance }: InstanceCardProps) {
    const { disconnectInstance, deleteInstance, getConnectionStatus } = useDisparadorStore();
    const [showQr, setShowQr] = useState(false);

    const handleConnect = async () => {
        // Open dialog -> Trigger QR fetch
        setShowQr(true);
    };

    const handleDisconnect = async () => {
        if (confirm('Deseja desconectar esta instância?')) {
            await disconnectInstance(instance.instance_name);
        }
    };

    const handleDelete = async () => {
        if (confirm('ATENÇÃO: Isso excluirá permanentemente a instância. Continuar?')) {
            await deleteInstance(instance.instance_name);
        }
    };

    return (
        <>
            <Card className="bg-[#0A0A0A] border-white/10 text-white shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-lg font-bold truncate pr-4" title={instance.instance_name}>
                        {instance.instance_name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-white"
                            onClick={async (e) => {
                                e.stopPropagation();
                                const btn = e.currentTarget;
                                btn.classList.add('animate-spin');
                                const res = await getConnectionStatus(instance.instance_name);
                                btn.classList.remove('animate-spin');
                                if (res?.raw) {
                                    console.log('Raw Status Response:', res.raw);
                                    // Show raw status for debugging
                                    // toast.info(`Debug: ${JSON.stringify(res.source ? res.source : res.raw).substring(0, 100)}`);
                                }
                                if (res?.status === 'connected') {
                                    toast.success('Instância conectada!');
                                } else {
                                    // Make debug info very visible
                                    console.error("Status Check Failed/Disconnected", res);
                                    let rawStr = JSON.stringify(res?.raw || {});
                                    if (rawStr.length > 150) rawStr = rawStr.substring(0, 150) + '...';

                                    toast.warning(`Status: ${res?.status || 'Indefinido'}`, {
                                        description: `Raw: ${rawStr}`,
                                        duration: 10000,
                                    });
                                }
                            }}
                            title="Verificar Status"
                        >
                            <RefreshCw size={14} />
                        </Button>
                        <Badge
                            variant={instance.status === 'connected' ? 'default' : 'destructive'}
                            className={`${instance.status === 'connected'
                                ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                : instance.status === 'connecting'
                                    ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                                    : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                }`}
                        >
                            {instance.status === 'connected' ? 'Conectado' : instance.status === 'connecting' ? 'Conectando' : 'Desconectado'}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                        {instance.status === 'connected' ? <Wifi size={16} /> : <WifiOff size={16} />}
                        <span>{instance.status === 'connected' ? 'Pronto para uso' : 'Sem conexão'}</span>
                    </div>
                    {instance.client_id && (
                        <div className="mt-2 text-xs text-gray-500">
                            Cliente ID: {instance.client_id}
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2 pt-2">
                    {instance.status !== 'connected' && (
                        <Button variant="outline" size="sm" onClick={handleConnect} className="bg-transparent border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300">
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Conectar
                        </Button>
                    )}

                    {instance.status === 'connected' && (
                        <Button variant="secondary" size="sm" onClick={handleDisconnect} className="bg-red-500/10 text-red-400 hover:bg-red-500/20">
                            <LogOut className="mr-2 h-4 w-4" />
                            Desconectar
                        </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={handleDelete} className="text-gray-500 hover:text-red-400 hover:bg-transparent">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </CardFooter>
            </Card>

            <QrDialog
                isOpen={showQr}
                onClose={() => setShowQr(false)}
                instanceName={instance.instance_name}
            />
        </>
    );
}
