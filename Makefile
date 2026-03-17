# BlooBowl - Makefile
# Commandes utiles pour le développement du jeu Blood Bowl

.PHONY: help install dev dev-web dev-mobile dev-server dev-engine build clean lint format typecheck test docker docker-up docker-down docker-logs setup db-seed db-reset-pg db-migrate db-migrate-deploy db-migrate-status db-migrate-data deploy deploy-no-cache maintenance-on maintenance-off maintenance-status

# Variables
PNPM := pnpm
DOCKER_COMPOSE := docker compose
WEB_PORT := 3100
MOBILE_PORT := 8081
SERVER_PORT := 8200
API_PORT := 8201

# Aide par défaut
help: ## Affiche cette aide
	@echo "🏈 BlooBowl - Commandes disponibles:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Installation et setup
install: ## Installe toutes les dépendances
	@echo "📦 Installation des dépendances..."
	$(PNPM) install

setup: install ## Setup complet du projet
	@echo "🚀 Setup complet du projet BlooBowl..."
	@echo "✅ Dépendances installées"
	@echo "✅ Projet prêt pour le développement"
	@echo ""
	@echo "Commandes utiles:"
	@echo "  make dev        - Démarrer tout l'environnement de développement"
	@echo "  make dev-web    - Démarrer seulement l'app web"
	@echo "  make dev-mobile - Démarrer seulement l'app mobile"
	@echo "  make help       - Voir toutes les commandes"
	@echo "  make db-reset-pg - Réinitialiser Postgres (push + generate + seed)"

# Développement
dev: ## Démarre tout l'environnement de développement (web + mobile + server + engine)
	@echo "🚀 Démarrage de l'environnement de développement complet..."
	$(PNPM) run dev

dev-web: ## Démarre seulement l'application web (Next.js)
	@echo "🌐 Démarrage de l'application web..."
	cd apps/web && $(PNPM) run dev

dev-mobile: ## Démarre seulement l'application mobile (Expo)
	@echo "📱 Démarrage de l'application mobile..."
	cd apps/mobile && $(PNPM) run dev

dev-server: ## Démarre seulement le serveur (Express + boardgame.io)
	@echo "🖥️  Démarrage du serveur..."
	cd apps/server && $(PNPM) run dev

dev-engine: ## Démarre seulement le moteur de jeu en mode watch
	@echo "🎮 Démarrage du moteur de jeu..."
	cd packages/game-engine && $(PNPM) run dev

# Build et production
build: ## Build toutes les applications
	@echo "🔨 Build de toutes les applications..."
	$(PNPM) run build

build-web: ## Build seulement l'application web
	@echo "🔨 Build de l'application web..."
	cd apps/web && $(PNPM) run build

build-server: ## Build seulement le serveur
	@echo "🔨 Build du serveur..."
	cd apps/server && $(PNPM) run build

# Qualité du code
lint: ## Lance le linting sur tout le projet
	@echo "🔍 Linting du projet..."
	$(PNPM) run lint

format: ## Formate le code avec Prettier
	@echo "✨ Formatage du code..."
	$(PNPM) run format

typecheck: ## Vérifie les types TypeScript
	@echo "🔍 Vérification des types TypeScript..."
	$(PNPM) run typecheck

test: ## Lance tous les tests
	@echo "🧪 Lancement des tests..."
	$(PNPM) run test

# Nettoyage
clean: ## Nettoie tous les fichiers de build et cache
	@echo "🧹 Nettoyage des fichiers de build et cache..."
	@echo "Suppression des dossiers .next..."
	@find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "Suppression des dossiers node_modules..."
	@find . -name "node_modules" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "Suppression des fichiers .tsbuildinfo..."
	@find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
	@echo "Suppression des dossiers .turbo..."
	@find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "Suppression des dossiers .expo..."
	@find . -name ".expo" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Nettoyage terminé"

clean-cache: ## Nettoie seulement les caches (sans supprimer node_modules)
	@echo "🧹 Nettoyage des caches..."
	@find . -name ".next" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true
	@find . -name ".turbo" -type d -exec rm -rf {} + 2>/dev/null || true
	@find . -name ".expo" -type d -exec rm -rf {} + 2>/dev/null || true
	@echo "✅ Caches nettoyés"

# Docker
docker: docker-up ## Alias pour docker-up

up: ## Démarre les services Docker
	@echo "🐳 Démarrage des services Docker..."
	$(DOCKER_COMPOSE) up -d

down: ## Arrête les services Docker
	@echo "🐳 Arrêt des services Docker..."
	$(DOCKER_COMPOSE) down

logs: ## Affiche les logs des services Docker
	@echo "📋 Logs des services Docker..."
	$(DOCKER_COMPOSE) logs -f

docker-build: ## Build les images Docker
	@echo "🔨 Build des images Docker..."
	$(DOCKER_COMPOSE) build

restart: ## Redémarre l'environnement de développement (kill dev + dev)
	@echo "🔄 Redémarrage de l'environnement de développement..."
	@echo "1️⃣ Arrêt des processus de développement..."
	@$(MAKE) kill-dev-ports
	@echo "2️⃣ Redémarrage de l'environnement..."
	@$(MAKE) dev

restart-docker: ## Redémarre les services Docker
	@echo "🔄 Redémarrage des services Docker..."
	$(DOCKER_COMPOSE) restart

# Utilitaires
ports: ## Affiche les ports utilisés par les services
	@echo "🌐 Ports des services BlooBowl:"
	@echo "  Web (Next.js):     http://localhost:$(WEB_PORT)"
	@echo "  Mobile (Expo):     http://localhost:$(MOBILE_PORT)"
	@echo "  Server (boardgame.io): http://localhost:$(SERVER_PORT)"
	@echo "  API (Express):     http://localhost:$(API_PORT)"
	@echo "  Docker Web:        http://localhost:8200"

status: ## Affiche le statut des services
	@echo "📊 Statut des services:"
	@echo ""
	@echo "🌐 Web (port $(WEB_PORT)):"
	@curl -s http://localhost:$(WEB_PORT) > /dev/null && echo "  ✅ En ligne" || echo "  ❌ Hors ligne"
	@echo ""
	@echo "🖥️  Server (port $(SERVER_PORT)):"
	@curl -s http://localhost:$(SERVER_PORT) > /dev/null && echo "  ✅ En ligne" || echo "  ❌ Hors ligne"
	@echo ""
	@echo "📱 Mobile (port $(MOBILE_PORT)):"
	@curl -s http://localhost:$(MOBILE_PORT) > /dev/null && echo "  ✅ En ligne" || echo "  ❌ Hors ligne"

kill-ports: ## Tue les processus utilisant les ports du projet (évite Docker)
	@echo "💀 Arrêt des processus sur les ports BlooBowl (sauf Docker)..."
	@echo "⚠️  Attention: Cette commande évite de tuer les processus Docker"
	@for port in $(WEB_PORT) $(MOBILE_PORT) $(SERVER_PORT) $(API_PORT); do \
		echo "Vérification du port $$port..."; \
		PIDS=$$(lsof -ti :$$port 2>/dev/null || true); \
		if [ -n "$$PIDS" ]; then \
			for pid in $$PIDS; do \
				PROCESS=$$(ps -p $$pid -o comm= 2>/dev/null || true); \
				if [ -n "$$PROCESS" ] && [ "$$PROCESS" != "docker" ] && [ "$$PROCESS" != "dockerd" ] && [ "$$PROCESS" != "com.docker" ]; then \
					echo "  Arrêt du processus $$pid ($$PROCESS) sur le port $$port"; \
					kill -9 $$pid 2>/dev/null || true; \
				else \
					echo "  Conservation du processus Docker $$pid sur le port $$port"; \
				fi; \
			done; \
		else \
			echo "  Port $$port libre"; \
		fi; \
	done
	@echo "✅ Ports libérés (Docker préservé)"

kill-dev-ports: ## Tue seulement les processus de développement (Next.js, Expo, etc.)
	@echo "💀 Arrêt des processus de développement..."
	@pkill -f "next dev" 2>/dev/null || true
	@pkill -f "expo start" 2>/dev/null || true
	@pkill -f "tsx watch" 2>/dev/null || true
	@pkill -f "pnpm.*dev" 2>/dev/null || true
	@echo "✅ Processus de développement arrêtés"

# Git et versioning
changeset: ## Crée un nouveau changeset
	@echo "📝 Création d'un nouveau changeset..."
	$(PNPM) run changeset

changeset-version: ## Met à jour les versions avec les changesets
	@echo "📦 Mise à jour des versions..."
	$(PNPM) run changeset:version

# Développement rapide
quick-start: clean-cache install dev ## Démarrage rapide (clean + install + dev)

# Debug et logs
logs-web: ## Affiche les logs de l'application web
	@echo "📋 Logs de l'application web..."
	@tail -f apps/web/.next/trace 2>/dev/null || echo "Aucun log disponible"

logs-server: ## Affiche les logs du serveur
	@echo "📋 Logs du serveur..."
	@tail -f apps/server/logs/*.log 2>/dev/null || echo "Aucun log disponible"

# Tests et validation
validate: typecheck lint ## Valide le code (types + linting)

ci: install typecheck lint test build ## Pipeline CI complet

# Aide spécifique
help-dev: ## Aide pour le développement
	@echo "🛠️  Aide développement BlooBowl:"
	@echo ""
	@echo "Démarrage rapide:"
	@echo "  make quick-start     - Clean + Install + Dev"
	@echo "  make restart         - Kill dev processes + Dev"
	@echo ""
	@echo "Services individuels:"
	@echo "  make dev-web         - Application web seulement"
	@echo "  make dev-mobile      - Application mobile seulement"
	@echo "  make dev-server      - Serveur seulement"
	@echo ""
	@echo "Debug:"
	@echo "  make status          - Statut des services"
	@echo "  make ports           - Ports utilisés"
	@echo "  make kill-dev-ports  - Arrêter les processus de dev"
	@echo "  make kill-ports      - Libérer les ports (évite Docker)"

help-docker: ## Aide pour Docker
	@echo "🐳 Aide Docker BlooBowl:"
	@echo ""
	@echo "Services Docker:"
	@echo "  make docker-up    - Démarrer les services"
	@echo "  make docker-down  - Arrêter les services"
	@echo "  make docker-logs  - Voir les logs"
	@echo "  make docker-build - Build les images"
	@echo ""
	@echo "Ports Docker:"
	@echo "  Web:   http://localhost:8200"
	@echo "  API:   http://localhost:8000"

# Déploiement et maintenance
deploy: ## Déploiement complet avec page de maintenance
	@bash scripts/deploy.sh

deploy-no-cache: ## Déploiement complet sans cache Docker
	@bash scripts/deploy.sh --no-cache

maintenance-on: ## Active la page de maintenance
	@bash scripts/maintenance.sh on

maintenance-off: ## Désactive la page de maintenance
	@bash scripts/maintenance.sh off

maintenance-status: ## Vérifie l'état de la maintenance
	@bash scripts/maintenance.sh status

# Commande par défaut
.DEFAULT_GOAL := help

# Base de données Postgres
db-seed: ## Exécute le seed pour remplir la base de données (rosters, positions, star players, compétences)
	@echo "🌱 Exécution du seed de la base de données..."
	@cd apps/server && $(PNPM) run db:seed
	@echo "✅ Seed terminé avec succès"

db-reset-pg: ## Réinitialise complètement Postgres (drop + recreate schema + seed)
	@echo "🗄️  Réinitialisation complète de la base Postgres..."
	@echo "⚠️  Suppression de toutes les données..."
	@echo "📤 Synchronisation du schéma (db push avec force-reset)..."
	@PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="oui" npx prisma db push --schema prisma/schema.prisma --accept-data-loss --force-reset
	@echo "🧬 Régénération du client Prisma..."
	@npx prisma generate --schema prisma/schema.prisma
	@echo "🌱 Import des fixtures (seed)..."
	@cd apps/server && pnpm run db:seed
	@echo "✅ Base Postgres réinitialisée depuis zéro avec les fixtures"

db-migrate: ## Applique les migrations Prisma en développement (crée et applique les nouvelles migrations)
	@echo "🔄 Application des migrations Prisma en développement..."
	@npx prisma migrate dev --schema prisma/schema.prisma
	@echo "🧬 Régénération du client Prisma..."
	@npx prisma generate --schema prisma/schema.prisma
	@echo "✅ Migrations appliquées et client régénéré"

db-migrate-deploy: ## Applique les migrations Prisma en production (sans créer de nouvelles migrations)
	@echo "🚀 Application des migrations Prisma en production..."
	@npx prisma migrate deploy --schema prisma/schema.prisma
	@echo "🧬 Régénération du client Prisma..."
	@npx prisma generate --schema prisma/schema.prisma
	@echo "✅ Migrations appliquées et client régénéré"

db-migrate-status: ## Vérifie le statut des migrations Prisma
	@echo "📊 Statut des migrations Prisma..."
	@npx prisma migrate status --schema prisma/schema.prisma

db-migrate-data: ## Exécute le script de migration des données statiques (rosters, positions, star players, compétences)
	@echo "📦 Migration des données statiques vers la base de données..."
	@cd apps/server && $(PNPM) exec tsx migrate-static-data-to-db.ts
	@echo "✅ Migration des données terminée"
