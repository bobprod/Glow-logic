import WebSocket from "ws";
import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as http from "http";
import { EventEmitter } from "events";

// ================================================================
// QLC+ Engine Service — Glow Logic v2
//
// QLC+ tourne en backend headless (invisible).
// Glow Logic est le seul frontend que l'utilisateur voit.
//
// Flow :
//  1. detect / launch QLC+ headless
//  2. auto-configure output (FTDI/UTD-10 sur Universe 1)
//  3. connecter WebSocket pour DMX temps réel
//  4. router tous les dmx_update vers QLC+
// ================================================================

const QLC_WS  = "ws://localhost:9999/qlcplusWS";
const QLC_API = "http://localhost:9999/qlcplusAPI";
const WORKSPACE_PATH = path.join(os.tmpdir(), "glow-logic-engine.qxw");

const QLC_EXE_PATHS = [
  "C:\\QLC+\\qlcplus.exe",
  "C:\\Program Files\\QLC+\\qlcplus.exe",
  "C:\\Program Files (x86)\\QLC+\\qlcplus.exe",
];

type EngineStatus =
  | "offline"      // QLC+ not running, not trying
  | "launching"    // We spawned it, waiting for it to start
  | "configuring"  // Querying devices, setting output
  | "ready"        // WebSocket connected, DMX flowing
  | "error";

export class QlcEngine extends EventEmitter {
  private ws:       WebSocket | null    = null;
  private proc:     ChildProcess | null = null;
  private status:   EngineStatus        = "offline";
  private retryTimer: NodeJS.Timeout | null = null;
  private outputPlugin = "";
  private outputLine   = 0;

  // ── Public API ───────────────────────────────────────────────

  /** Start the engine — called once at server startup */
  async start(): Promise<void> {
    console.log("🎛️  [QLC Engine] Démarrage…");
    await this.ensureRunning();
  }

  stop(): void {
    this.setStatus("offline");
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
  }

  /**
   * Send a DMX channel value to QLC+.
   * universe/channel: 1-indexed (Glow Logic convention)
   */
  setChannel(universe: number, channel: number, value: number): void {
    if (this.status !== "ready" || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // QLC+ WebSocket: 0-indexed
    this.ws.send(`CH|${universe - 1}|${channel - 1}|${Math.round(Math.max(0, Math.min(255, value)))}`);
  }

  getStatus() {
    const installed = !!QLC_EXE_PATHS.find(p => fs.existsSync(p));
    return {
      status: this.status,
      installed,
      outputPlugin: this.outputPlugin,
      outputLine:   this.outputLine,
      wsUrl: QLC_WS,
    };
  }

  // ── Private: lifecycle ───────────────────────────────────────

  private setStatus(s: EngineStatus) {
    if (this.status === s) return;
    this.status = s;
    this.emit("status", s);
    console.log(`[QLC Engine] Status → ${s}`);
  }

  private async ensureRunning(): Promise<void> {
    // Try connecting to already-running QLC+ first
    const alive = await this.isQlcAlive();
    if (alive) {
      await this.configure();
      return;
    }

    // Launch QLC+ headless
    const exe = QLC_EXE_PATHS.find(p => fs.existsSync(p));
    if (!exe) {
      console.error("❌ [QLC Engine] QLC+ non installé — télécharge sur qlcplus.org");
      this.setStatus("error");
      this.emit("need-install");
      return;
    }

    this.setStatus("launching");
    this.writeWorkspace();

    // Release the configured FTDI port so QLC+ can claim the device (D2XX).
    this.emit("claiming-device");

    console.log(`🚀 [QLC Engine] Launch : ${exe} --web --nowm`);
    this.proc = spawn(exe, ["--web", "--nowm", "-w", WORKSPACE_PATH], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    this.proc.unref();

    // Wait for QLC+ HTTP to be ready (poll every 500ms, max 15s)
    let tries = 0;
    while (tries < 30) {
      await sleep(500);
      if (await this.isQlcAlive()) break;
      tries++;
    }

    if (!await this.isQlcAlive()) {
      console.error("❌ [QLC Engine] QLC+ n'a pas démarré");
      this.setStatus("error");
      return;
    }

    await this.configure();
  }

  private async isQlcAlive(): Promise<boolean> {
    const res = await httpGet(`${QLC_API}?call=getOutputDevicesAvailability&universe=0`, 1500);
    return res.ok;
  }

  private async configure(): Promise<void> {
    this.setStatus("configuring");
    try {
      // List available output devices
      const res = await httpGet(`${QLC_API}?call=getOutputDevicesAvailability&universe=0`, 3000);
      console.log("[QLC Engine] Output devices:", res.text);

      // Parse QLC+ response — find first FTDI/DMX device
      const { plugin, line } = this.parseBestOutput(res.text);
      if (plugin) {
        // Set output
        await httpGet(
          `${QLC_API}?call=setOutputDevice&universe=0&plugin=${encodeURIComponent(plugin)}&line=${line}`,
          3000,
        );
        this.outputPlugin = plugin;
        this.outputLine   = line;
        console.log(`✅ [QLC Engine] Output configuré : ${plugin} line ${line}`);
      } else {
        console.warn("⚠️  [QLC Engine] Aucun périphérique DMX trouvé dans QLC+");
      }
    } catch (e) {
      console.warn("[QLC Engine] Config API error:", e);
    }

    // Connect WebSocket
    this.connectWs();
  }

  /** Parse QLC+ API response to find best DMX output (FTDI/USB) */
  private parseBestOutput(raw: string): { plugin: string; line: number } {
    // QLC+ returns lines like: "PluginName,LineIndex,DeviceName,Available"
    const lines = raw.split("\n").filter(Boolean);
    const priority = ["FTDI", "Enttec", "USB", "DMX"];
    for (const prio of priority) {
      const match = lines.find(l => l.includes(prio) && l.includes(",true"));
      if (match) {
        const parts = match.split(",");
        return { plugin: parts[0]?.trim() ?? "", line: parseInt(parts[1] ?? "0") };
      }
    }
    // Fallback: first available
    const first = lines.find(l => l.includes(",true"));
    if (first) {
      const parts = first.split(",");
      return { plugin: parts[0]?.trim() ?? "", line: parseInt(parts[1] ?? "0") };
    }
    return { plugin: "", line: 0 };
  }

  private connectWs(): void {
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }
    const ws = new WebSocket(QLC_WS, { handshakeTimeout: 5000 });

    ws.on("open", () => {
      this.ws = ws;
      this.setStatus("ready");
      console.log("✅ [QLC Engine] WebSocket prêt — DMX flows !");
    });

    ws.on("close", () => {
      this.ws = null;
      if (this.status === "ready") this.setStatus("launching");
      this.retryTimer = setTimeout(() => this.ensureRunning(), 4000);
    });

    ws.on("error", () => {
      // handled by close event
    });
  }

  // ── Workspace (minimal, sans output — configuré via API) ─────
  private writeWorkspace(): void {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Workspace>
<Workspace xmlns="http://www.qlcplus.org/Workspace" CurrentWindow="SimpleDesk">
 <Creator>
  <Name>Q Light Controller Plus</Name>
  <Version>4.12.8</Version>
  <Author>Glow Logic Auto-Setup</Author>
 </Creator>
 <Engine>
  <InputOutputMap>
   <Universe Name="Universe 1" ID="0" PassthroughType="None">
   </Universe>
  </InputOutputMap>
 </Engine>
 <VirtualConsole>
  <Frame>
  </Frame>
 </VirtualConsole>
</Workspace>`;
    fs.writeFileSync(WORKSPACE_PATH, xml, "utf8");
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// Compatible Node 16+ (no global fetch needed)
function httpGet(url: string, timeoutMs: number): Promise<{ ok: boolean; text: string }> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.get({
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: parsed.pathname + parsed.search,
      timeout: timeoutMs,
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve({ ok: (res.statusCode ?? 0) < 400, text: data }));
    });
    req.on("error", () => resolve({ ok: false, text: "" }));
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, text: "" }); });
  });
}

// Singleton
export const qlcEngine = new QlcEngine();
