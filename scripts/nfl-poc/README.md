# NFL POC — Ingestion

> POC jetable pour valider la faisabilite technique de l'ingestion
> tier-1 gratuit (nflverse + ESPN) decrite dans
> `docs/nfl-fantasy/03-api-strategy.md`.

## Objectif

1. **Pull nflverse** : recuperer 1 semaine de stats joueurs NFL via les
   releases publiques GitHub (CSV) et valider le format.
2. **Poll ESPN scoreboard** : appeler l'API cachee ESPN, sauvegarder
   un snapshot JSON et valider la stabilite des champs.
3. **Normaliser 5 stat lines** (QB / WR / RB / DE / LB) en `StatLine`
   neutre, point de depart pour `stats-to-spp.ts` (Phase 1 reelle).

## Cible de la session

- Saison **2025**, Week **10** (sera elargie ensuite a d'autres
  semaines pour eprouver le script).

## Installation

```bash
cd scripts/nfl-poc
npm install
```

Pas dans le workspace pnpm racine pour isoler les deps.

## Run

```bash
# Pull nflverse seulement
npm run poc:nflverse

# Poll ESPN seulement
npm run poc:espn

# Tout d'un coup
npm run poc:all
```

## Sorties

Toutes les fixtures sont sauvegardees dans `fixtures/` (gitignore).

- `fixtures/nflverse-player-stats-2025-w10.csv` — raw nflverse
- `fixtures/espn-scoreboard.json` — raw ESPN
- `fixtures/normalized-statlines.json` — 5 stat lines normalisees

## Apres le POC

Une fois la faisabilite confirmee :
- Migrer le code de fetch vers `apps/server/src/services/nfl-ingest.ts`
  (idempotent, audit log, cf. pattern Q.D.1).
- Supprimer ce dossier `scripts/nfl-poc/`.
