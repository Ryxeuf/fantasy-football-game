# 🚀 Guide de Développement - BlooBowl

Documentation complète pour les développeurs travaillant sur le projet BlooBowl.

## 📋 Table des matières

1. [Structure du projet](#-structure-du-projet)
2. [Configuration Git](#-configuration-git)
3. [Architecture technique](#-architecture-technique)
4. [Installation et setup](#-installation-et-setup)
5. [Commandes de développement](#-commandes-de-développement)
6. [Services et ports](#-services-et-ports)
7. [Résolution de problèmes](#-résolution-de-problèmes)
8. [Workflows GitHub](#-workflows-github)

## 🏗️ Structure du projet

```
fantasy-football-game/
├── 📁 apps/                    # Applications principales
│   ├── 🌐 web/                 # Next.js + Pixi.js (port 3100)
│   │   ├── .next/             # Build Next.js (exclu du Git)
│   │   ├── .turbo/            # Cache Turbo (exclu du Git)
│   │   ├── tsconfig.tsbuildinfo # Cache TS (exclu du Git)
│   │   ├── app/               # Code source Next.js
│   │   ├── package.json       # Dépendances web
│   │   ├── tsconfig.json      # Config TypeScript
│   │   ├── next.config.mjs    # Config Next.js
│   │   ├── tailwind.config.ts # Config Tailwind
│   │   └── postcss.config.mjs # Config PostCSS
│   │
│   ├── 📱 mobile/             # Expo + React Native (port 8082)
│   │   ├── .expo/             # Cache Expo (exclu du Git)
│   │   ├── app/               # Code source Expo Router
│   │   ├── package.json       # Dépendances mobile
│   │   ├── app.json           # Config Expo
│   │   ├── babel.config.js    # Config Babel
│   │   └── index.js           # Point d'entrée
│   │
│   └── 🖥️ server/             # Express + Boardgame.io (ports 8000, 8001)
│       ├── .turbo/            # Cache Turbo (exclu du Git)
│       ├── src/               # Code source serveur
│       ├── package.json       # Dépendances serveur
│       ├── tsconfig.json      # Config TypeScript
│       ├── Dockerfile         # Containerisation
│       └── types/             # Déclarations de types
│
├── 📦 packages/                # Packages partagés
│   ├── 🎮 game-engine/        # Logique de jeu déterministe
│   │   ├── src/               # Code source moteur
│   │   ├── package.json       # Dépendances moteur
│   │   └── tsconfig.json      # Config TypeScript
│   │
│   ├── 🎨 ui/                 # Composants Pixi.js partagés
│   │   ├── src/               # Composants React/Pixi
│   │   ├── package.json       # Dépendances UI
│   │   └── tsconfig.json      # Config TypeScript
│   │
│   └── ⚙️ config/             # Configuration partagée
│       ├── eslint.base.cjs    # Règles ESLint
│       └── tsconfig.base.json # Config TS de base
│
├── 🔧 Configuration
│   ├── .gitignore             # Exclusions Git (IMPORTANT!)
│   ├── turbo.json             # Configuration Turborepo
│   ├── pnpm-workspace.yaml    # Workspace pnpm
│   ├── package.json           # Scripts racine
│   └── docker-compose.yml     # Services Docker
│
├── 📚 Documentation
│   ├── README.md              # Guide utilisateur
│   └── DEVELOPMENT.md         # Ce document
│
├── 🔄 CI/CD
│   ├── .github/workflows/     # Workflows GitHub (désactivés)
│   └── setup_ci.sh           # Script de setup CI
│
└── 🗄️ Base de données
    └── prisma/                # Schéma Prisma (placeholder)
```

## 🔒 Configuration Git

### 📁 Fichiers exclus du versioning

Le `.gitignore` est configuré pour exclure tous les fichiers qui ne doivent **JAMAIS** être versionnés :

#### **Dépendances et cache :**

```gitignore
# Dependencies
node_modules
.pnp
.pnp.js

# Cache
.turbo
.cache
.parcel-cache
```

#### **Builds et compilations :**

```gitignore
# Builds
.next
dist
build
out
.expo

# TypeScript build info
*.tsbuildinfo
tsconfig.tsbuildinfo
```

#### **Environnement :**

```gitignore
# Environment
.env
.env.*
.env.local
.env.development
.env.test
.env.production
```

#### **IDE et OS :**

```gitignore
# IDE and Editor
.idea
.vscode
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
ehthumbs.db
Desktop.ini
```

### ⚠️ **IMPORTANT : Dossier `.turbo`**

- **NE JAMAIS VERSIONNER** le dossier `.turbo`
- Contient des caches temporaires spécifiques à l'environnement
- Régénéré automatiquement par Turborepo
- Peut causer des conflits Git et des problèmes de build

## 🏛️ Architecture technique

### **Stack technologique :**

| Composant        | Technologie            | Version          | Description           |
| ---------------- | ---------------------- | ---------------- | --------------------- |
| **Monorepo**     | Turborepo + pnpm       | 2.1.3            | Gestion des packages  |
| **Frontend Web** | Next.js + React        | 14.2.11 + 18.3.1 | Interface utilisateur |
| **Rendu 2D**     | Pixi.js                | 7.4.3            | Moteur graphique      |
| **Mobile**       | Expo + React Native    | 51.0.0 + 0.75.4  | Application mobile    |
| **Backend**      | Express + Boardgame.io | 4.21.2 + 0.50.2  | Serveur de jeu        |
| **TypeScript**   | TS                     | 5.9.2            | Typage statique       |
| **Styling**      | Tailwind CSS           | 3.4.10           | Framework CSS         |

### **Architecture des services :**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend Web  │    │   Application   │    │   Serveur de    │
│   (Next.js)     │    │   Mobile        │    │   Jeu           │
│   Port 3100     │    │   (Expo)        │    │   (Express)     │
│                 │    │   Port 8082     │    │   Port 8001     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │    Moteur de Jeu         │
                    │   (Boardgame.io)         │
                    │   Port 8000              │
                    └───────────────────────────┘
```

## 🚀 Installation et setup

### **Prérequis :**

- Node.js 18+ (recommandé 20+)
- pnpm 9.7.0+ (recommandé 10.15.0+)
- Git

### **Installation :**

```bash
# 1. Cloner le projet
git clone <repository-url>
cd fantasy-football-game

# 2. Installer pnpm globalement (si nécessaire)
corepack install -g pnpm@10.15.0

# 3. Installer les dépendances
pnpm install

# 4. Vérifier l'installation
pnpm typecheck
```

### **Configuration des variables d'environnement :**

```bash
# Créer .env.local à la racine
cp .env.example .env.local

# Éditer les variables nécessaires
nano .env.local
```

## 🛠️ Commandes de développement

### **Lancement des services :**

```bash
# Lancer tous les services en parallèle
pnpm dev

# Lancer individuellement
cd apps/web && pnpm dev        # Port 3100
cd apps/server && pnpm dev     # Ports 8000 + 8001
cd apps/mobile && pnpm dev     # Port 8082
```

### **Vérification et qualité :**

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

### **Tests :**

```bash
# Lancer tous les tests
pnpm test

# Tests avec continue (ignore les erreurs)
pnpm -w test
```

### **Gestion des packages :**

```bash
# Installer une dépendance dans un package spécifique
pnpm --filter @bb/web add <package>

# Installer une dépendance de développement
pnpm --filter @bb/ui add -D <package>

# Mettre à jour les dépendances
pnpm update
```

## 🌐 Services et ports

| Service          | Port | URL                            | Description                   | Statut   |
| ---------------- | ---- | ------------------------------ | ----------------------------- | -------- |
| **Web App**      | 3100 | `http://localhost:3100`        | Interface Next.js + Pixi.js   | ✅ Actif |
| **API Express**  | 8001 | `http://localhost:8001/health` | Endpoints API et health check | ✅ Actif |
| **Boardgame.io** | 8000 | `http://localhost:8000`        | Serveur de jeu principal      | ✅ Actif |
| **Expo Mobile**  | 8082 | `http://localhost:8082`        | Développement mobile          | ✅ Actif |

### **Vérification des services :**

```bash
# Vérifier le statut de tous les services
curl -s http://localhost:3100 | grep -o "BlooBowl"
curl -s http://localhost:8001/health
curl -s http://localhost:8000/ | head -1
curl -s http://localhost:8082 | grep -o "exposdk"
```

## 🚨 Résolution de problèmes

### **Ports déjà utilisés :**

```bash
# Identifier le processus utilisant un port
lsof -i :8000

# Libérer un port
lsof -ti :8000 | xargs -r kill -9

# Vérifier tous les processus
ps aux | grep -E "(next|tsx|expo)" | grep -v grep
```

### **Erreurs TypeScript :**

```bash
# Vérifier les types
pnpm typecheck

# Installer les dépendances manquantes
pnpm install --filter @bb/[package-name]

# Nettoyer le cache TypeScript
rm -rf **/*.tsbuildinfo
```

### **Serveur boardgame.io :**

```bash
# Vérifier le statut
curl http://localhost:8000/
curl http://localhost:8001/health

# Relancer le serveur
cd apps/server && pnpm dev

# Vérifier les logs
tail -f apps/server/src/index.ts
```

### **Problèmes Expo :**

```bash
# Nettoyer le cache Expo
cd apps/mobile && pnpm dev -- --clear

# Redémarrer sur un port spécifique
cd apps/mobile && pnpm dev -- --port 8082

# Ouvrir dans le simulateur
# Appuyez sur 'i' (iOS) ou 'a' (Android) dans le terminal Expo
```

### **Problèmes de dépendances :**

```bash
# Nettoyer le cache pnpm
pnpm store prune

# Réinstaller toutes les dépendances
rm -rf node_modules **/node_modules
pnpm install

# Vérifier les versions
pnpm list --depth=0
```

## 🔄 Workflows GitHub

### **État actuel :**

Tous les workflows GitHub Actions sont **temporairement désactivés** pour le développement local :

- ✅ `ci.yml` - CI principale
- ✅ `expo-eas.yml` - Builds EAS mobile
- ✅ `labeler.yml` - Labellisation PR
- ✅ `preview-vercel.yml` - Prévisualisations Vercel
- ✅ `release.yml` - Gestion des releases
- ✅ `docker-server.yml` - Build Docker serveur
- ✅ `e2e.yml` - Tests end-to-end

### **Réactivation :**

Pour réactiver les workflows, décommenter les déclencheurs dans chaque fichier :

```yaml
# Dans chaque .github/workflows/*.yml
on:
  # Décommenter ces lignes :
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

  # Et supprimer :
  workflow_dispatch:
```

## 📱 Développement mobile

### **Installation d'Expo Go :**

1. Installez **Expo Go** sur votre téléphone
2. Scannez le QR code affiché dans le terminal
3. L'application se chargera directement sur votre appareil

### **Commandes Expo utiles :**

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

### **Développement avec simulateur :**

```bash
# iOS Simulator (macOS uniquement)
cd apps/mobile && pnpm dev
# Puis appuyer sur 'i'

# Android Emulator
cd apps/mobile && pnpm dev
# Puis appuyer sur 'a'
```

## 🎮 Moteur de jeu

### **Caractéristiques :**

- **Plateau** : 26 × 15 cases (style Blood Bowl)
- **Mouvements** : 1 case orthogonale par tour
- **Actions** : MOVE, END_TURN
- **RNG** : Déterministe (mulberry32)
- **Équipes** : A (bleu) vs B (rouge)

### **Structure des types :**

```typescript
export interface GameState {
  width: number;
  height: number;
  players: Player[];
  ball?: Position;
  currentPlayer: TeamId;
  turn: number;
}

export type Move =
  | { type: "MOVE"; playerId: string; to: Position }
  | { type: "END_TURN" };
```

### **API du moteur :**

```typescript
// Setup d'une nouvelle partie
const state = setup("seed-123");

// Obtenir les mouvements légaux
const legalMoves = getLegalMoves(state);

// Appliquer un mouvement
const newState = applyMove(state, move, rng);
```

## 🔧 Configuration avancée

### **Turborepo :**

```json
// turbo.json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    }
  }
}
```

### **TypeScript :**

```json
// packages/config/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "jsx": "react-jsx"
  }
}
```

### **ESLint :**

```javascript
// packages/config/eslint.base.cjs
module.exports = {
  extends: ["@remix-run/eslint-config"],
  rules: {
    // Règles personnalisées
  },
};
```

## 📚 Ressources utiles

### **Documentation officielle :**

- [Turborepo](https://turbo.build/repo/docs)
- [Next.js](https://nextjs.org/docs)
- [Expo](https://docs.expo.dev/)
- [Boardgame.io](https://boardgame.io/documentation/)
- [Pixi.js](https://pixijs.io/docs/)

### **Outils de développement :**

- [TypeScript](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [pnpm](https://pnpm.io/fr/)

### **Communauté :**

- [Discord Turborepo](https://discord.gg/V6y4Xr6N)
- [Expo Discord](https://discord.gg/expo)
- [Next.js Discord](https://discord.gg/nextjs)

---

## 📝 Notes de développement

### **Bonnes pratiques :**

1. **Toujours** lancer `pnpm typecheck` avant de committer
2. **Ne jamais** committer de fichiers `.turbo` ou de cache
3. **Utiliser** les scripts définis dans `package.json`
4. **Tester** sur plusieurs navigateurs et appareils
5. **Documenter** les nouvelles fonctionnalités

### **Workflow de développement :**

```bash
# 1. Vérifier les types
pnpm typecheck

# 2. Lancer les services
pnpm dev

# 3. Développer et tester
# 4. Linter et formater
pnpm lint && pnpm format

# 5. Vérifier les types à nouveau
pnpm typecheck

# 6. Committer
git add . && git commit -m "feat: nouvelle fonctionnalité"
```

---

**Dernière mise à jour :** 28 août 2025  
**Version du document :** 1.0.0  
**Maintenu par :** Équipe BlooBowl
