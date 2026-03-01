import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sendDmxValue, triggerScene, setSlider, setBlackout, setBpm } from './services/qlc';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' },
});

// ============================================================
// Glow Logic v2 — Main Server
// QLC+ OSC Bridge is initialized via ./services/qlc.ts
// ============================================================

io.on('connection', (socket) => {
    console.log('🎨 Client connecté :', socket.id);

    // ── PRO MODE: Nodal Canvas ─────────────────────────────
    // Reçoit les commandes DMX brutes depuis les noeuds React Flow
    socket.on('dmx_update', (data: { universe: number; channel: number; value: number }) => {
        const { universe, channel, value } = data;
        sendDmxValue(universe, channel, value);
        // Sync aux autres clients connectés (tablettes, etc.)
        socket.broadcast.emit('dmx_sync', data);
    });

    // ── SMART MODE: Dashboard ─────────────────────────────
    // Reçoit les valeurs des sliders de zones (Stage, Bar, etc.)
    socket.on('smart:zone_intensity', (data: { zoneId: number; value: number }) => {
        // Convention : chaque zone mappe vers un slider QLC+ (page 1, widget par zoneId)
        setSlider(1, data.zoneId, data.value);
    });

    // Reçoit les déclenchements de scènes via les pads du SmartDashboard
    socket.on('smart:trigger_scene', (data: { pageId: number; widgetId: number; active: boolean }) => {
        triggerScene(data.pageId, data.widgetId, data.active);
    });

    // Blackout d'urgence
    socket.on('smart:blackout', (data: { active: boolean }) => {
        setBlackout(data.active);
        // On notifie tous les clients du blackout
        io.emit('smart:blackout', data);
    });

    // Synchronisation BPM
    socket.on('smart:bpm', (data: { bpm: number }) => {
        setBpm(data.bpm);
        // On notifie tous les clients du nouveau BPM
        io.emit('smart:bpm', data);
    });

    socket.on('disconnect', () => {
        console.log('❌ Client déconnecté :', socket.id);
    });
});

const PORT = 3005;
httpServer.listen(PORT, () => {
    console.log(`🚀 Glow Logic Engine running on http://localhost:${PORT}`);
    console.log(`🎛️  QLC+ OSC Bridge ready (UDP -> 127.0.0.1:7700)`);
});
