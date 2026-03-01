const { Server } = require("socket.io");
const http = require("http");

// Création du serveur HTTP
const server = http.createServer();

// Initialisation de Socket.io avec configuration CORS
const io = new Server(server, {
    cors: {
        origin: "*", // En dev, on autorise tout. À sécuriser en prod !
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("⚡ Nouveau client connecté (Front-end) :", socket.id);

    // Écoute du fameux "Ping"
    socket.on("pingDMX", (data) => {
        console.log(`📡 Ping DMX reçu : Univers ${data.universe}, Canal ${data.channel}, Valeur ${data.value}`);

        // Ici, on enverra l'ordre Art-Net ou QLC+ plus tard !
        // Pour l'instant, on renvoie une confirmation au front
        socket.emit("pongDMX", { status: "Success", timestamp: Date.now() });
    });

    socket.on("disconnect", () => {
        console.log("❌ Client déconnecté :", socket.id);
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`🚀 Glow Logic Server en ligne sur le port ${PORT}`);
});
