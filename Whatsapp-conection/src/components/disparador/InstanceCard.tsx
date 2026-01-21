"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useDisparadorStore } from "../../store/disparadorStore";
import { CheckCircle, XCircle, QrCode } from "lucide-react";

interface Instance {
  name: string;
  connectionStatus: string;
}

interface StatusConfig {
  text: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface InstanceCardProps {
  instance: Instance;
  index: number;
  loadInstances: () => void;
  openWebhook: (name: string) => void;
}

export const InstanceCard = ({ instance, index, loadInstances, openWebhook }: InstanceCardProps) => {
  const { fetchQrCode, disconnectInstance, disconnectingInstance, syncInstances } = useDisparadorStore();
  const isConnected = instance.connectionStatus === "open" || instance.connectionStatus === "connected";

  let statusConfig: StatusConfig;

  if (isConnected) {
    statusConfig = {
      text: "Ativa e Operacional",
      badgeClass: "bg-green-500/10 text-green-700 dark:text-green-300 border border-green-500/20",
      dotClass: "bg-green-500",
      textClass: "text-green-700 dark:text-green-300",
      Icon: CheckCircle,
    };
  } else if (instance.connectionStatus === 'connecting') {
    statusConfig = {
      text: "Conectando...",
      badgeClass: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border border-yellow-500/20",
      dotClass: "bg-yellow-500 animate-pulse",
      textClass: "text-yellow-700 dark:text-yellow-300",
      Icon: React.forwardRef((props, ref) => <i className="fas fa-circle-notch fa-spin text-xs" />), // Simple spin icon
    };
  } else {
    statusConfig = {
      text: "Desconectada",
      badgeClass: "bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/20",
      dotClass: "bg-red-500",
      textClass: "text-red-700 dark:text-red-300",
      Icon: XCircle,
    };
  }

  const formattedName = instance.name
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <Card
      className="rounded-2xl border border-green-400 dark:border-green-500/40 shadow-sm animate-slide-in-up p-5 sm:p-6 transition-all hover:border-primary/50 hover:shadow-lg bg-green-100 dark:bg-green-500/10"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="relative">
            <div className="p-3 rounded-xl bg-green-500/15 border border-green-500/30 shadow-[0_10px_25px_-10px_rgba(16,185,129,0.6)]">
              <QrCode className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full ring-2 ring-card ${statusConfig.dotClass}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg sm:text-xl font-semibold truncate">{formattedName}</h3>
            <div className={`inline-flex items-center gap-2 mt-1 px-2.5 py-1 rounded-full ${statusConfig.badgeClass}`}>
              {React.createElement(statusConfig.Icon, { className: "h-4 w-4" })}
              <span className="text-xs sm:text-sm font-medium">{statusConfig.text}</span>
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => syncInstances()}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Sincronizar Status Real"
        >
          <i className="fas fa-sync-alt text-sm" />
        </Button>
      </div>

      {/* Info strip */}
      <div className="rounded-lg border bg-muted/40 px-3 py-2 mb-4">
        <div className={`flex items-center justify-center gap-2 text-sm font-medium ${statusConfig.textClass}`}>
          {React.createElement(statusConfig.Icon, { className: "h-4 w-4" })}
          <span>{statusConfig.text}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isConnected ? (
          <Button
            onClick={() => {
              if (confirm("Tem certeza que deseja desconectar?")) {
                disconnectInstance(instance.name);
              }
            }}
            disabled={disconnectingInstance === instance.name}
            className="w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
          >
            {disconnectingInstance === instance.name ? (
              <i className="fas fa-spinner fa-spin mr-2" />
            ) : (
              <i className="fas fa-power-off mr-2" />
            )}
            {disconnectingInstance === instance.name ? "Desconectando..." : "Desconectar"}
          </Button>
        ) : instance.connectionStatus === 'connecting' ? (
          <div className="flex gap-2">
            <Button
              onClick={() => fetchQrCode(instance.name)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <i className="fas fa-qrcode mr-2" />
              Ver QR
            </Button>
            <Button
              onClick={() => {
                if (confirm("Forçar desconexão dessa instância?")) {
                  disconnectInstance(instance.name);
                }
              }}
              disabled={disconnectingInstance === instance.name}
              className="flex-1 bg-red-600/90 hover:bg-red-700 text-white disabled:opacity-50 border border-red-200 dark:border-red-900 px-2"
              title="Forçar Desconexão"
            >
              {disconnectingInstance === instance.name ? (
                <i className="fas fa-spinner fa-spin" />
              ) : (
                <i className="fas fa-bolt" />
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={() => fetchQrCode(instance.name)}
            className="w-full"
          >
            <i className="fas fa-qrcode mr-2" />
            Conectar
          </Button>
        )}
        <Button
          onClick={() => openWebhook(instance.name)}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white border border-blue-700/20"
        >
          <i className="fas fa-project-diagram mr-2" />
          Webhook
        </Button>
      </div>
    </Card>
  );
};