# 🏈 BlooBowl - Makefile

Ce Makefile contient toutes les commandes utiles pour développer le jeu Blood Bowl.

## 🚀 Démarrage rapide

```bash
# Setup complet du projet
make setup

# Démarrage rapide (clean + install + dev)
make quick-start

# Voir toutes les commandes disponibles
make help
```

## 📋 Commandes principales

### 🛠️ Développement

| Commande | Description |
|----------|-------------|
| `make dev` | Démarre tout l'environnement (web + mobile + server + engine) |
| `make dev-web` | Démarre seulement l'application web (Next.js) |
| `make dev-mobile` | Démarre seulement l'application mobile (Expo) |
| `make dev-server` | Démarre seulement le serveur (Express + boardgame.io) |
| `make dev-engine` | Démarre seulement le moteur de jeu en mode watch |
| `make restart` | Redémarre tout l'environnement (kill ports + dev) |

### 🔨 Build et production

| Commande | Description |
|----------|-------------|
| `make build` | Build toutes les applications |
| `make build-web` | Build seulement l'application web |
| `make build-server` | Build seulement le serveur |

### 🧹 Nettoyage

| Commande | Description |
|----------|-------------|
| `make clean` | Nettoie tous les fichiers de build et cache |
| `make clean-cache` | Nettoie seulement les caches (sans supprimer node_modules) |

### 🔍 Qualité du code

| Commande | Description |
|----------|-------------|
| `make lint` | Lance le linting sur tout le projet |
| `make format` | Formate le code avec Prettier |
| `make typecheck` | Vérifie les types TypeScript |
| `make test` | Lance tous les tests |
| `make validate` | Valide le code (types + linting) |
| `make ci` | Pipeline CI complet |

### 🐳 Docker

| Commande | Description |
|----------|-------------|
| `make docker-up` | Démarre les services Docker |
| `make docker-down` | Arrête les services Docker |
| `make docker-logs` | Affiche les logs des services Docker |
| `make docker-build` | Build les images Docker |
| `make docker-restart` | Redémarre les services Docker |

### 🔧 Utilitaires

| Commande | Description |
|----------|-------------|
| `make ports` | Affiche les ports utilisés par les services |
| `make status` | Affiche le statut des services |
| `make kill-ports` | Tue les processus utilisant les ports du projet |
| `make install` | Installe toutes les dépendances |

### 📝 Versioning

| Commande | Description |
|----------|-------------|
| `make changeset` | Crée un nouveau changeset |
| `make changeset-version` | Met à jour les versions avec les changesets |

## 🌐 Ports des services

- **Web (Next.js)**: http://localhost:3100
- **Mobile (Expo)**: http://localhost:8081
- **Server (boardgame.io)**: http://localhost:8000
- **API (Express)**: http://localhost:8001
- **Docker Web**: http://localhost:8200

## 🆘 Aide contextuelle

```bash
# Aide générale
make help

# Aide développement
make help-dev

# Aide Docker
make help-docker
```

## 🔄 Workflows courants

### Développement quotidien
```bash
# Démarrage rapide
make quick-start

# Vérifier le statut
make status

# Redémarrer si nécessaire
make restart
```

### Debug et résolution de problèmes
```bash
# Vérifier les ports
make ports

# Vérifier le statut des services
make status

# Libérer les ports si conflit
make kill-ports

# Nettoyer les caches
make clean-cache

# Redémarrer
make dev
```

### Avant un commit
```bash
# Valider le code
make validate

# Ou pipeline complet
make ci
```

### Déploiement Docker
```bash
# Build et démarrage
make docker-build
make docker-up

# Voir les logs
make docker-logs

# Arrêter
make docker-down
```

## 🎯 Conseils d'utilisation

1. **Première utilisation** : `make setup`
2. **Développement quotidien** : `make dev`
3. **Problèmes de ports** : `make kill-ports` puis `make dev`
4. **Problèmes de cache** : `make clean-cache` puis `make dev`
5. **Avant commit** : `make validate`
6. **Déploiement** : `make docker-up`

## 🏗️ Architecture du projet

```
BlooBowl/
├── apps/
│   ├── web/          # Application Next.js (port 3100)
│   ├── mobile/       # Application Expo (port 8081)
│   └── server/       # Serveur Express + boardgame.io (ports 8000, 8001)
├── packages/
│   ├── game-engine/  # Moteur de jeu TypeScript
│   └── ui/           # Composants React partagés
└── Makefile          # Ce fichier
```

## 🐛 Résolution de problèmes

### Erreur "port already in use"
```bash
make kill-ports
make dev
```

### Erreur React Client Manifest
```bash
make clean-cache
make dev-web
```

### Problèmes de dépendances
```bash
make clean
make install
make dev
```

### Services Docker qui ne démarrent pas
```bash
make docker-down
make docker-build
make docker-up
```
