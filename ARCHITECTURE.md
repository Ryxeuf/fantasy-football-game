# 🏗️ Architecture du Projet BlooBowl

## Vue d'ensemble

Le projet BlooBowl est organisé en monorepo avec une architecture modulaire claire et bien structurée.

## 📁 Structure des Dossiers

```
fantasy-football-game/
├── 📁 apps/                    # Applications principales
│   ├── 🌐 web/                 # Next.js + Pixi.js (port 3100)
│   │   ├── app/               # Code source Next.js
│   │   ├── package.json       # Dépendances web
│   │   └── ...
│   │
│   ├── 📱 mobile/             # Expo + React Native (port 8082)
│   │   ├── app/               # Code source Expo Router
│   │   ├── package.json       # Dépendances mobile
│   │   └── ...
│   │
│   └── 🖥️ server/             # Express + Boardgame.io (ports 8000, 8001)
│       ├── src/               # Code source serveur
│       │   ├── routes/        # Routes API
│       │   ├── middleware/    # Middleware Express
│       │   └── types/         # Types TypeScript
│       └── ...
│
├── 📦 packages/                # Packages partagés
│   ├── 🎮 game-engine/        # Logique de jeu déterministe
│   │   ├── src/
│   │   │   ├── core/          # Types et état central
│   │   │   │   ├── types.ts
│   │   │   │   ├── game-state.ts
│   │   │   │   └── boardgame-io.ts
│   │   │   ├── actions/       # Actions et mouvements
│   │   │   │   ├── actions.ts
│   │   │   │   └── action-types.test.ts
│   │   │   ├── mechanics/     # Mécaniques de jeu
│   │   │   │   ├── movement.ts
│   │   │   │   ├── blocking.ts
│   │   │   │   ├── ball.ts
│   │   │   │   └── *.test.ts
│   │   │   ├── utils/         # Utilitaires
│   │   │   │   ├── rng.ts
│   │   │   │   ├── dice.ts
│   │   │   │   ├── logging.ts
│   │   │   │   └── dev.ts
│   │   │   ├── tests/         # Tests d'intégration
│   │   │   │   ├── stress-test.test.ts
│   │   │   │   ├── full-game-simulation.test.ts
│   │   │   │   └── complete-game-scenario.test.ts
│   │   │   └── index.ts       # Point d'entrée principal
│   │   └── ...
│   │
│   ├── 🎨 ui/                 # Composants Pixi.js partagés
│   │   ├── src/
│   │   │   ├── board/         # Composants de plateau
│   │   │   │   ├── PixiBoard.tsx
│   │   │   │   └── PixiBoard.native.tsx
│   │   │   ├── components/    # Composants UI
│   │   │   │   ├── PlayerDetails.tsx
│   │   │   │   ├── GameScoreboard.tsx
│   │   │   │   ├── GameLog.tsx
│   │   │   │   └── BlockDiceIcon.tsx
│   │   │   ├── popups/        # Popups et modales
│   │   │   │   ├── ActionPickerPopup.tsx
│   │   │   │   ├── BlockChoicePopup.tsx
│   │   │   │   ├── DiceResultPopup.tsx
│   │   │   │   ├── PushChoicePopup.tsx
│   │   │   │   └── FollowUpChoicePopup.tsx
│   │   │   ├── tests/         # Tests des composants
│   │   │   │   └── BlockDiceIcon.test.tsx
│   │   │   └── index.tsx      # Point d'entrée principal
│   │   └── ...
│   │
│   └── ⚙️ config/             # Configuration partagée
│       ├── eslint.base.cjs    # Règles ESLint
│       └── tsconfig.base.json # Config TS de base
│
├── 📚 data/                   # Règles et données du jeu
│   ├── the-rules-of-blood-bowl.md
│   ├── teams.md
│   ├── skills.md
│   └── ...
│
└── 🔧 Configuration
    ├── .gitignore
    ├── turbo.json
    ├── pnpm-workspace.yaml
    ├── package.json
    └── docker-compose.yml
```

## 🎯 Principes d'Organisation

### 1. **Séparation des Responsabilités**
- **`core/`** : Types fondamentaux et gestion d'état
- **`actions/`** : Actions et mouvements des joueurs
- **`mechanics/`** : Mécaniques de jeu (mouvement, blocage, balle)
- **`utils/`** : Fonctions utilitaires (dés, RNG, logging)
- **`tests/`** : Tests d'intégration et de performance

### 2. **Organisation par Fonctionnalité (UI)**
- **`board/`** : Composants de plateau de jeu
- **`components/`** : Composants UI réutilisables
- **`popups/`** : Popups et modales interactives
- **`tests/`** : Tests des composants

### 3. **Structure Modulaire**
- Chaque package a son propre `index.ts` pour les exports
- Imports relatifs clairs entre les modules
- Séparation claire entre code de production et tests

## 🔄 Flux de Données

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend Web  │    │   Application   │    │   Serveur de    │
│   (Next.js)     │    │   Mobile        │    │   Jeu           │
│   Port 3100     │    │   (Expo)        │    │   (Express)     │
│                 │    │   Port 8082     │    │   Port 8001     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────┴─────────────┐
                    │                           │
            ┌───────▼───────┐         ┌────────▼────────┐
            │  @bb/ui       │         │ @bb/game-engine │
            │  Composants   │         │  Logique de jeu │
            │  Pixi.js      │         │  Déterministe   │
            └───────────────┘         └─────────────────┘
```

## 📋 Avantages de cette Architecture

### ✅ **Maintenabilité**
- Code organisé par responsabilité
- Imports clairs et explicites
- Séparation des préoccupations

### ✅ **Évolutivité**
- Structure modulaire facilement extensible
- Packages indépendants
- Tests organisés par fonctionnalité

### ✅ **Lisibilité**
- Dossiers avec des noms explicites
- Structure logique et intuitive
- Documentation intégrée

### ✅ **Réutilisabilité**
- Composants UI partagés
- Logique de jeu centralisée
- Configuration commune

## 🧪 Tests et Qualité

- **161 tests** passent avec succès
- Tests organisés par fonctionnalité
- Tests d'intégration et de performance
- Couverture de code complète

## 🚀 Commandes de Développement

```bash
# Lancer tous les tests
pnpm test

# Lancer les tests du game-engine
cd packages/game-engine && pnpm test

# Lancer l'application web
cd apps/web && pnpm dev

# Lancer l'application mobile
cd apps/mobile && pnpm start

# Lancer le serveur
cd apps/server && pnpm dev
```

Cette architecture offre une base solide pour le développement et la maintenance du projet BlooBowl, avec une séparation claire des responsabilités et une organisation logique des fichiers.
