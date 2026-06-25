# Guide de l'Architecture & Résolution DMX — Glow Logic

Ce document sert de mémoire technique expliquant le fonctionnement de la chaîne DMX physique, les problèmes identifiés et les solutions apportées.

---

## 1. Le Problème Initial : Pourquoi rien ne fonctionnait depuis l'IHM ?

Bien que l'envoi direct de trames DMX via un script de test indépendant fonctionnait, l'interaction depuis l'interface Web (Smart Dashboard, faders de fixtures, blackout, etc.) n'avait aucun effet physique sur le projecteur Beam. Quatre causes distinctes ont été identifiées :

### A. Décalage d'adresse de fixture (SQLite)
* **Le problème** : La fixture de test (Beam 12 canaux) était configurée dans la base de données SQLite avec une adresse DMX de départ (`start_address`) positionnée à **12** au lieu de **1**.
* **L'impact** : Les curseurs de la vue creator/fixtures ciblaient les canaux 12 à 23. Le Beam (physiquement adressé sur le canal 1) ne recevait aucun ordre sur ses canaux 1 à 12.
* **La solution** : Correction directe dans la base de données SQL pour caler l'adresse de départ de la fixture sur **1**.

### B. Buffering d'entrée dans le pont Python (La cause principale)
* **Le problème** : Dans `dmx_bridge.py`, la lecture des commandes JSON sur l'entrée standard utilisait l'itérateur par défaut de Python : `for line in sys.stdin:`.
* **L'impact** : En Python 3, la boucle `for line in sys.stdin` utilise un tampon interne (buffer d'E/S) d'environ 4 Ko ou 8 Ko. Le script Python bloquait en attente de remplir ce tampon avant de traiter les lignes. Les commandes envoyées au compte-gouttes depuis l'IHM restaient bloquées dans ce tampon. Lors des scripts de test, la fermeture du socket ou la fin du processus vidait le tampon, donnant l'impression que seul le script de test marchait.
* **La solution** :
  1. Modification de `dmx_bridge.py` pour lire l'entrée standard ligne par ligne avec `sys.stdin.readline()`, qui ne subit pas ce buffering et retourne immédiatement dès qu'un caractère `\n` est envoyé.
  2. Ajout de l'argument `-u` (unbuffered) lors du `spawn` du processus Python dans le serveur Node.js (`pythonDmx.ts`) pour désactiver tout buffering système sur `stdout` et `stderr`.

### C. Événements de sockets obsolètes / non-alignés
* **Le problème** : Les boutons généraux comme le Blackout ou le tap BPM du menu supérieur envoyaient un événement générique obsolète nommé `osc_send` contenant des adresses OSC brutes destinées à un moteur QLC+ headless. Le serveur n'écoutait pas cet événement car QLC+ est désactivé au profit du pont Python direct.
* **La solution** : Remplacement des émissions côté frontend pour envoyer directement les événements sémantiques compris par le serveur (`smart:blackout` et `smart:bpm`).

### D. Désalignement d'état de scène active (Zustand)
* **Le problème** : La vue `SmartDashboard.tsx` utilisait l'identifiant local de la base de données (`pad.id`) pour marquer une scène active, tandis que le composant de bouton `Pad.tsx` et le listener MIDI `MidiListener.tsx` utilisaient le numéro de canal virtuel (`pad.qlcWidget`). Ce décalage empêchait la synchronisation visuelle et causait des doubles-clics involontaires.
* **La solution** : Unification complète de l'état `smartActiveScene` pour utiliser exclusivement `pad.qlcWidget` partout.

---

## 2. Fonctionnement de la Chaîne DMX (Pipeline)

Le flux de données en temps réel est structuré ainsi :

```
[IHM Frontend (Next.js - :3000)]
      │
      ▼  (socket.emit 'dmx_update' ou 'smart:trigger_scene')
[Serveur API Node.js (Express - :3005)]
      │
      ▼  (pythonDmx.setChannel)
[Processus Enfant Python (dmx_bridge.py)]  <-- Communication via Stdin (JSON + \n)
      │
      ▼  (SetCommBreak / ClearCommBreak via Windows kernel32.dll)
[Port COM5 (Interface Doremidi UTD-10)]
      │
      ▼  (Câble XLR DMX512 @ 250000 baud, 8N2)
[Beam 12 canaux physique]
```

---

## 3. Maintenance & Résolution d'Incidents

### Comment redémarrer après modification du backend ?
Le serveur de développement backend utilise `ts-node index.ts` sans watcher automatique. Si vous modifiez du code sous `apps/server`, vous devez arrêter et relancer le serveur manuellement :
1. Arrêtez le serveur dans votre terminal (`Ctrl+C` ou via le gestionnaire de tâches).
2. Relancez-le en exécutant `npm run dev` dans le répertoire `apps/server`.

### Comment tester rapidement la chaîne DMX ?
Vous pouvez lancer le script de diagnostic dans la racine du projet :
```bash
node test-beam-sequence.js
```
Ce script envoie une séquence de mouvements, de couleurs et d'intensité directement sur le port pour valider que le pont Python et l'interface USB fonctionnent.
