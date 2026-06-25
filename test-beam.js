const { io } = require("socket.io-client");

const socket = io("http://localhost:3005", {
  transports: ["websocket", "polling"],
  timeout: 5000,
});

socket.on("connect", () => {
  console.log("✅ Connecté au serveur Glow Logic");
  console.log("🎬 Test du BEAM 12ch - Univers 1, Adresse 1");
  console.log("");

  const universe = 1;
  const startAddr = 1;

  // Fonction utilitaire pour envoyer une valeur DMX
  const send = (channel, value, desc) => {
    socket.emit("dmx_update", { universe, channel: startAddr + channel - 1, value });
    console.log(`📡 Ch ${channel} (${desc}): ${value}`);
  };

  // Séquence de test du beam
  console.log("=== TEST 1: Allumage + Centre ===");
  send(6, 255, "Dimmer");      // Dimmer à fond
  send(1, 127, "Pan");          // Pan centré
  send(3, 127, "Tilt");         // Tilt centré
  
  setTimeout(() => {
    console.log("\n=== TEST 2: Mouvement Pan ===");
    send(1, 0, "Pan gauche");
  }, 2000);

  setTimeout(() => {
    console.log("\n=== TEST 3: Mouvement Pan droit ===");
    send(1, 255, "Pan droit");
  }, 4000);

  setTimeout(() => {
    console.log("\n=== TEST 4: Tilt haut ===");
    send(3, 0, "Tilt haut");
  }, 6000);

  setTimeout(() => {
    console.log("\n=== TEST 5: Tilt bas ===");
    send(3, 255, "Tilt bas");
  }, 8000);

  setTimeout(() => {
    console.log("\n=== TEST 6: Retour centre + Gobo ===");
    send(1, 127, "Pan centre");
    send(3, 127, "Tilt centre");
    send(9, 50, "Gobo");
  }, 10000);

  setTimeout(() => {
    console.log("\n=== TEST 7: Changement couleur ===");
    send(8, 30, "Color wheel");
  }, 12000);

  setTimeout(() => {
    console.log("\n=== TEST 8: Strobe ===");
    send(7, 200, "Strobe rapide");
  }, 14000);

  setTimeout(() => {
    console.log("\n=== TEST 9: Extinction ===");
    send(7, 0, "Strobe off");
    send(6, 0, "Dimmer off");
    console.log("\n✅ Test terminé !");
    socket.disconnect();
    process.exit(0);
  }, 16000);
});

socket.on("connect_error", (err) => {
  console.error("❌ Erreur connexion:", err.message);
  process.exit(1);
});

socket.on("dmx_sync", (data) => {
  console.log(`🔄 Sync reçu: Univers ${data.universe} | Ch ${data.channel} = ${data.value}`);
});
