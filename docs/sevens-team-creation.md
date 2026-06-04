# Création d'équipe — Format Blood Bowl à Sept

> Sprint 2026-06 — Choix du format de jeu à la création d'équipe.
> À garder **synchronisé** avec `packages/game-engine/src/rosters/formats.ts`
> (source unique de vérité) et le livre officiel scanné dans
> `data/ReglesBloodbowlSeven/`.

## Contexte

La création d'équipe était hard-codée pour le **Blood Bowl à 11** (budget
1 000 000 po, 11–16 joueurs). On introduit un axe **`format`** permettant de
choisir **Blood Bowl à 11 (`bb11`)** ou **Blood Bowl à Sept (`sevens`)**, avec
les contraintes de sélection propres à chacun.

`format` est **orthogonal** au `ruleset` (`season_2` / `season_3`, qui désigne
l'édition des règles). Une équipe a donc un `ruleset` **et** un `format`.

> Périmètre : création / édition d'équipe + affichage (badge) + filtre.
> Le **moteur de jeu** Sevens (terrain 7 cases, mise en place, séquences) est
> **hors scope**.

## Source unique de vérité

`packages/game-engine/src/rosters/formats.ts` :

- `GameFormat = "bb11" | "sevens"`, `FORMATS`, `DEFAULT_FORMAT = "bb11"`.
- `FORMAT_CONSTRAINTS` : toutes les valeurs ci-dessous, **en kpo** (milliers de
  po) pour coller à la convention du builder (`teamValue: 1000` = 1 000 000 po).
- Helpers purs : `getFormatConstraints`, `isLineman` (poste de base : `max ≥ 12`),
  `isBigGuy` (compétence Solitaire/Loner), `countNonLinemen`,
  `getSelectablePositions`, et `validateFormatSelection` (validation partagée
  serveur + UI).

## Contraintes par format

| Règle | BB11 | Sevens (officiel) |
|---|---|---|
| Budget de sélection | 1 000 000 po | **600 000 po** |
| Joueurs (min–max) | 11–16 | **7–11** |
| Joueurs non-Linemen | illimité | **max 4** |
| Gros Bras | selon fiche | **selon fiche** (non bannis) |
| Relances | 0–8, coût ×1 | **0–6, coût ×2** |
| Cheerleaders | 0–12 à 10k | **0–6 à 20k** |
| Coachs assistants | 0–6 à 10k | **0–3 à 20k** |
| Apothicaire | 0–1 à 50k | **0–1 à 80k** (si la fiche l'autorise) |
| Fans dévoués | 1–6 à 10k/pt | **1–6 à 20k/pt** |
| Star Players (sélection) | autorisés | **interdits** (coups de pouce d'avant-match) |

### Notes de lecture des règles officielles

- Le **Lineman** est le poste dont la limitation est 0-12 / 0-16 → détecté par
  `max ≥ 12` (robuste pour les linemen renommés : Zombie, Brawler, etc.).
- Les **Gros Bras** suivent la limite normale de la fiche d'équipe (ex. Union
  Élfique 0-2 Blitzers reste 0-2). Ils comptent dans les 4 non-Linemen.
- **Apothicaire** : 0-1 à **80 000 po** (confirmé), si la fiche d'équipe l'autorise.
- **Star Players** : **interdits** à la sélection — ce sont des coups de pouce
  d'avant-match (confirmé).

## Implémentation

- **Prisma** : `enum Format { bb11 sevens }` + `Team.format Format @default(bb11)`
  (schéma PG `prisma/schema.prisma` + mirror SQLite). Migration
  `20260604120000_add_team_format`. Les équipes existantes → `bb11`.
- **Serveur** : `format` ajouté aux schémas Zod (`team.schemas.ts`) ; les
  handlers `team-build-handler.ts` et `team-create-from-roster-handler.ts`
  résolvent les contraintes via `getFormatConstraints`, valident via
  `validateFormatSelection`, calculent le coût staff/relances à partir de la
  config, et persistent `format`.
- **Web** : `app/me/teams/new/page.tsx` expose un **sélecteur Format**. Tout est
  piloté par `getFormatConstraints` : budget par défaut, plafonds joueurs/staff,
  blocage des non-Linemen au-delà de 4, toggle apothicaire désactivé si interdit,
  masquage du sélecteur de Star Players, validation live. Badge + filtre format
  sur `app/me/teams/page.tsx` et badge sur `app/me/teams/[id]/page.tsx`.

## Tests

- `packages/game-engine/src/rosters/formats.test.ts` — config + helpers +
  `validateFormatSelection` (Sevens & non-régression BB11).
- `apps/server/src/routes/team-build-format.test.ts` — validation au niveau du
  handler (rejets 7/11/non-Linemen/Star Players, cas valide, budget par défaut).
