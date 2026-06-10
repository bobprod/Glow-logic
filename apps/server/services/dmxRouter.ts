import { sendDmxValue } from "./qlc";
import { sendArtNetValue } from "./artnet";
import { usbDmx } from "./usbDmx";
import { qlcWs } from "./qlcWsService";
import { qlcEngine } from "./qlcEngine";
import { pythonDmx } from "./pythonDmx";

// ============================================================
// DMX Router — Unified Output Dispatcher
// Glow Logic v2
//
// Receives a single DMX channel update and dispatches it
// simultaneously to all active outputs:
//   - QLC+ OSC Bridge
//   - Art-Net (network)
//   - USB DMX (FTDI dongle like UTD-10)
// ============================================================

interface OutputConfig {
  qlcOsc: boolean;
  qlcWs: boolean;   // ← QLC+ WebSocket (méthode recommandée pour UTD-10)
  artNet: boolean;
  usbDmx: boolean;
}

class DmxRouter {
  private config: OutputConfig = { qlcOsc: false, qlcWs: false, artNet: true, usbDmx: false };

  // -- Configuration ------------------------------------------------
  loadConfig() {
    // Defaults: QLC+ and Art-Net ON, USB DMX OFF until configured
    this.config.qlcOsc = true;
    this.config.artNet = true;
    this.config.usbDmx = usbDmx.getStatus().connected;
  }

  setOutputs(outputs: Partial<OutputConfig>) {
    this.config = { ...this.config, ...outputs };
  }

  getOutputs(): OutputConfig {
    return { ...this.config };
  }

  // -- Dispatch -----------------------------------------------------
  setChannel(universe: number, channel: number, value: number) {
    const clampedValue = Math.max(0, Math.min(255, Math.round(value)));

    // Python DMX Bridge (primary — uses SetCommBreak Windows API, confirmed working)
    try { pythonDmx.setChannel(universe, channel, clampedValue); } catch {}

    // QLC+ Engine (secondary — disabled until QLC+ is fixed)
    // try { qlcEngine.setChannel(universe, channel, clampedValue); } catch {}

    // QLC+ WebSocket legacy
    if (this.config.qlcWs) {
      try { qlcWs.setChannel(universe, channel, clampedValue); } catch {}
    }

    if (this.config.qlcOsc) {
      try {
        sendDmxValue(universe, channel, clampedValue);
      } catch (err) {
        // QLC+ might not be running — silently fail
      }
    }

    if (this.config.artNet) {
      try {
        sendArtNetValue(universe, channel, clampedValue);
      } catch (err) {
        // Art-Net destination might be offline — silently fail
      }
    }

    if (this.config.usbDmx) {
      try {
        usbDmx.setChannel(channel, clampedValue);
      } catch (err) {
        // USB might be disconnected — silently fail, auto-reconnect handles it
      }
    }
  }

  // Convenience: send RGB triplet
  setRGB(
    universe: number,
    rCh: number,
    gCh: number,
    bCh: number,
    r: number,
    g: number,
    b: number
  ) {
    this.setChannel(universe, rCh, r);
    this.setChannel(universe, gCh, g);
    this.setChannel(universe, bCh, b);
  }

  // Batch update (used for full universe sync)
  setUniverse(universe: number, values: number[]) {
    for (let i = 0; i < Math.min(values.length, 512); i++) {
      this.setChannel(universe, i + 1, values[i]);
    }
  }
}

export const dmxRouter = new DmxRouter();
