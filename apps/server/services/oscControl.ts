import osc from 'osc';
import type { Server as SocketIOServer } from 'socket.io';
import { dmxRouter } from './dmxRouter';
import { getSetting } from './database';

// ============================================================
// OSC Bidirectional Control Surface — Glow Logic
// ============================================================
// Surface de contrôle tablette (TouchOSC / Lemur).
// Namespace PROPRE "/glow/..." (additif, indépendant de QLC+).
//
// Messages ENTRANTS:
//   /glow/ch/<universe>/<channel> <float 0..1>  => setChannel(u, c, round(f*255))
//   /glow/blackout <0|1|float>                   => io.emit('smart:blackout', {active})
//   /glow/bpm <float>                            => io.emit('smart:bpm', {bpm clamp 20..300})
//
// FEEDBACK SORTANT (throttle ~5/s):
//   /glow/ch/<u>/<c> <value/255>  pour les canaux non nuls de chaque univers.
// ============================================================

const FEEDBACK_INTERVAL_MS = 200; // ~5 Hz
const oscControlDisabled = process.env.NODE_ENV === 'test';

let udpPort: any = null;
let feedbackTimer: ReturnType<typeof setInterval> | null = null;
let feedbackTarget: { host: string; port: number } | null = null;

/** Log défensif: utilise addSupportLog si dispo, sinon console. */
function log(
    severity: 'info' | 'warning' | 'error',
    message: string,
    context?: Record<string, unknown>,
): void {
    try {
        // Import paresseux pour éviter une dépendance dure si le module change.

        const mod = require('./supportLog') as {
            addSupportLog?: (
                source: string,
                message: string,
                severity?: 'info' | 'warning' | 'error',
                context?: Record<string, unknown>,
            ) => void;
        };
        if (mod && typeof mod.addSupportLog === 'function') {
            mod.addSupportLog('OSC', message, severity, context);
            return;
        }
    } catch {
        // ignore — fallback console
    }
    const prefix = severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️';
    if (severity === 'error') console.error(`${prefix} [OSC] ${message}`, context ?? '');
    else console.log(`${prefix} [OSC] ${message}`, context ?? '');
}

function clamp(v: number, min: number, max: number): number {
    if (!Number.isFinite(v)) return min;
    return Math.min(max, Math.max(min, v));
}

/** Extrait le premier argument numérique d'un message OSC (défensif). */
function firstNumberArg(oscMsg: { args?: unknown }): number | null {
    const args = oscMsg?.args;
    if (!Array.isArray(args) || args.length === 0) return null;
    const raw = args[0];
    let value: unknown = raw;
    // metadata: true => args = [{ type, value }]
    if (raw && typeof raw === 'object' && 'value' in (raw as Record<string, unknown>)) {
        value = (raw as Record<string, unknown>).value;
    }
    const n = typeof value === 'boolean' ? (value ? 1 : 0) : Number(value);
    return Number.isFinite(n) ? n : null;
}

/** Parse et traite un message OSC entrant. */
function handleMessage(oscMsg: { address?: unknown; args?: unknown }, io: SocketIOServer): void {
    try {
        const address = typeof oscMsg?.address === 'string' ? oscMsg.address : '';
        if (!address.startsWith('/glow/')) return;

        // /glow/ch/<universe>/<channel>
        const chMatch = address.match(/^\/glow\/ch\/(\d+)\/(\d+)$/);
        if (chMatch) {
            const universe = parseInt(chMatch[1], 10);
            const channel = parseInt(chMatch[2], 10);
            const f = firstNumberArg(oscMsg);
            if (f === null) return;
            if (!Number.isInteger(universe) || universe < 0) return;
            if (!Number.isInteger(channel) || channel < 1 || channel > 512) return;
            const value = clamp(Math.round(clamp(f, 0, 1) * 255), 0, 255);
            // safety-gated via le routeur
            dmxRouter.setChannel(universe, channel, value);
            return;
        }

        if (address === '/glow/blackout') {
            const v = firstNumberArg(oscMsg);
            if (v === null) return;
            io.emit('smart:blackout', { active: v >= 0.5 });
            return;
        }

        if (address === '/glow/bpm') {
            const v = firstNumberArg(oscMsg);
            if (v === null) return;
            io.emit('smart:bpm', { bpm: clamp(v, 20, 300) });
            return;
        }
    } catch (err) {
        log('warning', 'Erreur traitement message OSC entrant', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/** Envoie le feedback OSC sortant (état live des univers). */
function sendFeedback(): void {
    if (!udpPort || !feedbackTarget) return;
    try {
        // Découvre les univers actifs via les outputs déclarés.
        // Par robustesse, on scanne une petite plage d'univers (0..7).
        for (let u = 0; u <= 7; u++) {
            let live: Record<number, number> | null = null;
            try {
                live = dmxRouter.getLiveUniverse(u);
            } catch {
                live = null;
            }
            if (!live) continue;
            const channels = Object.keys(live);
            if (channels.length === 0) continue;
            for (const key of channels) {
                const ch = Number(key);
                const val = live[ch];
                if (!Number.isFinite(ch) || !Number.isFinite(val) || val <= 0) continue;
                udpPort.send(
                    {
                        address: `/glow/ch/${u}/${ch}`,
                        args: [{ type: 'f', value: clamp(val / 255, 0, 1) }],
                    },
                    feedbackTarget.host,
                    feedbackTarget.port,
                );
            }
        }
    } catch (err) {
        log('warning', 'Erreur feedback OSC sortant', {
            error: err instanceof Error ? err.message : String(err),
        });
    }
}

/**
 * Démarre le service OSC de contrôle bidirectionnel.
 * No-op en test (NODE_ENV === 'test') ou si désactivé via setting.
 */
export function startOscControl(io: SocketIOServer): void {
    if (oscControlDisabled) return;

    try {
        if (getSetting('osc_control_enabled') !== '1') {
            log('info', 'OSC control désactivé (osc_control_enabled !== "1")');
            return;
        }
    } catch (err) {
        log('warning', 'Lecture setting osc_control_enabled échouée — service non démarré', {
            error: err instanceof Error ? err.message : String(err),
        });
        return;
    }

    // Déjà démarré ? idempotent.
    if (udpPort) {
        log('info', 'OSC control déjà démarré — ignore');
        return;
    }

    let listenPort = 7800;
    let host = '127.0.0.1';
    let portOut = 9000;
    try {
        listenPort = clamp(parseInt(getSetting('osc_control_port') || '7800', 10), 1, 65535);
        host = getSetting('osc_control_host') || '127.0.0.1';
        portOut = clamp(parseInt(getSetting('osc_control_port_out') || '9000', 10), 1, 65535);
        if (!Number.isFinite(listenPort)) listenPort = 7800;
        if (!Number.isFinite(portOut)) portOut = 9000;
    } catch {
        listenPort = 7800;
        host = '127.0.0.1';
        portOut = 9000;
    }

    feedbackTarget = { host, port: portOut };

    try {
        udpPort = new osc.UDPPort({
            localAddress: '0.0.0.0',
            localPort: listenPort,
            metadata: true,
        });

        udpPort.on('ready', () => {
            log('info', `OSC control prêt — écoute ${listenPort}, feedback → ${host}:${portOut}`);
        });

        udpPort.on('message', (oscMsg: { address?: unknown; args?: unknown }) => {
            handleMessage(oscMsg, io);
        });

        udpPort.on('error', (err: Error) => {
            log('error', 'Erreur OSC UDP — arrêt du service', { error: err.message });
            // Auto-stop si erreur fatale.
            stopOscControl();
        });

        udpPort.open();

        // Feedback sortant throttlé.
        feedbackTimer = setInterval(sendFeedback, FEEDBACK_INTERVAL_MS);
        if (typeof feedbackTimer.unref === 'function') feedbackTimer.unref();

        log('info', 'OSC control démarré', { listenPort, host, portOut });
    } catch (err) {
        log('error', "Échec ouverture OSC control", {
            error: err instanceof Error ? err.message : String(err),
        });
        stopOscControl();
    }
}

/** Ferme proprement le service OSC (idempotent). */
export function stopOscControl(): void {
    if (feedbackTimer) {
        clearInterval(feedbackTimer);
        feedbackTimer = null;
    }
    if (udpPort) {
        try {
            udpPort.close();
        } catch {
            // ignore
        }
        udpPort = null;
    }
    feedbackTarget = null;
}
