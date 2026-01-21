import { useEffect, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useDisparadorStore } from "../../store/disparadorStore";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export const QrDialog = () => {
  const {
    qrCode,
    qrInstance,
    qrTimestamp,
    isQrDialogOpen,
    fetchQrCode,
    instances,
    loadInstances,
    syncInstances,
    checkQrInstanceStatus,
    closeQrDialog
  } = useDisparadorStore();

  const [countdown, setCountdown] = useState(120);
  const [isExpired, setIsExpired] = useState(false);

  // Poll for connection status (Simulating Webhook/Realtime)
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (isQrDialogOpen && !isExpired && qrInstance) {
      pollInterval = setInterval(() => {
        // Poll the specific instance status from API -> DB -> UI
        checkQrInstanceStatus(qrInstance);
      }, 2000); // Check every 2 seconds to avoid rate limits
    }
    return () => clearInterval(pollInterval);
  }, [isQrDialogOpen, isExpired, qrInstance, checkQrInstanceStatus]);

  // Handle closing manually
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      closeQrDialog();
    }
  }, [closeQrDialog]);

  // Watch for connection success to auto-close
  useEffect(() => {
    if (isQrDialogOpen && qrInstance) {
      const currentInst = instances.find(i => i.name === qrInstance);
      if (currentInst?.connectionStatus === 'connected' || currentInst?.connectionStatus === 'open') {
        closeQrDialog();
      }
    }
  }, [instances, qrInstance, isQrDialogOpen, closeQrDialog]);

  // Persistent Countdown Logic
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isQrDialogOpen && qrTimestamp) {
      // Update immediately
      const updateTimer = () => {
        const now = Date.now();
        const diff = Math.floor((now - qrTimestamp) / 1000);
        const remaining = 120 - diff;

        if (remaining <= 0) {
          setCountdown(0);
          if (!isExpired) {
            setIsExpired(true);
            syncInstances(true); // Final check (Silent)
          }
        } else {
          setCountdown(remaining);
          setIsExpired(false);
        }
      };

      updateTimer(); // Run once
      interval = setInterval(updateTimer, 1000);
    }
    return () => clearInterval(interval);
  }, [isQrDialogOpen, qrTimestamp, isExpired, syncInstances]);

  return (
    <Dialog open={isQrDialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Conectar Instância: {qrInstance}</DialogTitle>
          <div className="sr-only">
            <DialogDescription>
              Escaneie o QR Code abaixo com o seu WhatsApp para conectar a instância.
              Este código expira em 2 minutos.
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4">
          <p>Leia o QR Code com o seu WhatsApp.</p>

          {/* QR Code Display */}
          <div className="relative flex items-center justify-center w-64 h-64 bg-gray-100 rounded-lg overflow-hidden">
            {qrCode ? (
              <img
                src={qrCode}
                alt="QR Code"
                className={`w-full h-full object-cover transition-opacity duration-300 ${isExpired ? 'opacity-10 blur-sm' : 'opacity-100'}`}
              />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="text-xs text-muted-foreground">Aguardando QR Code ou Conexão...</span>
              </div>
            )}

            {isExpired && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-red-600 font-bold text-lg bg-white/80 px-4 py-2 rounded-md">
                  Expirado
                </span>
              </div>
            )}
          </div>

          {/* Status / Actions */}
          {!isExpired ? (
            <p className="text-yellow-600 font-medium animate-pulse">
              Novo código em {countdown}s
            </p>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <p className="text-red-500 text-sm">O código expirou. Gere um novo.</p>
              <Button onClick={() => fetchQrCode(qrInstance!, true)} variant="destructive">
                Gerar Novo QR Code
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};