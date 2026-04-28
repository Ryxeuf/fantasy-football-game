# Déploiement de la base de données

## Contexte

Nuffle Arena utilise Prisma avec PostgreSQL en production (voir
`prisma/schema.prisma`). Les **rosters**, **star players**, **compétences** et
autres données de référence sont maintenues en code (dans
`packages/game-engine/src/rosters/`) et chargées en base via un script de
seed idempotent (`apps/server/src/seed.ts`).

Le projet n'utilise **pas** encore `prisma migrate` : le schéma est appliqué
avec `prisma db push`. Une adoption future de `prisma migrate` est suivie
dans un ticket dédié (cf. « Futur »).

## Flux automatique (déploiement CI)

À chaque push sur `main`, le workflow `.github/workflows/deploy.yml`
exécute les étapes suivantes **après** avoir redémarré les containers :

1. Attente que Postgres soit prêt (`pg_isready`, timeout 60s).
2. `prisma db push --accept-data-loss --skip-generate` — aligne le schéma
   Postgres sur `prisma/schema.prisma` (ajoute enum `Ruleset`, colonnes
   `ruleset`, nouvelles contraintes d'unicité, etc.).
3. `pnpm run db:seed` (depuis `apps/server`) — itère sur tous les
   rulesets (`season_2`, `season_3`, …) et upsert les rosters, positions,
   compétences et star players correspondants.

Le seed est **idempotent** (findUnique + update/create). Il met à jour les
rosters existants avec le contenu actuel du code — toute modification
manuelle en base sur les données de référence sera écrasée.

## Exécution manuelle

Si un déploiement a été fait sans `db push`/`seed` (ancienne version du
workflow), ou si un incident nécessite un re-seed, depuis le serveur de
prod :

```bash
cd ~/fantasy-football-game

# 1. Aligner le schéma Postgres
docker compose -f docker-compose.prod.yml exec -T server \
  pnpm -w exec prisma db push \
  --schema prisma/schema.prisma \
  --accept-data-loss \
  --skip-generate

# 2. Re-seeder les données de référence
docker compose -f docker-compose.prod.yml exec -T server \
  sh -c "cd apps/server && pnpm run db:seed"
```

## Vérification

Pour confirmer qu'une saison donnée a bien des rosters :

```bash
curl -s "https://api.nufflearena.fr/api/rosters?ruleset=season_3" \
  | jq '.rosters | length'
```

La réponse doit renvoyer un entier positif. La liste des rulesets
supportés est également exposée par l'API via le champ
`availableRulesets`.

## Ajouter un nouveau ruleset

1. Ajouter la valeur à l'enum `Ruleset` dans `prisma/schema.prisma`.
2. Ajouter la valeur dans `RULESETS` / `Ruleset` de
   `packages/game-engine/src/rosters/positions.ts`.
3. Ajouter les rosters correspondants
   (ex. `packages/game-engine/src/rosters/season4-rosters.ts`) et brancher
   la map dans `TEAM_ROSTERS_BY_RULESET`.
4. Pousser sur `main` — le déploiement CI applique automatiquement le
   nouveau schéma et seed les données.

## Futur

Adoption de `prisma migrate deploy` pour tracer l'historique des schémas
et sécuriser les migrations de données : voir le ticket de suivi ouvert
après la correction du bug « Saison 3 vide » sur `/teams`.

## Mémoire incidents

Pour les causes racines et correctifs des incidents de déploiement
(`deploy.sh`, rollback, etc.), voir `docs/DEPLOY-INCIDENTS.md`.
