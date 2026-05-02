"use client";

import React from "react";
import { Wifi, WifiOff } from "lucide-react";

interface ConnectionStatusProps {
  connected: boolean;
  label?: string;
}

export function ConnectionStatus({ connected, label = "Connexion" }: ConnectionStatusProps) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500 font-bold uppercase tracking-widest">{label}</span>
      {connected ? (
        <span className="text-green-400 font-bold flex items-center gap-1">
          <Wifi className="w-3.5 h-3.5" /> Connecté
        </span>
      ) : (
        <span className="text-red-400 font-bold flex items-center gap-1">
          <WifiOff className="w-3.5 h-3.5" /> Hors ligne
        </span>
      )}
    </div>
  );
}
