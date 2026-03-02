import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useDisparadorStore } from '@/store/disparadorStore';
import { useClient } from '@/contexts/ClientContext';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Upload, Info, Key, Server } from 'lucide-react';
import { toast } from 'sonner';

interface ImportInstanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ImportInstanceDialog({ isOpen, onClose }: ImportInstanceDialogProps) {
    const { importInstance } = useDisparadorStore();
    const { selectedClient } = useClient();
    const [instanceName, setInstanceName] = useState('');
    const [instanceToken, setInstanceToken] = useState('');
    const [isImporting, setIsImporting] = useState(false);

    const handleImport = async () => {
        if (!instanceName.trim()) {
            toast.error("Nome da instância é obrigatório");
            return;
        }
        if (!instanceToken.trim()) {
            toast.error("Token da instância é obrigatório");
            return;
        }
        if (!selectedClient?.id) {
            toast.error("Nenhum cliente selecionado");
            return;
        }

        setIsImporting(true);
        const success = await importInstance(instanceName.trim(), instanceToken.trim(), selectedClient.id);
        setIsImporting(false);

        if (success) {
            setInstanceName('');
            setInstanceToken('');
            onClose();
        }
    };

    const handleClose = () => {
        if (!isImporting) {
            setInstanceName('');
            setInstanceToken('');
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="bg-[#1A1A1A] border-white/10 text-white sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Upload className="w-5 h-5 text-indigo-400" />
                        Importar Instância Existente
                    </DialogTitle>
                    <DialogDescription className="text-gray-400">
                        Importe uma instância que já está conectada em outro sistema (ex: agente de IA).
                        O LeadHub receberá os leads via webhook sem desconectar a outra conexão.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Instance Name */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Server className="w-4 h-4 text-gray-500" />
                            Nome da Instância *
                        </label>
                        <Input
                            placeholder="Ex: IA_ODONTO_SOLLUT"
                            value={instanceName}
                            onChange={(e) => setInstanceName(e.target.value)}
                            className="bg-[#0A0A0A] border-white/10 text-white placeholder:text-gray-600"
                            disabled={isImporting}
                        />
                        <p className="text-xs text-gray-500">
                            O nome exato da instância como está na UazAPI
                        </p>
                    </div>

                    {/* Instance Token */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Key className="w-4 h-4 text-gray-500" />
                            API Key / Token da Instância *
                        </label>
                        <Input
                            type="password"
                            placeholder="Cole o token da instância aqui"
                            value={instanceToken}
                            onChange={(e) => setInstanceToken(e.target.value)}
                            className="bg-[#0A0A0A] border-white/10 text-white placeholder:text-gray-600 font-mono"
                            disabled={isImporting}
                        />
                        <p className="text-xs text-gray-500">
                            O token pode ser encontrado na UazAPI em Configurações → Instâncias
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                        <div className="flex gap-3">
                            <Info className="w-5 h-5 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-gray-300 space-y-2">
                                <p>
                                    <strong className="text-white">Como funciona:</strong>
                                </p>
                                <ul className="list-disc list-inside space-y-1 text-gray-400">
                                    <li>A instância continuará conectada ao seu sistema atual</li>
                                    <li>O LeadHub apenas receberá cópias das mensagens via webhook</li>
                                    <li>Não será gerado QR code</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isImporting}
                        className="text-gray-400 hover:text-white"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleImport}
                        disabled={isImporting || !instanceName.trim() || !instanceToken.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[120px]"
                    >
                        {isImporting ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Importando...
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 mr-2" />
                                Importar
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
