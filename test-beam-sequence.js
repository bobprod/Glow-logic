const { io } = require("socket.io-client");

const socket = io("http://localhost:3005", {
  transports: ["websocket", "polling"],
  timeout: 5000,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

socket.on("connect", async () => {
  console.log("✅ Connecté au serveur Glow Logic");
  console.log("🎬 Test de l'éclairage BEAM 12ch");
  console.log("📡 Port COM5: Connecté");
  console.log("");

  const u = 1; // universe

  // Helper
  const send = (ch, val, desc) => {
    socket.emit("dmx_update", { universe: u, channel: ch, value: val });
    console.log(`📡 [DMX] Univers ${u} | Canal ${ch} (${desc}) = ${val}`);
  };

  // TEST 1: Allumage initial
  console.log("=== TEST 1: ALLUMAGE ===");
  send(6, 255, "Dimmer ON");
  send(1, 127, "Pan centre");
  send(3, 127, "Tilt centre");
  await sleep(2000);

  // TEST 2: Pan gauche → droite
  console.log("\n=== TEST 2: PAN SCAN ===");
  send(1, 0, "Pan GAUCHE");
  await sleep(1500);
  send(1, 255, "Pan DROIT");
  await sleep(1500);
  send(1, 127, "Pan CENTRE");
  await sleep(1000);

  // TEST 3: Tilt haut → bas
  console.log("\n=== TEST 3: TILT SCAN ===");
  send(3, 0, "Tilt HAUT");
  await sleep(1500);
  send(3, 255, "Tilt BAS");
  await sleep(1500);
  send(3, 127, "Tilt CENTRE");
  await sleep(1000);

  // TEST 4: Strobe
  console.log("\n=== TEST 4: STROBE ===");
  send(7, 220, "Strobe RAPIDE");
  await sleep(2000);
  send(7, 0, "Strobe OFF");
  await sleep(1000);

  // TEST 5: Gobo
  console.log("\n=== TEST 5: GOBO ===");
  send(9, 80, "Gobo 1");
  await sleep(1500);
  send(9, 160, "Gobo 2");
  await sleep(1500);
  send(9, 0, "Gobo OFF");
  await sleep(1000);

  // TEST 6: Couleur
  console.log("\n=== TEST 6: COULEUR ===");
  send(8, 30, "Couleur 1");
  await sleep(1500);
  send(8, 90, "Couleur 2");
  await sleep(1500);
  send(8, 150, "Couleur 3");
  await sleep(1500);

  // TEST 7: Mouvement circulaire
  console.log("\n=== TEST 7: MOUVEMENT CIRCULAIRE ===");
  for (let i = 0; i < 3; i++) {
    send(1, 80, "Pan");
    send(3, 80, "Tilt");
    await sleep(400);
    send(1, 180, "Pan");
    send(3, 80, "Tilt");
    await sleep(400);
    send(1, 180, "Pan");
    send(3, 180, "Tilt");
    await sleep(400);
    send(1, 80, "Pan");
    send(3, 180, "Tilt");
    await sleep(400);
  }
  send(1, 127, "Pan centre");
  send(3, 127, "Tilt centre");
  await sleep(1000);

  // TEST 8: Extinction
  console.log("\n=== TEST 8: EXTINCTION ===");
  send(6, 0, "Dimmer OFF");
  send(8, 0, "Couleur OFF");
  send(9, 0, "Gobo OFF");

  console.log("\n✅ TEST TERMINÉ !");
  console.log("Le beam devrait avoir bougé selon la séquence ci-dessus.");
  socket.disconnect();
  process.exit(0);
});

socket.on("connect_error", (err) => {
  console.error("❌ Erreur connexion:", err.message);
  process.exit(1);
});
