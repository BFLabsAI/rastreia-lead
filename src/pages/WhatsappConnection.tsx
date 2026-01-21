import { InstanceManagerV2 as InstanceManager } from '@/components/disparador/InstanceManager';
import { QrCode } from 'lucide-react';

export function WhatsappConnection() {
    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="mb-8">
                <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
                        <QrCode className="text-white h-6 w-6" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Qr Code</h1>
                </div>
                <p className="text-gray-400 ml-16">
                    Gerencie suas instâncias do WhatsApp, conecte novos números e visualize o status da conexão.
                </p>
            </div>

            <div className="bg-[#0A0A0A] rounded-3xl border border-white/5 p-1 shadow-2xl">
                <div className="bg-[#111] rounded-[22px] p-6 min-h-[600px]">
                    <InstanceManager />
                </div>
            </div>
        </div>
    );
}
