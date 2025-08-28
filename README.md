# 🏈 BlooBowl - Fantasy Football Game

Jeu de football américain tour-par-tour avec interface web (Next.js + Pixi.js) et mobile (Expo + React Native).

## 🚀 Installation

### Prérequis
- Node.js 18+ 
- pnpm 9.7.0+
- Expo CLI (pour le développement mobile)

### Installation des dépendances
```bash
# Installation globale de pnpm si nécessaire
corepack install -g pnpm@10.15.0

# Installation des dépendances du projet
pnpm install
```

## 🛠️ Commandes utiles

### Développement
```bash
# Lancer tous les services en développement
pnpm dev

# Lancer seulement l'application web
cd apps/web && pnpm dev

# Lancer seulement le serveur
cd apps/server && pnpm dev

# Lancer seulement l'application mobile
cd apps/mobile && pnpm dev -- --port 8082
```

### Vérification et qualité
```bash
# Vérifier les types TypeScript
pnpm typecheck

# Linter le code
pnpm lint

# Formater le code
pnpm format

# Build de production
pnpm build
```

### Tests
```bash
# Lancer tous les tests
pnpm test

# Tests avec continue (ignore les erreurs)
pnpm -w test
```

## 🌐 Services et ports

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Web App** | 3000 | `http://localhost:3000` | Interface Next.js + Pixi.js |
| **API Express** | 8001 | `http://localhost:8001/health` | Endpoints API et health check |
| **Boardgame.io** | 8000 | `http://localhost:8000` | Serveur de jeu principal |
| **Expo Mobile** | 8082 | `http://localhost:8082` | Développement mobile |

## 📱 Développement mobile

### Installation d'Expo Go
1. Installez **Expo Go** sur votre téléphone
2. Scannez le QR code affiché dans le terminal
3. L'application se chargera directement sur votre appareil

### Commandes Expo utiles
```bash
# Démarrer Expo sur un port spécifique
cd apps/mobile && pnpm dev -- --port 8082

# Ouvrir dans le simulateur iOS
# Appuyez sur 'i' dans le terminal Expo

# Ouvrir dans l'émulateur Android  
# Appuyez sur 'a' dans le terminal Expo

# Ouvrir dans le navigateur web
# Appuyez sur 'w' dans le terminal Expo
```

## 🏗️ Architecture

```
fantasy-football-game/
├── apps/
│   ├── web/          # Next.js + Pixi.js (port 3000)
│   ├── mobile/       # Expo + React Native (port 8082)
│   └── server/       # Express + Boardgame.io (ports 8000, 8001)
├── packages/
│   ├── ui/           # Composants Pixi.js partagés
│   ├── game-engine/  # Logique de jeu déterministe
│   └── config/       # Configuration TypeScript/ESLint
└── prisma/           # Schéma de base de données
```

## 🎮 Moteur de jeu

- **Plateau** : 26 × 15 cases (style Blood Bowl)
- **Mouvements** : 1 case orthogonale par tour
- **Actions** : MOVE, END_TURN
- **RNG** : Déterministe (mulberry32)
- **Équipes** : A (bleu) vs B (rouge)

## 🔧 Développement

### Structure des packages
- `@bb/web` : Application web Next.js
- `@bb/mobile` : Application mobile Expo
- `@bb/server` : Serveur de jeu et API
- `@bb/ui` : Composants Pixi.js partagés
- `@bb/game-engine` : Logique de jeu

### Scripts disponibles
```bash
# Gestion des changements
pnpm changeset          # Créer un changelog
pnpm changeset:version  # Versionner les packages
pnpm changeset:publish  # Publier (désactivé en privé)
```

## 🚨 Résolution de problèmes

### Ports déjà utilisés
```bash
# Libérer un port
lsof -ti :8000 | xargs -r kill -9

# Vérifier les processus
ps aux | grep -E "(next|tsx|expo)" | grep -v grep
```

### Erreurs TypeScript
```bash
# Vérifier les types
pnpm typecheck

# Installer les dépendances manquantes
pnpm install --filter @bb/[package-name]
```

### Serveur boardgame.io
```bash
# Vérifier le statut
curl http://localhost:8000/
curl http://localhost:8001/health

# Relancer le serveur
cd apps/server && pnpm dev
```

## 📚 Technologies utilisées

- **Frontend** : Next.js 14, React 18, Pixi.js 7
- **Mobile** : Expo 51, React Native 0.75
- **Backend** : Express, Boardgame.io 0.50
- **Build** : Turbo, pnpm, TypeScript
- **Styling** : Tailwind CSS

## 🤝 Contribution

1. Fork le projet
2. Créez une branche feature (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📄 Licence

Ce projet est privé. Tous droits réservés.

---

**Note** : Les workflows GitHub Actions sont temporairement désactivés pour le développement local.
