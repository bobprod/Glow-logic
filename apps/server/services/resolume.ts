import osc from "osc";
import { getSetting, setSetting } from "./database";
import { addSupportLog } from "./supportLog";

type OscArg = { type: "f" | "i" | "s"; value: number | string };

export type ResolumeAction =
  | "play"
  | "pause"
  | "clip"
  | "column"
  | "layer_opacity"
  | "bpm";

export interface ResolumeConfig {
  enabled: boolean;
  host: string;
  port: number;
  localPort: number;
}

let udpPort: osc.UDPPort | null = null;
let activeKey = "";
let lastActionAt: string | null = null;

function readNumberSetting(key: string, fallback: number) {
  const parsed = Number(getSetting(key));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getResolumeConfig(): ResolumeConfig {
  return {
    enabled: getSetting("resolume_enabled") === "1",
    host: getSetting("resolume_host") || "127.0.0.1",
    port: readNumberSetting("resolume_port", 7000),
    localPort: readNumberSetting("resolume_local_port", 57123),
  };
}

export function setResolumeConfig(input: Partial<ResolumeConfig>) {
  if (input.enabled !== undefined) setSetting("resolume_enabled", input.enabled ? "1" : "0");
  if (input.host !== undefined) setSetting("resolume_host", String(input.host || "127.0.0.1").trim());
  if (input.port !== undefined) setSetting("resolume_port", String(Math.max(1, Math.min(65535, Number(input.port) || 7000))));
  if (input.localPort !== undefined) {
    setSetting("resolume_local_port", String(Math.max(1, Math.min(65535, Number(input.localPort) || 57123))));
  }
  closeResolumePort();
  return getResolumeStatus();
}

function closeResolumePort() {
  try {
    udpPort?.close();
  } catch {
    // The OSC library can throw if the socket is already closing.
  }
  udpPort = null;
  activeKey = "";
}

function getPort() {
  const config = getResolumeConfig();
  if (!config.enabled) return null;

  const key = `${config.host}:${config.port}:${config.localPort}`;
  if (udpPort && activeKey === key) return udpPort;

  closeResolumePort();
  udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: config.localPort,
    remoteAddress: config.host,
    remotePort: config.port,
    metadata: true,
  });
  udpPort.on("ready", () => {
    addSupportLog("RESOLUME", `OSC prêt vers ${config.host}:${config.port}`, "info", { ...config });
  });
  udpPort.on("error", (err: Error) => {
    addSupportLog("RESOLUME", `Erreur OSC Resolume: ${err.message}`, "error", { ...config });
  });
  udpPort.open();
  activeKey = key;
  return udpPort;
}

export function getResolumeStatus() {
  const config = getResolumeConfig();
  return {
    ...config,
    ready: Boolean(udpPort && activeKey === `${config.host}:${config.port}:${config.localPort}`),
    lastActionAt,
    protocol: "OSC",
    notes: "Resolume Arena: Preferences > OSC > OSC Input enabled, port 7000 par défaut.",
  };
}

export function sendResolumeOsc(address: string, args: OscArg[] = []) {
  if (!address.startsWith("/")) throw new Error("Adresse OSC invalide");
  const port = getPort();
  if (!port) {
    return {
      sent: false,
      reason: "Resolume OSC désactivé",
      status: getResolumeStatus(),
    };
  }

  port.send({ address, args });
  lastActionAt = new Date().toISOString();
  addSupportLog("RESOLUME", `OSC ${address}`, "info", { args });
  return {
    sent: true,
    address,
    args,
    status: getResolumeStatus(),
  };
}

export function triggerResolumeAction(action: ResolumeAction, payload: Record<string, unknown> = {}) {
  switch (action) {
    case "play":
      return sendResolumeOsc("/composition/transport/play", [{ type: "f", value: 1 }]);
    case "pause":
      return sendResolumeOsc("/composition/transport/pause", [{ type: "f", value: 1 }]);
    case "clip": {
      const layer = Math.max(1, Math.min(32, Number(payload.layer) || 1));
      const clip = Math.max(1, Math.min(256, Number(payload.clip) || 1));
      return sendResolumeOsc(`/composition/layers/${layer}/clips/${clip}/connect`, [{ type: "f", value: 1 }]);
    }
    case "column": {
      const column = Math.max(1, Math.min(256, Number(payload.column) || 1));
      return sendResolumeOsc(`/composition/columns/${column}/connect`, [{ type: "f", value: 1 }]);
    }
    case "layer_opacity": {
      const layer = Math.max(1, Math.min(32, Number(payload.layer) || 1));
      const value = Math.max(0, Math.min(1, Number(payload.value) || 0));
      return sendResolumeOsc(`/composition/layers/${layer}/video/opacity`, [{ type: "f", value }]);
    }
    case "bpm": {
      const bpm = Math.max(20, Math.min(300, Number(payload.bpm) || 128));
      return sendResolumeOsc("/composition/tempocontroller/tempo", [{ type: "f", value: bpm }]);
    }
    default:
      throw new Error("Action Resolume non supportée");
  }
}
