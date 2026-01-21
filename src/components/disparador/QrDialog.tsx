import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDisparadorStore } from '@/store/disparadorStore';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Timer } from 'lucide-react';

interface QrDialogProps {
    instanceName: string;
    isOpen: boolean;
    onClose: () => void;
}

export function QrDialog({ instanceName, isOpen, onClose }: QrDialogProps) {
    const { getQrCode, instances, getConnectionStatus, loadInstances } = useDisparadorStore();
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState<number>(120);
    const [isChecking, setIsChecking] = useState(false);
    const instance = instances.find(i => i.instance_name === instanceName);

    // Force check function
    const checkStatus = async () => {
        setIsChecking(true);
        const res = await getConnectionStatus(instanceName);
        setIsChecking(false);
        if (res?.status === 'connected') {
            console.log('[QrDialog] Connected detected via manual check!');
            onClose();
        } else {
            // Optional: toast warning if manual click
            // toast.info("Ainda aguardando conexão...")
        }
    };

    // Close wrapper to check status when closing usually
    const handleClose = () => {
        // Force check/reload on close just in case
        if (instance?.client_id) {
            loadInstances(instance.client_id); // refresh list for this client
        } else {
            loadInstances(); // fallback
        }
        onClose();
    };

    useEffect(() => {
        let active = true;
        let timerParams: ReturnType<typeof setTimeout> | undefined;

        const fetchQr = async () => {
            if (!isOpen) return;
            console.log(`[QrDialog] Opening for ${instanceName}, loading...`);
            setIsLoading(true);
            setQrCode(null);
            setTimeLeft(120);

            try {
                const res = await getQrCode(instanceName);
                if (active) {
                    if (res?.qrcode) {
                        console.log('[QrDialog] QR Code loaded in dialog');
                        setQrCode(res.qrcode);

                        // Calculate time left from generation
                        if (res.qrcode_generated_at) {
                            const genTime = new Date(res.qrcode_generated_at).getTime();
                            const now = Date.now();
                            const diffInSeconds = Math.floor((now - genTime) / 1000);
                            const remaining = 120 - diffInSeconds;
                            setTimeLeft(remaining > 0 ? remaining : 0);
                        } else {
                            setTimeLeft(120); // Fallback if no timestamp
                        }
                    } else {
                        console.error('[QrDialog] Failed to load QR (code is null)');
                        setTimeLeft(0); // Show retry
                    }
                }
            } catch (error) {
                console.error('[QrDialog] Error in fetchQr:', error);
                setTimeLeft(0);
            } finally {
                if (active) setIsLoading(false);
            }
        };

        if (isOpen) {
            fetchQr();
        }

        return () => {
            active = false;
            clearInterval(timerParams);
        };
    }, [isOpen, instanceName, getQrCode]); // Only re-fetch on open

    // Countdown Timer & Force Check on Timeout
    useEffect(() => {
        if (!isOpen || timeLeft <= 0 || !qrCode) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    // Timeout hit: Force status check one last time
                    checkStatus();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isOpen, timeLeft, qrCode]);

    // Poll status while open
    // Auto-close when connected
    useEffect(() => {
        if (instance?.status === 'connected') {
            console.log('[QrDialog] Instance connected, closing dialog');
            onClose();
        }
    }, [instance?.status, onClose]);


    const handleReconnect = () => {
        setIsLoading(true);
        setQrCode(null);
        getQrCode(instanceName).then((res) => {
            if (res?.qrcode) {
                setQrCode(res.qrcode);
                setTimeLeft(120); // Assume new QR
            } else {
                setTimeLeft(0);
            }
            setIsLoading(false);
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="bg-[#1A1A1A] border-white/10 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Conectar WhatsApp: {instanceName}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-6 space-y-4 min-h-[300px]">
                    {isLoading ? (
                        <div className="flex flex-col items-center gap-2">
                            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                            <p className="text-sm text-gray-500">Gerando QR Code...</p>
                        </div>
                    ) : timeLeft > 0 && qrCode ? (
                        <>
                            <div className="relative p-4 bg-white rounded-lg shadow-sm border">
                                <img
                                    src={qrCode.startsWith('data:image') ? qrCode : `data:image/png;base64,${qrCode}`}
                                    alt="QR Code"
                                    className="w-64 h-64 object-contain"
                                />
                            </div>

                            <div className="flex flex-col items-center gap-3 w-full">
                                <div className="flex items-center gap-2 text-amber-600 font-medium bg-amber-50 px-3 py-1 rounded-full">
                                    <Timer className="w-4 h-4" />
                                    <span>Expira em {timeLeft}s</span>
                                </div>

                                <Button
                                    onClick={checkStatus}
                                    disabled={isChecking}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
                                >
                                    {isChecking ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : null}
                                    Já realizei a leitura
                                </Button>
                            </div>

                            <p className="text-sm text-center text-gray-500 max-w-[260px]">
                                Abra o WhatsApp no celular &gt; Aparelhos conectados &gt; Conectar
                            </p>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-4 py-8">
                            <div className="text-center space-y-2">
                                <p className="text-lg font-medium text-gray-900">QR Code Expirado</p>
                                <p className="text-sm text-gray-500">O tempo para conexão acabou. Gere um novo código.</p>
                            </div>
                            <Button onClick={handleReconnect} size="lg" className="gap-2">
                                <RefreshCw className="w-4 h-4" /> Tentar Novamente
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
