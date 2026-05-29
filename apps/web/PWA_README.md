# Glow Logic - Configuration PWA

## 🎯 Objectif

Transformer Glow Logic en Progressive Web App (PWA) pour une expérience native sur mobile et desktop.

## ✅ Fonctionnalités PWA

- **Installation** : Installable sur mobile et desktop
- **Mode hors ligne** : Cache des pages et ressources
- **Barre d'applications** : Thème cyan personnalisé
- **Raccourcis** : Accès rapide depuis l'écran d'accueil
- **Responsive** : Optimisé pour toutes les tailles d'écran

## 📁 Fichiers créés

```
apps/web/
├── public/
│   ├── manifest.json          # Manifest PWA
│   ├── sw.js                  # Service Worker
│   ├── icons/                 # Icônes PWA
│   │   ├── icon.svg           # Source SVG
│   │   ├── icon-72x72.png
│   │   ├── icon-96x96.png
│   │   ├── icon-128x128.png
│   │   ├── icon-144x144.png
│   │   ├── icon-152x152.png
│   │   ├── icon-192x192.png
│   │   ├── icon-384x384.png
│   │   └── icon-512x512.png
│   └── generate-icons.html    # Outil de génération d'icônes
├── next.config.ts             # Config PWA ajoutée
└── src/app/layout.tsx         # Métadonnées PWA
```

## 🚀 Installation

### 1. Générer les icônes

Ouvrir `http://localhost:3000/generate-icons.html` dans votre navigateur:

1. Cliquez sur "Generate Icons"
2. Cliquez sur "Download All"
3. Copiez les fichiers PNG dans `public/icons/`

### 2. Redémarrer le serveur

```bash
npm run dev
```

### 3. Installer la PWA

**Sur mobile (Chrome/Android):**
1. Ouvrir `http://localhost:3000`
2. Cliquer sur "Ajouter à l'écran d'accueil"
3. Confirmer l'installation

**Sur desktop (Chrome/Edge):**
1. Ouvrir `http://localhost:3000`
2. Cliquer sur l'icône d'installation dans la barre d'adresse
3. Confirmer l'installation

## ⚙️ Configuration

### Métadonnées PWA

```typescript
// layout.tsx
export const metadata: Metadata = {
  title: "Glow Logic - Smart Stage OS",
  description: "Système de contrôle d'éclairage DMX No-Code",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Glow Logic",
  },
};
```

### Service Worker

Le service worker (`sw.js`) gère :
- Le cache des pages statiques
- La mise en cache des images
- Le mode hors ligne
- La synchronisation des commandes DMX

### Runtime Caching

```typescript
// next.config.ts
runtimeCaching: [
  {
    urlPattern: /^https:\/\/localhost:3005\/api\/.*/i,
    handler: "NetworkFirst",
    options: {
      cacheName: "api-cache",
      expiration: { maxEntries: 100, maxAgeSeconds: 3600 }
    }
  }
]
```

## 🎨 Personnalisation

### Thème

Modifier la couleur thème dans `manifest.json`:

```json
{
  "theme_color": "#06b6d4",
  "background_color": "#0a0c10"
}
```

### Icônes

Remplacer les icônes dans `public/icons/` par vos propres images.

Tailles requises : 72, 96, 128, 144, 152, 192, 384, 512 pixels.

### Raccourcis

Modifier les raccourcis dans `manifest.json`:

```json
{
  "shortcuts": [
    {
      "name": "Smart Mode",
      "url": "/smart"
    }
  ]
}
```

## 🐛 Dépannage

### La PWA ne s'installe pas

1. Vérifiez que le service worker est chargé (onglet Application > Service Workers)
2. Vérifiez que le manifest.json est valide
3. Assurez-vous d'être en HTTPS ou localhost

### Le mode hors ligne ne fonctionne pas

1. Vérifiez les caches dans Application > Cache Storage
2. Testez en désactivant le réseau

### Les icônes ne s'affichent pas

1. Vérifiez que les fichiers PNG existent dans `public/icons/`
2. Vérifiez les chemins dans `manifest.json`

## 📚 Ressources

- [PWA de A à Z](https://web.dev/articles/pwa-checklist)
- [next-pwa Documentation](https://github.com/shadowwalker/next-pwa)
- [Manifest PWA](https://developer.mozilla.org/en-US/docs/Web/Manifest)
