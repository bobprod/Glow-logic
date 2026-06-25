import { addSupportLog } from "./supportLog";
import { pythonDmx } from "./pythonDmx";
import { qlcWs } from "./qlcWsService";
import { usbDmx } from "./usbDmx";

export type OutputId = "python" | "qlcOsc" | "qlcWs" | "artNet" | "usbDmx" | "sacn";
export type OutputHealthState = "ok" | "degraded" | "error" | "off";

export interface OutputState {
  enabled: boolean;
  state: OutputHealthState;
  lastOkAt: number | null;
  lastErrorAt: number | null;
  lastErrorMessage: string | null;
  errorCount: number;
}

export interface OutputHealthSnapshot {
  outputs: Record<OutputId, OutputState>;
  at: number;
}

export interface OutputConfig {
  qlcOsc: boolean;
  qlcWs: boolean;
  artNet: boolean;
  usbDmx: boolean;
  python: boolean;
  sacn: boolean;
}

const OUTPUT_IDS: OutputId[] = ["python", "qlcOsc", "qlcWs", "artNet", "usbDmx", "sacn"];
const ERROR_WINDOW_MS = 5000;
const DEGRADED_WINDOW_MS = 30000;
const LOG_THROTTLE_MS = 5000;

type RawOutputState = Omit<OutputState, "enabled" | "state"> & {
  lastLoggedAt: number | null;
};

function emptyRawState(): RawOutputState {
  return {
    lastOkAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    errorCount: 0,
    lastLoggedAt: null,
  };
}

function getErrorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

class OutputHealth {
  private raw: Record<OutputId, RawOutputState> = {
    python: emptyRawState(),
    qlcOsc: emptyRawState(),
    qlcWs: emptyRawState(),
    artNet: emptyRawState(),
    usbDmx: emptyRawState(),
    sacn: emptyRawState(),
  };
  private listeners = new Set<() => void>();
  private notifyTimer: ReturnType<typeof setTimeout> | null = null;

  reportOk(id: OutputId): void {
    const output = this.raw[id];
    const hadUnrecoveredError = output.lastErrorAt !== null && (output.lastOkAt ?? 0) <= output.lastErrorAt;
    output.lastOkAt = Date.now();
    if (hadUnrecoveredError) this.scheduleNotify();
  }

  reportError(id: OutputId, err: unknown): void {
    const output = this.raw[id];
    const now = Date.now();
    const message = getErrorMessage(err);
    output.lastErrorAt = now;
    output.lastErrorMessage = message;
    output.errorCount += 1;

    if (!output.lastLoggedAt || now - output.lastLoggedAt >= LOG_THROTTLE_MS) {
      output.lastLoggedAt = now;
      addSupportLog("DMX_OUTPUT", `Sortie ${id} en erreur : ${message}`, "error", { outputId: id });
    }
    this.scheduleNotify();
  }

  reportConfigChange(): void {
    this.scheduleNotify();
  }

  getSnapshot(config: OutputConfig): OutputHealthSnapshot {
    const now = Date.now();
    const usbStatus = usbDmx.getStatus();
    const pythonStatus = pythonDmx.getStatus();
    const qlcWsStatus = qlcWs.getStatus();

    return {
      at: now,
      outputs: Object.fromEntries(
        OUTPUT_IDS.map((id) => {
          const raw = this.raw[id];
          const enabled = this.isEnabled(id, config);
          let state: OutputHealthState = "ok";
          let errorMessage = raw.lastErrorMessage;
          const recentError = raw.lastErrorAt !== null && now - raw.lastErrorAt <= ERROR_WINDOW_MS;

          if (!enabled) {
            state = "off";
          } else if (recentError) {
            state = "error";
          } else if (id === "python" && !pythonStatus.ready) {
            state = "error";
            errorMessage = "Bridge Python non pret";
          } else if (id === "qlcWs" && !qlcWsStatus.running) {
            state = "error";
            errorMessage = "QLC+ WebSocket deconnecte";
          } else if (id === "usbDmx" && !usbStatus.connected) {
            state = "error";
            errorMessage = usbStatus.error || "USB DMX deconnecte";
          } else if (
            raw.lastErrorAt !== null &&
            raw.lastOkAt !== null &&
            raw.lastOkAt > raw.lastErrorAt &&
            now - raw.lastErrorAt <= DEGRADED_WINDOW_MS
          ) {
            state = "degraded";
          }

          const output: OutputState = {
            enabled,
            state,
            lastOkAt: raw.lastOkAt,
            lastErrorAt: raw.lastErrorAt,
            lastErrorMessage: errorMessage,
            errorCount: raw.errorCount,
          };
          return [id, output];
        }),
      ) as Record<OutputId, OutputState>,
    };
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private isEnabled(id: OutputId, config: OutputConfig) {
    if (id === "python") return config.python;
    if (id === "usbDmx") return config.usbDmx;
    return config[id];
  }

  private scheduleNotify() {
    if (this.notifyTimer) return;
    this.notifyTimer = setTimeout(() => {
      this.notifyTimer = null;
      this.listeners.forEach((listener) => listener());
    }, 250);
    this.notifyTimer.unref?.();
  }
}

export const outputHealth = new OutputHealth();
