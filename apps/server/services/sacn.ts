import dgram from 'dgram';
import { getSetting } from './database';

/**
 * sACN / E1.31 Service — Glow Logic v2
 * Manual UDP implementation of ANSI E1.31 (streaming ACN), calqué sur artnet.ts.
 *
 * Envoie l'univers DMX complet (512 canaux) en UN paquet E1.31 par appel.
 * Désactivé par défaut côté router — aucun paquet n'est émis tant que la
 * sortie 'sacn' n'est pas activée. Comportement DMX inchangé sinon.
 *
 * Destination par défaut : MULTICAST 239.255.(uni>>8).(uni&0xff):5568.
 * Si le setting `sacn_host` est présent, envoi en UNICAST vers ce host.
 */

const SACN_PORT = 5568;
const client = dgram.createSocket({ type: 'udp4', reuseAddr: true });

// E1.31 packet sizes
const ROOT_PREAMBLE_SIZE = 0x0010;
const ROOT_POSTAMBLE_SIZE = 0x0000;
const ACN_PID = Buffer.from([
    0x41, 0x53, 0x43, 0x2d, 0x45, 0x31, 0x2e, 0x31,
    0x37, 0x00, 0x00, 0x00, // "ASC-E1.17\0\0\0"
]);

const VECTOR_ROOT_E131_DATA = 0x00000004;
const VECTOR_E131_DATA_PACKET = 0x00000002;
const VECTOR_DMP_SET_PROPERTY = 0x02;

const SOURCE_NAME = 'Glow Logic';
const PRIORITY = 100;

// CID fixe — UUID 16 octets généré UNE fois (constante d'octets, pas de runtime random).
const CID = Buffer.from([
    0x67, 0x6c, 0x6f, 0x77, 0x6c, 0x6f, 0x67, 0x69,
    0x63, 0x2d, 0x73, 0x61, 0x63, 0x6e, 0x00, 0x01,
]);

// Compteur de séquence par univers (0..255).
const sequenceByUniverse: Record<number, number> = {};

// host configuré → unicast ; null → multicast par univers.
let sacnHost: string | null = null;

const isTest = process.env.NODE_ENV === 'test';

export function initSacn(): void {
    const saved = getSetting('sacn_host');
    if (saved) sacnHost = saved;
    const mode = sacnHost ? `unicast ${sacnHost}` : 'multicast 239.255.x.x';
    console.log(`📡 [sACN] Service ready — ${mode}:${SACN_PORT}`);
}

export function updateSacnTarget(host: string): void {
    sacnHost = host && host.trim() ? host.trim() : null;
    const mode = sacnHost ? `unicast ${sacnHost}` : 'multicast 239.255.x.x';
    console.log(`📡 [sACN] Target updated → ${mode}:${SACN_PORT}`);
}

function nextSequence(universe: number): number {
    const cur = sequenceByUniverse[universe] ?? 0;
    const next = (cur + 1) & 0xff;
    sequenceByUniverse[universe] = next;
    return next;
}

function multicastAddress(universe: number): string {
    return `239.255.${(universe >> 8) & 0xff}.${universe & 0xff}`;
}

/**
 * Construit un paquet E1.31 complet (3 couches : Root / Framing / DMP).
 * @param universe Univers E1.31 (16 bits)
 * @param values   512 valeurs DMX 0-255
 */
function buildSacnPacket(universe: number, values: Uint8Array | number[]): Buffer {
    // DMP property values : [startcode 0x00] + 512 octets DMX = 513 octets.
    const PROP_VALUE_COUNT = 0x0201; // 513
    const dmp = Buffer.alloc(10 + PROP_VALUE_COUNT);
    // DMP Layer length = 11 (flags/length(2)..addr_inc(2)+count(2)) + 513 ... calculé plus bas via flags/length.
    let o = 0;
    dmp[o] = 0; o += 1; dmp[o] = 0; o += 1;       // flags/length placeholder
    dmp[o] = VECTOR_DMP_SET_PROPERTY; o += 1;      // vector 0x02
    dmp[o] = 0xa1; o += 1;                          // address/data type
    dmp.writeUInt16BE(0x0000, o); o += 2;          // first property address
    dmp.writeUInt16BE(0x0001, o); o += 2;          // address increment
    dmp.writeUInt16BE(PROP_VALUE_COUNT, o); o += 2; // property value count = 513
    dmp[o] = 0x00; o += 1;                          // DMX start code
    const count = Math.min(values.length, 512);
    for (let i = 0; i < 512; i += 1) {
        const v = i < count ? (values[i] | 0) : 0;
        dmp[o + i] = v < 0 ? 0 : v > 255 ? 255 : v;
    }
    const dmpLen = dmp.length;
    // Framing Layer : 77 octets (jusqu'au champ universe inclus).
    const framing = Buffer.alloc(77);
    let f = 0;
    f += 2; // flags/length placeholder
    framing.writeUInt32BE(VECTOR_E131_DATA_PACKET, f); f += 4; // vector 0x00000002
    framing.write(SOURCE_NAME, f, 'utf8'); f += 64;            // source name (64, padded with 0)
    framing[f] = PRIORITY; f += 1;                             // priority 100
    framing.writeUInt16BE(0x0000, f); f += 2;                  // sync address
    framing[f] = nextSequence(universe); f += 1;               // sequence number
    framing[f] = 0x00; f += 1;                                 // options
    framing.writeUInt16BE(universe & 0xffff, f); f += 2;       // universe (BE)
    const framingLen = framing.length + dmpLen;

    // Root Layer : 38 octets.
    const root = Buffer.alloc(38);
    let r = 0;
    root.writeUInt16BE(ROOT_PREAMBLE_SIZE, r); r += 2;   // preamble size
    root.writeUInt16BE(ROOT_POSTAMBLE_SIZE, r); r += 2;  // postamble size
    ACN_PID.copy(root, r); r += 12;                       // ACN packet identifier
    r += 2;                                               // flags/length placeholder
    root.writeUInt32BE(VECTOR_ROOT_E131_DATA, r); r += 4; // vector 0x00000004
    CID.copy(root, r); r += 16;                            // CID
    const rootLen = (root.length - 16) + framingLen; // PDU length from flags/length field onward

    // flags (0x7) + 12-bit length, sur les champs flags/length de chaque couche.
    root.writeUInt16BE(0x7000 | (rootLen & 0x0fff), 16);
    framing.writeUInt16BE(0x7000 | (framingLen & 0x0fff), 0);
    dmp.writeUInt16BE(0x7000 | (dmpLen & 0x0fff), 0);

    return Buffer.concat([root, framing, dmp]);
}

/**
 * Envoie l'univers complet en UN seul paquet E1.31.
 * Multicast par défaut (239.255.x.x) ; unicast si sacn_host configuré.
 * Robuste : ne throw jamais.
 * @param universe Numéro d'univers DMX (convention Glow Logic, utilisé tel quel comme univers E1.31)
 * @param values   512 valeurs 0-255 (Uint8Array ou number[])
 */
export function sendSacnUniverse(universe: number, values: Uint8Array | number[]): void {
    try {
        const uni = universe & 0xffff;
        const packet = buildSacnPacket(uni, values);
        const dest = sacnHost ?? multicastAddress(uni);
        if (isTest) {
            // En test : pas d'ouverture réseau réelle, on ne crashe pas.
            return;
        }
        client.send(packet, SACN_PORT, dest, (err) => {
            if (err) console.error('❌ [sACN] UDP Error:', err);
        });
    } catch (err) {
        console.error('❌ [sACN] send failed:', err);
    }
}
