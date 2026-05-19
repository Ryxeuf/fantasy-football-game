# NFL Fantasy × Blood Bowl — Documentation

> Documentation vivante du module **NFL Fantasy** : un axe additionnel
> (et non un remplacement) du jeu Blood Bowl existant, dans lequel les
> joueurs construisent une équipe fantasy MPG-like basée sur les vraies
> stats NFL, mais skinnée dans l'univers Blood Bowl.
>
> Cette documentation est issue d'une session d'exploration de 2026-05-19.
> Elle doit évoluer au fil des décisions, validations légales, et changements
> de roster NFL.

## Vision en 3 lignes

1. **Axe additionnel** : on garde la Pro League BB simulée actuelle, on ajoute un mode "NFL Fantasy" qui réutilise l'infra (auth, wallet, gazette, badges, mercato).
2. **Skin BB sur stats NFL réelles** : chaque équipe NFL → 1 race BB, chaque joueur NFL → 1 poste BB, chaque event NFL → SPP via mapping pur.
3. **Pseudonymisé légalement** : pas de noms d'équipes NFL (juste villes + race BB), pas de noms de joueurs (titres BB + numéros + descripteur). Stats réelles autorisées (CBC v. MLB AM, 2007).

## Index des documents

| # | Doc | Sujet |
|---|---|---|
| 00 | [vision.md](./00-vision.md) | Vision, scope, calendrier complémentaire BB/NFL |
| 01 | [legal.md](./01-legal.md) | Cadre légal CBC v. MLB AM, RGPD, conventions pseudonymisation |
| 02 | [references-sorare.md](./02-references-sorare.md) | Étude de cas Sorare (multi-sport) + concurrents fantasy |
| 03 | [api-strategy.md](./03-api-strategy.md) | Stratégie API NFL : nflverse, ESPN, MySportsFeeds, SportRadar |
| 04 | [race-mapping.md](./04-race-mapping.md) | 32 équipes NFL → 8 races BB avec justifications |
| 05 | [position-mapping.md](./05-position-mapping.md) | Postes NFL → postes BB par race |
| 06 | [scoring.md](./06-scoring.md) | Conversion stats NFL → SPP Blood Bowl |
| 07 | [mechanics.md](./07-mechanics.md) | Intégration relances, inducements, prières à Nuffle |
| 08 | [rosters-2025.md](./08-rosters-2025.md) | Rosters 2025 des 32 équipes mappés en postes BB |
| 09 | [transitions-2026.md](./09-transitions-2026.md) | Free agents 2025 + draftees 2025 à reclasser pour 2026-27 |
| 10 | [architecture.md](./10-architecture.md) | Intégration dans le monorepo (packages, services, Prisma) |

## Statut des sections

| Section | Statut | Confiance | Action |
|---|---|---|---|
| Vision & scope | Draft v1 | Haute | Validation produit |
| Légal | Draft v1 | Moyenne | À faire valider par juriste (FR/EU) |
| API stratégie | Draft v1.4 | Haute | POC nflverse + ESPN ✅ — Tank01 V1.5 à intégrer |
| Race mapping (teams) | Implementé v1 ✅ | Haute | `@bb/nfl-mapper` team-to-race (32 teams, 24 tests) |
| Position mapping | Implementé v1 ✅ | Haute | `@bb/nfl-mapper` position-to-bb (8 races × 26 NflPos, 55 tests) |
| Scoring (stats → SPP) | Implementé v1 ✅ | Moyenne | `@bb/nfl-mapper` stats-to-spp + captain multiplier (43 tests). À calibrer sur saison entière |
| Mechanics (BB) | Draft v1 | Haute | Validation prototype |
| Rosters 2025 | Draft v1 | Moyenne | Coupure jan 2026 — à updater |
| Transitions 2026 | Draft v1 | Faible | FA/Draft post mars-avril 2026 |
| Architecture | Implementé v1 ✅ | Haute | Schéma Prisma 8 modèles NflXxx mergé sur main local. Migration à générer dans container. |
| Pseudonymisation | Implementé v1 ✅ | Haute | `@bb/nfl-mapper` pseudonymize (Q8, 31 tests) |

## Convention de mise à jour

Cette doc évolue en suivant les patterns du projet :
- Branche `claude/nfl-fantasy-*` pour les évolutions
- Commit `docs(nfl-fantasy): <description>`
- Update `Statut des sections` ci-dessus à chaque modif
- Ajouter une entrée dans `Changelog` ci-dessous

## Changelog

| Date | Version | Notes |
|---|---|---|
| 2026-05-19 | v1 | Création initiale (session exploratoire) |
| 2026-05-19 | v1.1 | Tranchage Q1/Q3/Q4/Q5 : snake draft, captain ×1.5 + vice ×1.2, prayers par TV, race fixe par équipe |
| 2026-05-19 | v1.2 | Tranchage Q2/Q6/Q7/Q8 : 10 users/league, silos séparés Pro League, freemium V1, pseudo full + flag DB `realNameDisplay` |
| 2026-05-19 | v1.3 | Schéma Prisma 10-architecture.md : ajout `realNameDisplay` Bool (Q8), retrait `archetype` Json + fichier `archetype.ts` (V2, Q5 race fixe par équipe) |
| 2026-05-19 | v1.4 | 03-api-strategy.md : correctif tag nflverse (`stats_player` ≥ 2025), correction MSF (free non-commercial uniquement), ajout Tier 1.5 Tank01 + V1.5 cost ($120/an), ajout Sleeper + Odds API + SDX, avertissements ToS (Sofascore, DK/FD WS, SerpAPI), refs repos ESPN (pseudo-r/Public-ESPN-API, mkreiser/ESPN-Fantasy-Football-API), POC findings W10 2025 |
| 2026-05-19 | v1.5 | 03-api-strategy.md gotchas: POC validé sur W1/W10/W18 2025 (testé sur 3 weeks). ESPN `?dates` filtre par ET local (TNF→Thu), summary 18/19 keys variable, season sous `leagues[0]`. nflverse: 1 CSV/saison cache-friendly, filter aussi `season_type`, position_group peut être vide. |
| 2026-05-19 | v1.6 | 03-api-strategy.md edge cases playoffs + intl : POC éprouvé sur Friday Sao Paulo (KC@LAC), Wildcard W19 (LAR@CAR, BUF@JAX, SF@PHI), Super Bowl LX (SEA 29 @ NE 13). Bug ESPN découvert : `leagues[0].season.type` figé à `reg` même en playoffs ; source de vérité = `event.season.slug=post-season`. Numérotation post-season ESPN : Wildcard=1, Div=2, Conf=3, SB=5 (skip 4=Pro Bowl). Mapping nflverse W19-22 ↔ ESPN post-season W1-5 documenté. |
| 2026-05-19 | v1.7 | Phase 1.A : package `@bb/nfl-mapper` créé avec `team-to-race` (24 tests, mergé via PR #880). |
| 2026-05-19 | v1.8 | Phase 1.B-1.E livrée en commits atomiques sur main local : position-to-bb (55 tests, 8 races × 26 NflPos), stats-to-spp + captain multiplier (43 tests, examples doc validés Mahomes/Henry/Jefferson/Donald/Watt/Sauce), pseudonymize Q8 (31 tests, 29 BbPosition + 8 archetype overrides), schéma Prisma 8 modèles NflXxx (NflSeason/Week/Team/Player/Game/GameStat/RosterSnapshot/IngestRun) avec `realNameDisplay` flag + sans `archetype` (Q5/Q8). Total package : 153 tests passent, coverage >96%. Migration Prisma à générer dans container `nufflearena_server`. |

## Source de cette session

Cette doc consolide une discussion exploratoire couvrant :
1. Faisabilité du pivot NFL fantasy en axe supplémentaire
2. Étude de cas Sorare (architecture multi-sport)
3. Stratégie API et tiers de coût
4. Cadre légal (CBC precedent, RGPD)
5. Mapping racial des 32 équipes NFL
6. Mapping postes joueurs NFL → BB
7. Mécaniques BB (relances, inducements, prières) en seasonal bonus
8. Rosters et transitions 2025→2026

Les questions structurantes encore ouvertes sont listées dans
[vision.md § "Questions ouvertes"](./00-vision.md).
