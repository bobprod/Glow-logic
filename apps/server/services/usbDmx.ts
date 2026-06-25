import { SerialPort } from "serialport";
import { getSetting } from "./database";

// ============================================================
// USB DMX Service — Glow Logic v2
// Compatible DOREMiDi UTD-10 / UTD-11 (FTDI FT232R USB-DMX)
// Protocol: DMX512 over UART @ 250000 baud, 8N2
// Frame format: [BREAK] + [MAB] + StartCode(0x00) + 512 values
// ============================================================

const DEFAULT_BAUD = 250000;
const DEFAULT_DATA_BITS = 8;
const DEFAULT_STOP_BITS = 2;
const DEFAULT_PARITY = "none";
const FLUSH_INTERVAL_MS = 23; // ~44 Hz
const DMX_CHANNELS = 512;

interface UsbDmxConfig {
  enabled: boolean;
  portPath: string; // e.g. "COM3" or "/dev/ttyUSB0"
  universe: number;
}

class UsbDmxService {
  private port: SerialPort | null = null;
  private buffer = new Uint8Array(DMX_CHANNELS);
  private prevBuffer = new Uint8Array(DMX_CHANNELS);
  private tid: ReturnType<typeof setInterval> | null = null;
  private config: UsbDmxConfig = { enabled: false, portPath: "", universe: 1 };
  private isConnecting = false;
  private isFlushing = false; // guard against overlapping async flushes
  private externalFlush = false;
  private connectionError: string | null = null;

  // -- Configuration ------------------------------------------------
  loadConfig() {
    const enabled = getSetting("usb_dmx_enabled") === "1";
    const portPath = getSetting("usb_dmx_port") || "";
    const universe = parseInt(getSetting("usb_dmx_universe") || "1", 10);
    this.config = { enabled, portPath, universe };

    if (enabled && portPath) {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  updateConfig(enabled: boolean, portPath: string, universe: number) {
    this.config = { enabled, portPath, universe };
    if (enabled && portPath) {
      this.connect();
    } else {
      this.disconnect();
    }
  }

  getConfig(): UsbDmxConfig {
    return { ...this.config };
  }

  getStatus() {
    return {
      connected: this.port?.isOpen ?? false,
      portPath: this.config.portPath,
      error: this.connectionError,
    };
  }

  setExternalFlush(enabled: boolean) {
    this.externalFlush = enabled;
    if (enabled) {
      this.stopFlushLoop();
    } else if (this.port?.isOpen) {
      if (!this.externalFlush) {
        this.startFlushLoop();
      }
    }
  }

  // -- Connection ---------------------------------------------------
  private async connect() {
    if (this.isConnecting || this.port?.isOpen) return;
    if (!this.config.enabled || !this.config.portPath) return;
    this.isConnecting = true;
    this.connectionError = null;

    let serialPort: SerialPort | null = null;
    try {
      serialPort = new SerialPort({
        path: this.config.portPath,
        baudRate: DEFAULT_BAUD,
        dataBits: DEFAULT_DATA_BITS,
        stopBits: DEFAULT_STOP_BITS,
        parity: DEFAULT_PARITY,
        autoOpen: false,
      });

      this.port = serialPort;

      await new Promise<void>((resolve, reject) => {
        serialPort!.open((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Check if we were disabled while the port was opening
      if (!this.config.enabled || !this.config.portPath) {
        console.log(`🔌 [USB-DMX] Fermeture du port ${this.config.portPath} désactivé pendant la connexion`);
        if (serialPort.isOpen) {
          serialPort.close();
        }
        this.port = null;
        this.isConnecting = false;
        return;
      }

      console.log(`🔗 [USB-DMX] Connecté sur ${this.config.portPath} @ ${DEFAULT_BAUD} baud`);

      // Guard: catch any unhandled 'error' events from the native module to prevent process crash
      serialPort.on("error", (err: Error) => {
        console.error(`❌ [USB-DMX] Erreur port série:`, err.message);
        require("./anomalyDetector").addAnomaly("USBDMX", `Erreur port série: ${err.message}`, "error");
        this.connectionError = err.message;
        this.disconnect();
        if (this.config.enabled && this.config.portPath) {
          setTimeout(() => this.connect(), 3000);
        }
      });

      // Auto-reconnect if port closes unexpectedly
      serialPort.on("close", () => {
        if (this.port) {
          console.warn(`⚠️  [USB-DMX] Port fermé inopinément — reconnexion dans 3s`);
          this.port = null;
          this.stopFlushLoop();
          if (this.config.enabled && this.config.portPath) {
            setTimeout(() => this.connect(), 3000);
          }
        }
      });

      this.startFlushLoop();
    } catch (err: any) {
      this.connectionError = String(err);
      console.error(`❌ [USB-DMX] Échec connexion ${this.config.portPath}:`, err);
      require("./anomalyDetector").addAnomaly("USBDMX", `Échec connexion ${this.config.portPath} : ${err.message}`, "error");
      // Retry in 3 seconds if still enabled
      if (this.config.enabled && this.config.portPath) {
        setTimeout(() => this.connect(), 3000);
      }
    } finally {
      this.isConnecting = false;
    }
  }

  private disconnect() {
    this.stopFlushLoop();
    if (this.port) {
      const p = this.port;
      this.port = null;
      if (p.isOpen) {
        p.close((err) => {
          if (err) console.error("❌ [USB-DMX] Erreur fermeture port:", err);
        });
      } else {
        // If not fully open yet, ensure it closes if/when it opens
        p.on("open", () => {
          if (p.isOpen) {
            p.close();
          }
        });
      }
    }
    this.connectionError = null;
    console.log("🔌 [USB-DMX] Déconnecté");
  }

  // -- DMX Buffer ---------------------------------------------------
  setChannel(channel: number, value: number) {
    const ch = Math.max(0, Math.min(DMX_CHANNELS - 1, channel - 1));
    const val = Math.max(0, Math.min(255, value));
    this.buffer[ch] = val;
  }

  getChannel(channel: number): number {
    return this.buffer[Math.max(0, Math.min(DMX_CHANNELS - 1, channel - 1))];
  }

  // -- Flush Loop ---------------------------------------------------
  private startFlushLoop() {
    if (this.tid !== null) return;
    // Use setInterval with isFlushing guard to prevent overlapping async calls
    this.tid = setInterval(async () => {
      if (this.isFlushing) return;
      this.isFlushing = true;
      try { await this.flush(); }
      finally { this.isFlushing = false; }
    }, FLUSH_INTERVAL_MS);
  }

  private stopFlushLoop() {
    if (this.tid !== null) {
      clearInterval(this.tid);
      this.tid = null;
    }
  }

  // ── BREAK + MAB + Frame (required for FT232R / Enttec Open DMX) ─
  async flushNow() {
    if (this.isFlushing) return;
    this.isFlushing = true;
    try {
      await this.flush();
    } finally {
      this.isFlushing = false;
    }
  }

  private async flush() {
    if (!this.port?.isOpen) return;

    // Always send a full frame (force BREAK every cycle for DMX compliance)
    try {
      // 1. Assert BREAK — same as Enttec Open DMX protocol (brk + rts)
      await new Promise<void>((resolve, reject) =>
        this.port!.set({ brk: true, rts: true }, (err) => (err ? reject(err) : resolve()))
      );
      await new Promise((r) => setTimeout(r, 1)); // ≥88µs, use 1ms

      // 2. Release BREAK → Mark After Break
      await new Promise<void>((resolve, reject) =>
        this.port!.set({ brk: false, rts: true }, (err) => (err ? reject(err) : resolve()))
      );
      await new Promise((r) => setTimeout(r, 1)); // ≥12µs MAB

      // 3. Build & send DMX frame: Start Code (0x00) + 512 channels
      const frame = Buffer.alloc(1 + DMX_CHANNELS);
      frame[0] = 0x00; // Start Code
      frame.set(this.buffer, 1);

      await new Promise<void>((resolve, reject) =>
        this.port!.write(frame, (err) => (err ? reject(err) : resolve()))
      );

      // Save snapshot (update tracking)
      this.prevBuffer.set(this.buffer);

    } catch (err: any) {
      console.error("❌ [USB-DMX] Erreur flush:", err);
      require("./anomalyDetector").addAnomaly("USBDMX", `Erreur d'écriture sur le port DMX : ${err.message}`, "error");
      this.connectionError = String(err);
      this.disconnect();
      setTimeout(() => this.connect(), 3000);
    }
  }

  private buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}

export const usbDmx = new UsbDmxService();
