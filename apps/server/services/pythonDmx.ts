import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import { EventEmitter } from "events";

// ================================================================
// Python DMX Bridge — Glow Logic v2
// Utilise SetCommBreak/ClearCommBreak Windows API via Python
// pour générer le signal BREAK correct pour les dongles FTDI UTD-10
// ================================================================

const BRIDGE_SCRIPT = path.join(__dirname, "..", "dmx_bridge.py");
export const DEFAULT_PYTHON_DMX_PORT = "COM5";

export class PythonDmxBridge extends EventEmitter {
  private proc:      ChildProcess | null = null;
  private ready      = false;
  private portPath   = DEFAULT_PYTHON_DMX_PORT;
  private retryTimer: NodeJS.Timeout | null = null;

  start(port = DEFAULT_PYTHON_DMX_PORT): void {
    this.portPath = port;
    this.launch();
  }

  stop(): void {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null; }
    if (this.proc) {
      this.send({ cmd: "quit" });
      setTimeout(() => { this.proc?.kill(); this.proc = null; }, 500);
    }
    this.ready = false;
  }

  /** Send DMX channel value (1-indexed, 0-255) */
  setChannel(universe: number, channel: number, value: number): void {
    if (!this.ready) return;
    // Python bridge currently handles universe 1 only (single UTD-10)
    if (universe !== 1) return;
    this.send({ channel, value: Math.round(Math.max(0, Math.min(255, value))) });
  }

  getStatus() {
    return { ready: this.ready, port: this.portPath, pid: this.proc?.pid ?? null };
  }

  // ── Private ───────────────────────────────────────────────────

  private launch(): void {
    if (this.proc) { try { this.proc.kill(); } catch {} this.proc = null; }
    this.ready = false;

    console.log(`[Python DMX] Démarrage bridge sur ${this.portPath}…`);
    // Fallback to system Python executable paths to bypass local venv environment mismatch
    const pythonExe = process.env.VENV_PYTHON || 
      (require("fs").existsSync("C:\\Users\\AMIN\\AppData\\Local\\Programs\\Python\\Python311\\python.exe") 
        ? "C:\\Users\\AMIN\\AppData\\Local\\Programs\\Python\\Python311\\python.exe"
        : (require("fs").existsSync("C:\\Users\\AMIN\\AppData\\Local\\Programs\\Python\\Python313\\python.exe")
          ? "C:\\Users\\AMIN\\AppData\\Local\\Programs\\Python\\Python313\\python.exe"
          : "python"));
    
    const proc = spawn(pythonExe, ["-u", BRIDGE_SCRIPT], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdout?.on("data", (data: Buffer) => {
      for (const line of data.toString().split("\n").filter(Boolean)) {
        try {
          const msg = JSON.parse(line);
          if (msg.status === "ready") {
            this.ready = true;
            console.log(`✅ [Python DMX] Bridge prêt sur ${this.portPath} — DMX flows !`);
            this.emit("ready");
          }
          if (msg.error) {
            console.error(`❌ [Python DMX] ${msg.error}`);
            require("./anomalyDetector").addAnomaly("PythonDMX", msg.error, "error");
            this.emit("error", msg.error);
          }
        } catch { /* ignore non-JSON */ }
      }
    });

    proc.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg) {
        console.error(`[Python DMX stderr] ${msg}`);
        require("./anomalyDetector").addAnomaly("PythonDMX_Stderr", msg, "warning");
      }
    });

    proc.on("exit", (code) => {
      this.ready = false;
      this.proc  = null;
      console.warn(`⚠️  [Python DMX] Bridge arrêté (code ${code}) — relance dans 3s`);
      if (code !== 0 && code !== null) {
        require("./anomalyDetector").addAnomaly("PythonDMX", `Le pont Python s'est arrêté avec le code ${code}`, "warning");
      }
      this.retryTimer = setTimeout(() => this.launch(), 3000);
    });

    proc.on("error", (err) => {
      console.error(`❌ [Python DMX] Spawn error: ${err.message}`);
      require("./anomalyDetector").addAnomaly("PythonDMX", `Échec du lancement du pont Python : ${err.message}`, "error");
      this.ready = false;
      this.retryTimer = setTimeout(() => this.launch(), 3000);
    });

    this.proc = proc;
  }

  private send(obj: object): void {
    if (!this.proc?.stdin?.writable) return;
    this.proc.stdin.write(JSON.stringify(obj) + "\n");
  }
}

export const pythonDmx = new PythonDmxBridge();
