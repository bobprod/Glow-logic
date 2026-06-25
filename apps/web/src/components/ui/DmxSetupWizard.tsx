"use client";

import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_BASE } from "../../lib/config";
import useStore from "../../store/useStore";
import {
  X,
  Network,
  Activity,
  Cpu,
  Plug,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Radio,
  Search,
  ArrowRight,
  ArrowLeft,
  Settings
} from "lucide-react";

interface DmxSetupWizardProps {
  onClose: () => void;
  onSuccess: (type: "artnet" | "usb", target: string) => void;
}

interface NetworkAdapter {
  name: string;
  description: string;
  status: "Up" | "Disconnected" | "Down" | "unknown";
  ip: string | null;
}

interface DiscoveredNode {
  ip: string;
  shortName: string;
  longName: string;
  mac: string;
  bindIp: string;
}

interface ComPort {
  path: string;
  manufacturer?: string;
}

function isNetworkAdapter(value: unknown): value is NetworkAdapter {
  if (!value || typeof value !== "object") return false;
  const adapter = value as Record<string, unknown>;
  return typeof adapter.name === "string" && typeof adapter.description === "string";
}

function isDiscoveredNode(value: unknown): value is DiscoveredNode {
  if (!value || typeof value !== "object") return false;
  const node = value as Record<string, unknown>;
  return typeof node.ip === "string" && typeof node.shortName === "string";
}

export default function DmxSetupWizard({ onClose, onSuccess }: DmxSetupWizardProps) {
  const networkState = useStore((state) => state.networkState);
  const setNetworkState = useStore((state) => state.setNetworkState);
  const setDmxOutputs = useStore((state) => state.setDmxOutputs);
  const [step, setStep] = useState<number>(1);
  const [adapters, setAdapters] = useState<NetworkAdapter[]>(() => networkState.adapters.filter(isNetworkAdapter));
  const [selectedAdapter, setSelectedAdapter] = useState<NetworkAdapter | null>(() => (
    isNetworkAdapter(networkState.activeAdapter) ? networkState.activeAdapter : null
  ));
  const [loadingAdapters, setLoadingAdapters] = useState(false);
  
  // IP Config step states
  const [configuringIp, setConfiguringIp] = useState(false);
  const [ipConfigError, setIpConfigError] = useState<string | null>(null);
  const [ipConfigSuccess, setIpConfigSuccess] = useState(false);

  // Discovery step states
  const [searchingNodes, setSearchingNodes] = useState(false);
  const [discoveredNodes, setDiscoveredNodes] = useState<DiscoveredNode[]>(() => networkState.discoveredNodes.filter(isDiscoveredNode));
  const [selectedNode, setSelectedNode] = useState<DiscoveredNode | null>(null);

  // USB/Node step states
  const [outputType, setOutputType] = useState<"node" | "usb">("node");
  const [comPorts, setComPorts] = useState<ComPort[]>([]);
  const [selectedComPort, setSelectedComPort] = useState<string>("");
  const [loadingComPorts, setLoadingComPorts] = useState(false);
  const [diagnosingCom, setDiagnosingCom] = useState(false);
  const [diagnoseReport, setDiagnoseReport] = useState<{ success: boolean; message: string } | null>(null);
  
  // Custom manual IP input fallback
  const [manualIpInput, setManualIpInput] = useState("2.0.0.10");

  const loadAdapters = useCallback(async () => {
    setLoadingAdapters(true);
    try {
      const res = await fetch(`${API_BASE}/api/network/adapters`);
      if (res.ok) {
        const data = await res.json() as NetworkAdapter[];
        setAdapters(data);
        // Auto-select first active or plugged card
        const firstPlugged = data.find((a: NetworkAdapter) => a.status === "Up");
        const activeAdapter = firstPlugged || data[0] || null;
        if (activeAdapter) setSelectedAdapter(activeAdapter);
        setNetworkState({ adapters: data, activeAdapter });
      }
    } catch (err) {
      console.error("Failed to load adapters:", err);
    } finally {
      setLoadingAdapters(false);
    }
  }, [setNetworkState]);

  const handleAutoConfigureIp = async () => {
    if (!selectedAdapter) return;
    setConfiguringIp(true);
    setIpConfigError(null);
    setIpConfigSuccess(false);

    try {
      const res = await fetch(`${API_BASE}/api/network/configure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedAdapter.name,
          ip: "2.0.0.1",
          mask: "255.0.0.0"
        })
      });
      const data = await res.json();
      if (data.success) {
        setIpConfigSuccess(true);
        // Refresh adapters
        await loadAdapters();
        // Update selected adapter object with new IP
        setSelectedAdapter(prev => {
          const updated = prev ? { ...prev, ip: "2.0.0.1" } : null;
          setNetworkState({ activeAdapter: updated });
          return updated;
        });
        // Advance after brief success screen
        setTimeout(() => setStep(4), 1500);
      } else {
        setIpConfigError(data.error || "Configuration refusée par l'administrateur.");
      }
    } catch (err: any) {
      setIpConfigError(err.message || "Erreur de communication.");
    } finally {
      setConfiguringIp(false);
    }
  };

  const handleSearchNodes = useCallback(async () => {
    setSearchingNodes(true);
    setSelectedNode(null);
    try {
      const res = await fetch(`${API_BASE}/api/network/poll`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredNodes(data);
        setNetworkState({ discoveredNodes: data });
        if (data.length > 0) {
          setSelectedNode(data[0]);
        }
      }
    } catch (err) {
      console.error("Discovery error:", err);
    } finally {
      setSearchingNodes(false);
    }
  }, [setNetworkState]);

  const loadComPorts = useCallback(async () => {
    setLoadingComPorts(true);
    try {
      const res = await fetch(`${API_BASE}/api/dmx/ports`);
      if (res.ok) {
        const data = await res.json();
        setComPorts(data);
        if (data.length > 0) {
          setSelectedComPort(data[0].path);
        }
      }
    } catch (err) {
      console.error("COM ports query failed:", err);
    } finally {
      setLoadingComPorts(false);
    }
  }, []);

  // Load adapters when reaching step 2
  useEffect(() => {
    if (step === 2) {
      loadAdapters();
    }
  }, [loadAdapters, step]);

  // Load COM ports and nodes when reaching step 5
  useEffect(() => {
    if (step === 5) {
      loadComPorts();
    }
  }, [loadComPorts, step]);

  const handleDiagnoseUsb = async () => {
    if (!selectedComPort) return;
    setDiagnosingCom(true);
    setDiagnoseReport(null);

    try {
      const res = await fetch(`${API_BASE}/api/network/usb-diagnose?port=${selectedComPort}`);
      if (res.ok) {
        const data = await res.json();
        setDiagnoseReport(data);
      }
    } catch (err: any) {
      setDiagnoseReport({ success: false, message: err.message });
    } finally {
      setDiagnosingCom(false);
    }
  };

  // Run discovery when entering step 4
  useEffect(() => {
    if (step === 4) {
      handleSearchNodes();
    }
  }, [handleSearchNodes, step]);

  const handleFinalApply = async () => {
    try {
      if (outputType === "node") {
        // Save target IP
        const targetIp = selectedNode?.ip || manualIpInput;
        await fetch(`${API_BASE}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qlc_host: targetIp })
        });
        
        // Update DMX router outputs
        await fetch(`${API_BASE}/api/dmx/router`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artNet: true, usbDmx: false })
        });
        setDmxOutputs({ artNet: true, usbDmx: false });

        onSuccess("artnet", targetIp);
      } else {
        // Apply USB COM port configs
        await fetch(`${API_BASE}/api/dmx/usb-config`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enabled: true,
            portPath: selectedComPort,
            universe: 1
          })
        });

        // Update settings in database
        await fetch(`${API_BASE}/api/settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            usb_dmx_enabled: "1",
            usb_dmx_port: selectedComPort,
            usb_dmx_universe: "1"
          })
        });

        onSuccess("usb", selectedComPort);
        setDmxOutputs({ artNet: false, usbDmx: true });
      }
      onClose();
    } catch (err) {
      console.error("Failed to finalize wizard:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 font-sans text-slate-200">
      <div className="relative w-full max-w-lg bg-[#111318] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
        
        {/* HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0 bg-black/20">
          <div>
            <h2 className="text-white text-md font-bold flex items-center gap-2">
              <Settings className="w-4 h-4 text-cyan-400" />
              Configuration Node DMX
            </h2>
            <p className="text-[10px] text-slate-400 mt-0.5">Assistant de configuration matériel</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* STEPPER PROGRESS BAR */}
        <div className="px-6 py-3 bg-black/10 flex items-center justify-between shrink-0 border-b border-white/5">
          {[
            { id: 1, label: "Câbles" },
            { id: 2, label: "Carte réseau" },
            { id: 3, label: "Adresse IP" },
            { id: 4, label: "Connexion" },
            { id: 5, label: "Sortie DMX" }
          ].map((s) => (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all ${
                    step >= s.id
                      ? "bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                      : "bg-[#181b21] text-slate-500 border-white/10"
                  }`}
                >
                  {s.id}
                </div>
                <span
                  className={`text-[8px] mt-1 font-semibold truncate max-w-[65px] ${
                    step === s.id ? "text-cyan-400 font-black" : "text-slate-500"
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {s.id < 5 && (
                <div
                  className={`flex-1 h-0.5 mx-1 rounded transition-all ${
                    step > s.id ? "bg-cyan-500/60" : "bg-white/5"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* CONTENT VIEWPORT */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.15 }}
              className="flex-1 flex flex-col"
            >
              
              {/* STEP 1: CABLES CONNECTION */}
              {step === 1 && (
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  <div className="text-center mb-2">
                    <h3 className="text-white text-sm font-bold">Branchons le boîtier</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Vérifiez que les 2 connexions sont bien faites</p>
                  </div>
                  <div className="grid gap-3">
                    <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 flex items-start gap-4 hover:border-cyan-500/20 transition-colors group relative overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-cyan-500" />
                      <div className="p-2.5 bg-cyan-500/10 rounded-xl text-cyan-400 shrink-0">
                        <Plug className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-white text-xs font-bold leading-tight">Câble RJ45 (Ethernet)</h4>
                        <p className="text-[10px] text-slate-500 mt-1">Entre le boîtier et l'ordinateur — données DMX</p>
                      </div>
                    </div>

                    <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 flex items-start gap-4 hover:border-rose-500/20 transition-colors group relative overflow-hidden">
                      <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500" />
                      <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
                        <Activity className="w-5 h-5 animate-pulse" />
                      </div>
                      <div>
                        <h4 className="text-white text-xs font-bold leading-tight">Alimentation</h4>
                        <p className="text-[10px] text-slate-500 mt-1">Port USB carré (USB-B) ou USB Type-C selon le modèle</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: NETWORK ADAPTER SELECT */}
              {step === 2 && (
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  <div className="text-center mb-2">
                    <h3 className="text-white text-sm font-bold">Quelle carte réseau ?</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Choisissez la carte RJ45 reliée au boîtier (pas la Wi-Fi)</p>
                  </div>

                  {loadingAdapters ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <RefreshCw className="w-6 h-6 text-cyan-400 animate-spin" />
                      <span className="text-xs text-slate-500">Chargement des interfaces...</span>
                    </div>
                  ) : (
                    <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1">
                      {adapters.map((adapter) => {
                        const isSelected = selectedAdapter?.name === adapter.name;
                        return (
                          <div
                            key={adapter.name}
                            onClick={() => {
                              setSelectedAdapter(adapter);
                              setNetworkState({ activeAdapter: adapter });
                            }}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                                : "bg-[#181b21] border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Network className={`w-4 h-4 ${isSelected ? "text-cyan-400" : "text-slate-500"}`} />
                              <div className="text-left">
                                <h4 className="text-white text-[11px] font-bold leading-tight truncate max-w-[220px]">
                                  {adapter.name}
                                </h4>
                                <p className="text-[9px] text-slate-500 mt-0.5 truncate max-w-[220px]">
                                  {adapter.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {adapter.status === "Up" ? (
                                <span className="text-[8px] bg-green-500/10 border border-green-500/20 text-green-400 px-1.5 py-0.5 rounded-full font-bold">
                                  Câble branché
                                </span>
                              ) : (
                                <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full font-bold">
                                  Câble débranché
                                </span>
                              )}
                              <span className="text-[9px] font-mono text-slate-400">{adapter.ip || "Pas d'IP"}</span>
                            </div>
                          </div>
                        );
                      })}
                      {adapters.length === 0 && (
                        <p className="text-center text-xs text-slate-500 py-8">Aucune carte réseau détectée.</p>
                      )}
                    </div>
                  )}

                  <button
                    onClick={loadAdapters}
                    className="flex items-center gap-1.5 text-[9px] text-slate-500 hover:text-cyan-400 transition-colors mx-auto"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Actualiser la liste
                  </button>
                </div>
              )}

              {/* STEP 3: IP CONFIG */}
              {step === 3 && (
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  <div className="text-center mb-1">
                    <h3 className="text-white text-sm font-bold">Configuration IP</h3>
                    <p className="text-[11px] text-slate-400 mt-1">L'adaptateur doit être configuré sur la plage Art-Net</p>
                  </div>

                  <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                      <span className="text-slate-500">Carte sélectionnée :</span>
                      <span className="text-white font-bold max-w-[200px] truncate">{selectedAdapter?.name || "?"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">IP actuelle :</span>
                      <span className="text-slate-300 font-mono">{selectedAdapter?.ip || "Non configuré"}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">IP cible (Art-Net) :</span>
                      <span className="text-cyan-400 font-mono font-bold">2.0.0.1 / 255.0.0.0</span>
                    </div>
                  </div>

                  {ipConfigError && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] p-3 rounded-xl flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">Échec de configuration</p>
                        <p className="mt-0.5 opacity-90">{ipConfigError}</p>
                      </div>
                    </div>
                  )}

                  {ipConfigSuccess && (
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs p-3 rounded-xl flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Adresse IP configurée avec succès !</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <button
                      onClick={handleAutoConfigureIp}
                      disabled={configuringIp || ipConfigSuccess}
                      className="w-full flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black text-xs font-bold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                    >
                      {configuringIp ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Configuration en cours (Autorisez l'UAC)...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          Configurer automatiquement ✓
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setStep(4)}
                      disabled={configuringIp}
                      className="w-full py-2.5 bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 rounded-xl text-slate-400 hover:text-white text-[11px] font-bold transition-all"
                    >
                      Je configure moi-même (Suivant)
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mx-auto max-w-[340px] text-center mt-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <span>Droits administrateur requis pour la configuration automatique.</span>
                  </div>
                </div>
              )}

              {/* STEP 4: DISCOVERY / SEARCH */}
              {step === 4 && (
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  <div className="text-center mb-1">
                    <h3 className="text-white text-sm font-bold">Recherche du boîtier DMX</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Scanne le réseau local pour découvrir l'interface DMX</p>
                  </div>

                  <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden">
                    {searchingNodes ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative flex items-center justify-center w-12 h-12">
                          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                          <Search className="w-5 h-5 text-cyan-400 animate-pulse" />
                        </div>
                        <div className="text-center">
                          <p className="text-white text-xs font-bold">Recherche en cours...</p>
                          <p className="text-[9px] font-mono text-slate-500 mt-1">Envoi ArtPoll sur 2.0.0.255...</p>
                        </div>
                      </div>
                    ) : discoveredNodes.length > 0 ? (
                      <div className="w-full space-y-2 max-h-[160px] overflow-y-auto pr-1">
                        <p className="text-[9px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mb-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {discoveredNodes.length} boîtier(s) détecté(s)
                        </p>
                        {discoveredNodes.map((node) => {
                          const isSelected = selectedNode?.ip === node.ip;
                          return (
                            <div
                              key={node.ip}
                              onClick={() => setSelectedNode(node)}
                              className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between text-left ${
                                isSelected
                                  ? "bg-cyan-500/10 border-cyan-500"
                                  : "bg-black/20 border-white/5 hover:border-white/10"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                                <div>
                                  <h4 className="text-white text-[10px] font-bold truncate max-w-[200px]">
                                    {node.shortName}
                                  </h4>
                                  <p className="text-[9px] text-slate-500 max-w-[200px] truncate">{node.longName}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-mono font-bold text-cyan-400">{node.ip}</p>
                                <p className="text-[8px] font-mono text-slate-600 mt-0.5">{node.mac}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center space-y-2 py-6">
                        <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                        <div>
                          <p className="text-slate-400 text-xs font-bold">Aucun boîtier Art-Net détecté</p>
                          <p className="text-[9px] text-slate-600 mt-1 max-w-[260px] mx-auto">
                            Assurez-vous que le boîtier est branché, allumé, et que votre ordinateur a bien une adresse IP en 2.x.x.x.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleSearchNodes}
                      disabled={searchingNodes}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-white/5 border border-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${searchingNodes ? "animate-spin" : ""}`} />
                      Réessayer
                    </button>
                    <button
                      onClick={() => setStep(5)}
                      disabled={searchingNodes}
                      className="flex-1 flex items-center justify-center gap-1 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black rounded-xl text-xs font-bold transition-all"
                    >
                      Suivant
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 5: OUTPUT / USB SETUP */}
              {step === 5 && (
                <div className="flex-1 flex flex-col justify-center space-y-4">
                  <div className="text-center mb-1">
                    <h3 className="text-white text-sm font-bold">Paramétrer la sortie DMX</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Sélectionnez le mode de sortie et appliquez</p>
                  </div>

                  {/* Node vs USB Toggle */}
                  <div className="bg-black/40 border border-white/5 rounded-2xl p-1 flex gap-1 shrink-0">
                    <button
                      onClick={() => setOutputType("node")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        outputType === "node"
                          ? "bg-[#181b21] text-cyan-400 border border-white/5 shadow-md"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Sortie Node
                    </button>
                    <button
                      onClick={() => setOutputType("usb")}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        outputType === "usb"
                          ? "bg-[#181b21] text-cyan-400 border border-white/5 shadow-md"
                          : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      <Plug className="w-3.5 h-3.5" />
                      Sortie DMX USB
                    </button>
                  </div>

                  {outputType === "node" ? (
                    <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 space-y-3 text-left">
                      <p className="text-[9px] text-cyan-400 font-bold uppercase tracking-wider">Configuration Node (Art-Net)</p>
                      
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-500 font-semibold block">Adresse IP de destination</label>
                        {selectedNode ? (
                          <div className="bg-black/30 border border-cyan-500/20 rounded-xl px-3.5 py-2 text-xs text-white flex items-center justify-between">
                            <span className="font-bold">{selectedNode.shortName}</span>
                            <span className="font-mono text-cyan-400">{selectedNode.ip}</span>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={manualIpInput}
                              onChange={(e) => setManualIpInput(e.target.value)}
                              placeholder="2.0.0.10"
                              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500/60"
                            />
                            <button
                              onClick={handleSearchNodes}
                              className="px-3 bg-white/5 border border-white/10 rounded-xl text-[10px] text-slate-300 hover:text-white"
                            >
                              Détecter
                            </button>
                          </div>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-600 leading-normal">
                        Les paquets DMX seront envoyés en Art-Net vers l'adresse IP spécifiée ci-dessus (port standard 6454).
                      </p>
                    </div>
                  ) : (
                    <div className="bg-[#181b21] border border-white/5 rounded-2xl p-4 space-y-3 text-left">
                      <p className="text-[9px] text-purple-400 font-bold uppercase tracking-wider">Configuration USB DMX</p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-semibold block">Protocole</label>
                          <select className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white focus:outline-none">
                            <option>ENTTEC Open DMX USB</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-500 font-semibold block">Port COM</label>
                          <div className="flex gap-1.5">
                            <select
                              value={selectedComPort}
                              onChange={(e) => setSelectedComPort(e.target.value)}
                              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-2.5 py-2 text-[10px] text-white focus:outline-none focus:border-cyan-500/40"
                            >
                              <option value="">Sélectionner COM</option>
                              {comPorts.map((p) => (
                                <option key={p.path} value={p.path}>
                                  {p.path} {p.manufacturer ? `(${p.manufacturer})` : ""}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={loadComPorts}
                              className="p-2 bg-white/5 border border-white/10 rounded-xl text-slate-400 hover:text-white"
                              title="Rafraîchir"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${loadingComPorts ? "animate-spin" : ""}`} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-white/5 pt-2 flex-wrap gap-2">
                        <button
                          onClick={handleDiagnoseUsb}
                          disabled={!selectedComPort || diagnosingCom}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/20 rounded-xl text-[10px] font-bold font-sans transition-all disabled:opacity-40"
                        >
                          <Cpu className="w-3.5 h-3.5" />
                          Diagnostic COM
                        </button>

                        {diagnosingCom && <span className="text-[9px] text-slate-500">Ouverture de port...</span>}

                        {diagnoseReport && (
                          <div
                            className={`text-[9px] font-mono leading-normal w-full p-2 rounded-lg ${
                              diagnoseReport.success
                                ? "bg-green-500/10 text-green-400 border border-green-500/20"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {diagnoseReport.message}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="px-6 py-4 border-t border-white/5 bg-black/20 flex items-center justify-between shrink-0">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1 px-4 py-2 border border-white/5 hover:bg-white/5 hover:border-white/10 rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>
          
          {step < 5 ? (
            <button
              onClick={() => setStep((s) => Math.min(5, s + 1))}
              disabled={step === 2 && !selectedAdapter}
              className="flex items-center gap-1 px-5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black rounded-xl text-xs font-bold transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)]"
            >
              Continuer →
            </button>
          ) : (
            <button
              onClick={handleFinalApply}
              disabled={outputType === "usb" && !selectedComPort}
              className="flex items-center gap-1.5 px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-black rounded-xl text-xs font-bold transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Appliquer les réglages
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
