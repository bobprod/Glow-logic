import dgram from 'dgram';

/**
 * Art-Net Service — Glow Logic v2
 * Manual UDP implementation to avoid library dependency issues.
 */

const ARTNET_HOST = '127.0.0.1';
const ARTNET_PORT = 6454;
const client = dgram.createSocket('udp4');

const universeBuffer: Record<number, number[]> = {};

export function sendArtNetValue(universe: number, channel: number, value: number): void {
    const artnetUniverse = Math.max(0, universe - 1);
    const dmxChannel = Math.max(0, channel - 1);

    if (!universeBuffer[artnetUniverse]) {
        universeBuffer[artnetUniverse] = new Array(512).fill(0);
    }

    universeBuffer[artnetUniverse][dmxChannel] = value;

    // Build Art-Net Packet
    // Header: "Art-Net" + 0x00 + Opcode (0x5000 low/high) + Version (14 low/high) + Sequence + Physical + Universe (low/high) + Length (high/low) + Data
    const header = Buffer.from([
        0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00, // "Art-Net\0"
        0x00, 0x50, // OpCode ArtDmx (0x5000)
        0x00, 0x0e, // ProtVer 14
        0x00,       // Sequence
        0x00,       // Physical
        artnetUniverse & 0xff, (artnetUniverse >> 8) & 0xff, // Universe
        0x02, 0x00  // Length 512 (high/low)
    ]);

    const packet = Buffer.concat([header, Buffer.from(universeBuffer[artnetUniverse])]);

    client.send(packet, ARTNET_PORT, ARTNET_HOST, (err) => {
        if (err) console.error('❌ [Art-Net] UDP Error:', err);
    });
}

console.log(`📡 [Art-Net] Service ready — sending to ${ARTNET_HOST}:${ARTNET_PORT}`);
