import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { sendDmxValue, triggerScene, setSlider, setBlackout, setBpm } from './services/qlc';
import { sendArtNetValue } from './services/artnet';
import { saveProject, getProjects, getProjectById, deleteProject } from './services/database';

const app = express();
app.use(express.json()); // Essential for parsing project JSON data

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*' },
});

// ── REST API — Projet Management ──────────────────────────────
app.get('/api/projects', (req, res) => {
    try {
        const projects = getProjects();
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la récupération des projets' });
    }
});

app.get('/api/projects/:id', (req, res) => {
    try {
        const project = getProjectById(parseInt(req.params.id));
        if (project) res.json(project);
        else res.status(404).json({ error: 'Projet non trouvé' });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors du chargement du projet' });
    }
});

app.post('/api/projects', (req, res) => {
    try {
        const { name, data } = req.body;
        if (!name || !data) {
            return res.status(400).json({ error: 'Nom et données obligatoires' });
        }
        const id = saveProject(name, data);
        res.json({ id, success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la sauvegarde du projet' });
    }
});

app.delete('/api/projects/:id', (req, res) => {
    try {
        deleteProject(parseInt(req.params.id));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erreur lors de la suppression' });
    }
});

// ============================================================

io.on('connection', (socket) => {
    console.log('🎨 Client connecté :', socket.id);

    // ── PRO MODE: Nodal Canvas ─────────────────────────────
    // Reçoit les commandes DMX brutes depuis les noeuds React Flow
    socket.on('dmx_update', (data: { universe: number; channel: number; value: number }) => {
        const { universe, channel, value } = data;

        // Output 1: QLC+ OSC Bridge
        sendDmxValue(universe, channel, value);

        // Output 2: Art-Net (direct or to bridge software)
        sendArtNetValue(universe, channel, value);

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
