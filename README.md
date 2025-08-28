# BlooBowl – Monorepo (Web + Mobile + Server)

Monorepo **TypeScript** pour un jeu tour-par-tour inspiré Blood Bowl, jouable en **asynchrone** (deux joueurs), en **PWA** (web desktop/mobile) + **mobile Expo**. Serveur **boardgame.io**.

## Stack
- Monorepo: Turborepo + pnpm
- Web: Next.js (App Router) + Tailwind
- Mobile: Expo (React Native)
- Serveur: boardgame.io + tsx
- Moteur: packages/game-engine (TS pur, RNG déterministe)
- UI partagée (web): packages/ui

## Prérequis
- Node 20+
- pnpm `npm i -g pnpm`

## Installation
```bash
pnpm install
```

## Développement
Dans 3 terminaux ou via turbo:
```bash
pnpm dev
```
- Web: http://localhost:3000
- Server (WS/HTTP): http://localhost:8000
- Mobile: `apps/mobile` → `pnpm dev` (ouvre Expo)

> Astuce: tu peux aussi lancer séparément: `pnpm --filter @bb/server dev` et `pnpm --filter @bb/web dev`

## Base de données (optionnelle pour MVP)
Un `docker-compose.yml` est fourni (Postgres + Redis). Lancement:
```bash
docker compose up -d
```
Configure `.env` à la racine et dans `apps/server` si tu branches Prisma plus tard.

## Structure
```
/apps
  /web        -> Next.js PWA minimal + Board viewer
  /mobile     -> Expo minimal
  /server     -> boardgame.io server
/packages
  /game-engine -> moteur de règles déterministe (applyMove/getLegalMoves)
  /ui          -> composants React web (Board)
  /config      -> tsconfig & eslint partagés
/prisma         -> (placeholder) schéma Postgres
```
## TODO
- Auth (Supabase/Clerk)
- Persistance Postgres + Prisma (events, matches)
- Notifications push (Web + Expo)
