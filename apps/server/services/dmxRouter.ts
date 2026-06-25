import { sendDmxValue } from "./qlc";
import { sendArtNetUniverse } from "./artnet";
import { usbDmx } from "./usbDmx";
import { qlcWs } from "./qlcWsService";
import { pythonDmx } from "./pythonDmx";
import { outputHealth } from "./outputHealth";
import { getFixtures, getSetting, setSetting, type FixtureListing } from "./database";
import { getSafetyState } from "./safetyGate";
import { addSupportLog } from "./supportLog";
import { parsePatch, serializePatch, resolvePatch, type PatchMap } from "./patchTable";

const DMX_CHANNELS = 512;
const FLUSH_INTERVAL_MS = 25; // ~40 Hz central batching clock.

interface OutputConfig {
  qlcOsc: boolean;
  qlcWs: boolean;
  artNet: boolean;
  usbDmx: boolean;
  python: boolean;
}

type OutputId = keyof OutputConfig;

class DmxRouter {
  private config: OutputConfig = { qlcOsc: false, qlcWs: false, artNet: true, usbDmx: false, python: false };
  private universes = new Map<number, Uint8Array>();
  private pendingUniverses = new Map<number, Uint8Array>();
  private dirtyChannels = new Map<number, Set<number>>();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dangerousChannelCache: { expiresAt: number; channels: Set<string> } = { expiresAt: 0, channels: new Set() };
  private lastDangerousClampLogAt = 0;
  private lastSerialConflictLogAt = 0;
  private patchMap: PatchMap = new Map();

  constructor() {
    usbDmx.setExternalFlush?.(true);
    this.startFlushLoop();
  }

  loadConfig() {
    this.config.qlcOsc = true;
    this.config.artNet = true;
    this.config.usbDmx = usbDmx.getStatus().connected;
    this.config.python = usbDmx.getStatus().connected;
    this.warnOnSerialConflict();
    this.setPatchFromSetting();
    outputHealth.reportConfigChange();
  }

  // ── Patch table (re-patch logique→physique, univers 1 uniquement) ──
  // Table vide / canal non patché => 1:1 (comportement actuel inchangé).
  private setPatchFromSetting() {
    try {
      const spec = getSetting("patch_table");
      this.patchMap = spec ? parsePatch(spec) : new Map();
    } catch (err) {
      this.patchMap = new Map();
      addSupportLog("DMX", "Erreur chargement patch_table", "warning", { error: String(err) });
    }
  }

  setPatch(spec: string): void {
    this.patchMap = parsePatch(spec);
    setSetting("patch_table", spec);
  }

  getPatchSpec(): string {
    return serializePatch(this.patchMap);
  }

  setOutputs(outputs: Partial<OutputConfig>) {
    this.config = { ...this.config, ...outputs };
    this.warnOnSerialConflict();
    outputHealth.reportConfigChange();
  }

  // Bridge Python et USB DMX direct visent le meme port COM : un seul peut le tenir.
  private warnOnSerialConflict() {
    if (!this.config.python || !this.config.usbDmx) return;
    const now = Date.now();
    if (now - this.lastSerialConflictLogAt < 60_000) return;
    this.lastSerialConflictLogAt = now;
    addSupportLog("DMX", "Bridge Python et USB DMX actifs simultanement - conflit de port COM possible, desactivez l'un des deux", "warning", {
      python: this.config.python,
      usbDmx: this.config.usbDmx,
    });
  }

  getOutputs(): OutputConfig {
    return { ...this.config };
  }

  getLiveUniverse(universe: number): Record<number, number> {
    const buffer = this.universes.get(universe);
    const channels: Record<number, number> = {};
    if (!buffer) return channels;
    for (let index = 0; index < buffer.length; index += 1) {
      const value = buffer[index];
      if (value > 0) channels[index + 1] = value;
    }
    return channels;
  }

  private startFlushLoop() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => {
      this.flushDirtyUniverses();
    }, FLUSH_INTERVAL_MS);
    this.flushTimer.unref?.();
  }

  private getUniverseBuffer(universe: number) {
    let buffer = this.universes.get(universe);
    if (!buffer) {
      buffer = new Uint8Array(DMX_CHANNELS);
      this.universes.set(universe, buffer);
    }
    return buffer;
  }

  private getPendingUniverse(universe: number) {
    let pending = this.pendingUniverses.get(universe);
    if (!pending) {
      pending = new Uint8Array(this.getUniverseBuffer(universe));
      this.pendingUniverses.set(universe, pending);
    }
    return pending;
  }

  private markDirty(universe: number, channelIndex: number) {
    let channels = this.dirtyChannels.get(universe);
    if (!channels) {
      channels = new Set<number>();
      this.dirtyChannels.set(universe, channels);
    }
    channels.add(channelIndex);
  }

  private isDangerousFixture(fixture: FixtureListing) {
    const fixtureText = `${fixture.name || ""} ${fixture.manufacturer || ""}`.toLowerCase();
    if (/\b(laser|pyro|flame|firework)\b/.test(fixtureText)) return true;
    return fixture.channels.some((channel) => {
      const channelText = `${channel.type || ""} ${channel.function || ""} ${channel.notes || ""}`.toLowerCase();
      return /\b(laser|pyro|flame|firework)\b/.test(channelText);
    });
  }

  private getDangerousChannels() {
    const now = Date.now();
    if (this.dangerousChannelCache.expiresAt > now) return this.dangerousChannelCache.channels;
    const channels = new Set<string>();
    for (const fixture of getFixtures()) {
      if (!this.isDangerousFixture(fixture)) continue;
      const start = fixture.start_address || 1;
      const total = Math.max(
        Number(fixture.total_channels || 0),
        ...fixture.channels.map((channel) => Number(channel.channel || 0)),
      );
      for (let offset = 0; offset < total; offset += 1) {
        channels.add(`1:${start + offset}`);
      }
    }
    this.dangerousChannelCache = { expiresAt: now + 1000, channels };
    return channels;
  }

  private enforceDangerousChannel(universe: number, channel: number, value: number) {
    if (getSafetyState().dangerousPhysicalOutputsEnabled) return value;
    if (!this.getDangerousChannels().has(`${universe}:${channel}`)) return value;
    const now = Date.now();
    if (value > 0 && now - this.lastDangerousClampLogAt > 5000) {
      this.lastDangerousClampLogAt = now;
      addSupportLog("SAFETY", "DMX dangereux clamp a 0 par le routeur", "warning", {
        universe,
        channel,
        requestedValue: value,
      });
    }
    return 0;
  }

  // Application sur un canal PHYSIQUE : clamp + securite (canal physique) + buffer + dirty.
  private applyPhysical(universe: number, physChannel: number, value: number) {
    const safeChannel = Math.max(1, Math.min(DMX_CHANNELS, Math.round(physChannel)));
    const clampedValue = this.enforceDangerousChannel(
      universe,
      safeChannel,
      Math.max(0, Math.min(255, Math.round(value))),
    );

    const channelIndex = safeChannel - 1;
    const pending = this.getPendingUniverse(universe);
    pending[channelIndex] = clampedValue;
    this.markDirty(universe, channelIndex);
  }

  setChannel(universe: number, channel: number, value: number) {
    const safeUniverse = Math.max(1, Math.round(universe));
    const safeChannel = Math.max(1, Math.min(DMX_CHANNELS, Math.round(channel)));

    // Univers 1 + table non vide => remap logique -> physique(s) (la securite s'applique
    // sur chaque canal PHYSIQUE). Sinon (autre univers OU table vide) => 1:1 inchange.
    if (safeUniverse === 1 && this.patchMap.size > 0) {
      const physChannels = resolvePatch(this.patchMap, safeChannel);
      for (const physChannel of physChannels) {
        this.applyPhysical(1, physChannel, value);
      }
      return;
    }

    this.applyPhysical(safeUniverse, safeChannel, value);
  }

  private reportOutput(output: OutputId, action: () => void) {
    try {
      action();
      outputHealth.reportOk(output);
    } catch (err) {
      outputHealth.reportError(output, err);
    }
  }

  private flushDirtyUniverses() {
    if (this.dirtyChannels.size === 0) return;
    const dirty = new Map(this.dirtyChannels);
    this.dirtyChannels.clear();

    for (const [universe, channelIndexes] of dirty) {
      const pending = this.pendingUniverses.get(universe);
      if (!pending) continue;
      const committed = this.getUniverseBuffer(universe);
      const changedChannels = [...channelIndexes].filter((channelIndex) => pending[channelIndex] !== committed[channelIndex]);
      if (changedChannels.length === 0) continue;

      for (const channelIndex of changedChannels) {
        const channel = channelIndex + 1;
        const value = pending[channelIndex];

        if (this.config.python) {
          this.reportOutput("python", () => pythonDmx.setChannel(universe, channel, value));
        }

        if (this.config.qlcWs) {
          this.reportOutput("qlcWs", () => qlcWs.setChannel(universe, channel, value));
        }

        if (this.config.qlcOsc) {
          this.reportOutput("qlcOsc", () => sendDmxValue(universe, channel, value));
        }

        if (this.config.usbDmx) {
          this.reportOutput("usbDmx", () => usbDmx.setChannel(channel, value));
        }

        committed[channelIndex] = value;
      }

      // Art-Net : un seul paquet ArtDmx par univers dirty et par frame
      // (et non un paquet complet par canal modifié — fix anti-flood réseau).
      if (this.config.artNet) {
        this.reportOutput("artNet", () => sendArtNetUniverse(universe, committed));
      }

      if (this.config.usbDmx) {
        void usbDmx.flushNow?.();
      }
    }
  }

  flushNow() {
    this.flushDirtyUniverses();
  }

  setRGB(
    universe: number,
    rCh: number,
    gCh: number,
    bCh: number,
    r: number,
    g: number,
    b: number,
  ) {
    this.setChannel(universe, rCh, r);
    this.setChannel(universe, gCh, g);
    this.setChannel(universe, bCh, b);
  }

  setUniverse(universe: number, values: number[]) {
    for (let i = 0; i < Math.min(values.length, DMX_CHANNELS); i += 1) {
      this.setChannel(universe, i + 1, values[i]);
    }
  }
}

export const dmxRouter = new DmxRouter();