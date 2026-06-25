import dgram from 'dgram';
import { getSetting } from './database';

/**
 * Art-Net Service — Glow Logic v2
 * Manual UDP implementation to avoid library dependency issues.
 * Host is read from the database settings (qlc_host key), defaulting to 127.0.0.1.
 */

const ARTNET_PORT = 6454;
const client = dgram.createSocket('udp4');

const universeBuffer: Record<number, number[]> = {};

let artnetHost = '127.0.0.1';

export function initArtNetHost(): void {
    const saved = getSetting('qlc_host');
    if (saved) artnetHost = saved;
    console.log(`📡 [Art-Net] Service ready — sending to ${artnetHost}:${ARTNET_PORT}`);
}

export function updateArtNetTarget(host: string): void {
    artnetHost = host || '127.0.0.1';
    console.log(`📡 [Art-Net] Target updated → ${artnetHost}:${ARTNET_PORT}`);
}

function buildArtDmxHeader(artnetUniverse: number): Buffer {
    return Buffer.from([
        0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // "Art-Net\0"
        0x00, 0x50, // OpCode ArtDmx (0x5000)
        0x00, 0x0e, // ProtVer 14
        0x00,       // Sequence
        0x00,       // Physical
        artnetUniverse & 0xff, (artnetUniverse >> 8) & 0xff, // Universe
        0x02, 0x00  // Length 512 (high/low)
    ]);
}

function emitArtNetUniverse(artnetUniverse: number): void {
    const packet = Buffer.concat([
        buildArtDmxHeader(artnetUniverse),
        Buffer.from(universeBuffer[artnetUniverse]),
    ]);

    client.send(packet, ARTNET_PORT, artnetHost, (err) => {
        if (err) console.error('❌ [Art-Net] UDP Error:', err);
    });
}

export function sendArtNetValue(universe: number, channel: number, value: number): void {
    const artnetUniverse = Math.max(0, universe - 1);
    const dmxChannel = Math.max(0, channel - 1);

    if (!universeBuffer[artnetUniverse]) {
        universeBuffer[artnetUniverse] = new Array(512).fill(0);
    }

    universeBuffer[artnetUniverse][dmxChannel] = value;
    emitArtNetUniverse(artnetUniverse);
}

/**
 * Envoie l'univers complet en UN seul paquet ArtDmx.
 * À utiliser par la boucle de refresh du router : un seul paquet par
 * univers dirty et par frame, au lieu d'un paquet par canal modifié.
 * @param universe  Numéro d'univers DMX (1-indexed, convention Glow Logic)
 * @param values    512 valeurs 0-255 (Uint8Array ou number[])
 */
export function sendArtNetUniverse(universe: number, values: Uint8Array | number[]): void {
    const artnetUniverse = Math.max(0, universe - 1);

    if (!universeBuffer[artnetUniverse]) {
        universeBuffer[artnetUniverse] = new Array(512).fill(0);
    }

    const buffer = universeBuffer[artnetUniverse];
    const count = Math.min(values.length, 512);
    for (let i = 0; i < count; i += 1) {
        buffer[i] = Math.max(0, Math.min(255, values[i] | 0));
    }

    emitArtNetUniverse(artnetUniverse);
}
