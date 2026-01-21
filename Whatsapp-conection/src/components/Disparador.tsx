"use client";

import { InstanceManager } from "./disparador/InstanceManager";
import { ShooterConfig } from "./disparador/ShooterConfig";

export const Disparador = () => {
  return (
    <div className="space-y-6">
      <InstanceManager />
      <ShooterConfig />
    </div>
  );
};