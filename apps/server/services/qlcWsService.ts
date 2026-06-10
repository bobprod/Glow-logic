import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync, spawn, ChildProcess } from 'child_process';

// ============================================================
// QLC+ WebSocket Bridge — Glow Logic v2
//
// Envoie les valeurs DMX directement vers QLC+ via WebSocket.
// QLC+ gère le driver FTDI / BREAK / timing DMX.
// Format WS : CH|universe|channel|value (0-indexed)
// ============================================================

const QLC_WS_URL  = 'ws://localhost:9999/qlcplusWS';
const QLC_HTTP    = 'http://localhost:9999';

// QLC+ workspace minimal (UTD-10 / FTDI sur Universe 1)
const WORKSPACE_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE Workspace>
<Workspace xmlns="http://www.qlcplus.org/Workspace" CurrentWindow="SimpleDesk">
 <Creator>
  <Name>Q Light Controller Plus</Name>
  <Version>4.12.8</Version>
  <Author>Glow Logic Auto</Author>
 </Creator>
 <Engine>
  <InputOutputMap>
   <Universe Name="Universe 1" ID="0" PassthroughType="None">
    <Output Plugin="FTDI" UID="AB0KT9HXA" Line="0"/>
   </Universe>
  </InputOutputMap>
 </Engine>
 <VirtualConsole>
  <Frame>
  </Frame>
 </VirtualConsole>
</Workspace>`;

const WORKSPACE_PATH = path.join(os.tmpdir(), 'glow-logic.qxw');

// Common QLC+ install paths on Windows
const QLC_PATHS = [
  'C:\\Program Files\\QLC+\\qlcplus.exe',
  'C:\\Program Files (x86)\\QLC+\\qlcplus.exe',
  'C:\\QLC+\\qlcplus.exe',
];

class QlcWsService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private qlcProcess: ChildProcess | null = null;
  private enabled = false;
  private readonly RECONNECT_MS = 3000;

  // ── Connection ────────────────────────────────────────────────
  enable(): void {
    this.enabled = true;
    this.connect();
  }

  disable(): void {
    this.enabled = false;
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.isConnected = false;
    console.log('🔌 [QLC+ WS] Désactivé');
  }

  private connect(): void {
    if (!this.enabled) return;
    if (this.ws) { try { this.ws.close(); } catch {} this.ws = null; }

    console.log(`🔗 [QLC+ WS] Connexion → ${QLC_WS_URL}`);
    const ws = new WebSocket(QLC_WS_URL, { handshakeTimeout: 3000 });

    ws.on('open', () => {
      this.ws = ws;
      this.isConnected = true;
      console.log('✅ [QLC+ WS] Connecté à QLC+');
    });

    ws.on('close', () => {
      this.ws = null;
      this.isConnected = false;
      if (this.enabled) {
        this.reconnectTimer = setTimeout(() => this.connect(), this.RECONNECT_MS);
      }
    });

    ws.on('error', (err) => {
      // Only log once per reconnect cycle
      if (!this.reconnectTimer) {
        console.error(`⚠️  [QLC+ WS] ${err.message} — nouvelle tentative dans ${this.RECONNECT_MS / 1000}s`);
      }
    });
  }

  // ── DMX Output ────────────────────────────────────────────────
  /**
   * Set a DMX channel via QLC+ WebSocket.
   * universe : 1-indexed (Glow Logic convention)
   * channel  : 1-indexed (Glow Logic convention)
   * value    : 0-255
   */
  setChannel(universe: number, channel: number, value: number): void {
    if (!this.isConnected || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    // QLC+ is 0-indexed for both universe and channel
    const msg = `CH|${universe - 1}|${channel - 1}|${Math.round(Math.max(0, Math.min(255, value)))}`;
    this.ws.send(msg);
  }

  // ── Workspace ─────────────────────────────────────────────────
  /** Génère un workspace QLC+ pré-configuré pour le UTD-10 */
  generateWorkspace(): string {
    fs.writeFileSync(WORKSPACE_PATH, WORKSPACE_CONTENT, 'utf8');
    return WORKSPACE_PATH;
  }

  /** Ouvre QLC+ avec le workspace auto-généré */
  launchQlc(): { success: boolean; message: string } {
    const qlcExe = QLC_PATHS.find(p => fs.existsSync(p));
    if (!qlcExe) {
      return { success: false, message: 'QLC+ non trouvé. Installe QLC+ depuis qlcplus.org' };
    }
    const ws = this.generateWorkspace();
    console.log(`🚀 [QLC+] Lancement : ${qlcExe} -w ${ws}`);
    this.qlcProcess = spawn(qlcExe, ['-w', '--web', ws], {
      detached: true,
      stdio: 'ignore',
    });
    this.qlcProcess.unref();
    // Auto-connect après délai de démarrage QLC+
    setTimeout(() => { if (this.enabled) this.connect(); }, 3000);
    return { success: true, message: `QLC+ lancé (workspace: ${ws})` };
  }

  /** Installe QLC+ via winget (Windows 10+) */
  async installQlc(): Promise<{ success: boolean; message: string }> {
    try {
      const qlcExe = QLC_PATHS.find(p => fs.existsSync(p));
      if (qlcExe) return { success: true, message: 'QLC+ déjà installé' };
      console.log('[QLC+] Installation via winget...');
      execSync('winget install --id qlcplus.qlcplus -e --accept-source-agreements --accept-package-agreements', { stdio: 'inherit' });
      return { success: true, message: 'QLC+ installé avec succès' };
    } catch (e) {
      return { success: false, message: `Échec winget: ${String(e)}. Installe manuellement depuis qlcplus.org` };
    }
  }

  // ── Status ────────────────────────────────────────────────────
  getStatus() {
    const installed = !!QLC_PATHS.find(p => fs.existsSync(p));
    return {
      enabled:   this.enabled,
      installed,
      running:   this.isConnected,
      wsUrl:     QLC_WS_URL,
      workspacePath: WORKSPACE_PATH,
    };
  }
}

export const qlcWs = new QlcWsService();
