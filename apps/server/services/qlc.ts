import osc from 'osc';

// ============================================================
// QLC+ OSC Bridge — Glow Logic v2
// ============================================================
// QLC+ doit être configuré pour recevoir l'OSC sur le port 7700.
// Dans QLC+ : Inputs/Outputs > OSC Plugin > Port 7700.
// ============================================================

const QLC_HOST = '127.0.0.1';
const QLC_PORT = 7700; // Port OSC standard QLC+
const qlcOscDisabled = process.env.NODE_ENV === 'test';

const udpPort = qlcOscDisabled ? null : new osc.UDPPort({
    localAddress: '0.0.0.0',
    localPort: 57121, // Port local d'écoute (standard OSC client)
    remoteAddress: QLC_HOST,
    remotePort: QLC_PORT,
    metadata: true,
});

if (udpPort) {
udpPort.open();
udpPort.on('ready', () => {
    console.log(`✅ [QLC+] OSC Bridge ouvert — envoi vers ${QLC_HOST}:${QLC_PORT}`);
});
udpPort.on('error', (err: Error) => {
    console.error('❌ [QLC+] Erreur OSC UDP:', err.message);
});
}

function sendOsc(packet: any): void {
    if (!udpPort) return;
    udpPort.send(packet);
}

// ============================================================
// API OSC publique
// ============================================================

/**
 * Envoie une valeur de fader/slider DMX à QLC+.
 * @param universe  Numéro d'univers DMX (1-indexed)
 * @param channel   Numéro de canal DMX (1-indexed)
 * @param value     Valeur 0-255
 */
export function sendDmxValue(universe: number, channel: number, value: number): void {
    const oscValue = Math.min(1, Math.max(0, value / 255)); // Normalise 0-255 -> 0.0-1.0
    sendOsc({
        address: `/${universe}/${channel}`,
        args: [{ type: 'f', value: oscValue }],
    });
}

/**
 * Déclenche une Scène ou un Chaser QLC+ par son ID de bouton (Virtual Console).
 * @param pageId    ID de la page de la Virtual Console
 * @param widgetId  ID du widget (bouton) dans QLC+
 * @param activate  true = activer, false = désactiver
 */
export function triggerScene(pageId: number, widgetId: number, activate = true): void {
    const val = activate ? 1.0 : 0.0;
    sendOsc({
        address: `/qlc/button/${pageId}/${widgetId}`,
        args: [{ type: 'f', value: val }],
    });
}

/**
 * Contrôle un slider de la Virtual Console QLC+.
 * @param pageId    ID de la page de la Virtual Console
 * @param widgetId  ID du widget slider dans QLC+
 * @param value     Valeur 0-255
 */
export function setSlider(pageId: number, widgetId: number, value: number): void {
    const oscValue = Math.min(1, Math.max(0, value / 255));
    sendOsc({
        address: `/qlc/slider/${pageId}/${widgetId}`,
        args: [{ type: 'f', value: oscValue }],
    });
}

/**
 * Active ou désactive le Blackout total.
 */
export function setBlackout(active: boolean): void {
    // Convention : /qlc/button/1/99 est le bouton Blackout dans QLC+
    triggerScene(1, 99, active);
    console.log(`[QLC+] BLACKOUT: ${active ? '⚫ ON' : '⚪ OFF'}`);
}
/**
 * Met à jour le BPM global dans QLC+.
 */
export function setBpm(bpm: number): void {
    sendOsc({
        address: '/qlc/bpm',
        args: [{ type: 'f', value: bpm }],
    });
    console.log(`[QLC+] BPM Sync: ${bpm.toFixed(1)}`);
}
