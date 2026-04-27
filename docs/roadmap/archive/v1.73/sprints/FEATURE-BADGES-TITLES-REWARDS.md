# Feature — Badges, Titres & Récompenses

> Source de vérité pour l'implémentation différée du système de badges, titres et récompenses.
> Plan validé avec l'utilisateur le 2026-04-20.

## Objectif

Ajouter une progression méta-jeu qui reconnaît et met en valeur les actions des utilisateurs :
- **Badges** — récompenses atomiques débloquées par action/seuil (tutoriel, dons, équipe créée, match joué, ligue créée, ligue terminée, etc.)
- **Titres** — libellés portés par le coach (Mécène, Champion de la Coupe XXX 2026, Vétéran, Joueur assidu, etc.)
- **Récompenses** — pour l'instant limitées aux points de profil + effets visuels. Cosmétiques reportés.

## Décisions utilisateur

| Sujet | Décision |
|---|---|
| Périmètre première PR | **P1 + P2 ensemble** (foundation + triggers match/cup) |
| Provider donations | **Ko-fi** (webhook) — intégration réelle en P3, modèle Prisma créé en P1 |
| Catalogue badges/titres | **Tout le catalogue proposé validé** |
| Récompenses cosmétiques | **Hors périmètre V1** — revues ultérieurement |
| Titre actif | **Un seul titre actif à la fois** par utilisateur |

## Sprints

| Sprint | Statut | Contenu |
|---|---|---|
| [SPRINT-6](./SPRINT-6-badges-foundation.md) | À implémenter | **P1** — Foundation : schéma Prisma, AchievementService, règles onboarding, endpoints profil |
| [SPRINT-7](./SPRINT-7-badges-match-cup-triggers.md) | À implémenter | **P2** — Match & Cup triggers : hooks broadcast/forfeit, règles compétitives, titre dynamique champion |
| SPRINT-8 (à écrire) | Future | **P3** — Intégration Ko-fi webhook + badges donor_* + titre Mécène |
| SPRINT-9 (à écrire) | Future | **P4** — Tracking tutoriel détaillé + badges onboarding par palier |
| SPRINT-10 (à écrire) | Future | **P5** — Frontend Web : pages `/me/badges`, `/me/titles`, profil public enrichi, toast unlock |
| SPRINT-11 (à écrire) | Future | **P6** — Mobile : écran profil + push notification badge |
| SPRINT-12 (à écrire) | Future | **P7** — Polish : badges secrets, daily streak, animations |

## Modèles Prisma cibles (résumé)

```prisma
Badge           // catalogue statique (slug unique, category, tier, i18n)
UserBadge       // débloqué par user (unique [userId, badgeId])
Title           // catalogue statique (slug, scope static|dynamic, rarity)
UserTitle       // débloqué par user (isActive bool, label finalisé, context JSON)
TutorialProgress // par scriptSlug
Donation        // provider=ko-fi|stripe|manual, amountCents, externalId
UserStats       // compteurs agrégés dénormalisés
```

Ajouts au modèle `User` :
- `badges UserBadge[]`
- `titles UserTitle[]`
- `activeTitleId String?`
- `donations Donation[]`
- `tutorialProgress TutorialProgress[]`
- `stats UserStats?`
- `profilePoints Int @default(0)`

## Architecture logicielle

```
apps/server/src/services/achievements/
├── index.ts                # dispatch(trigger, ctx)
├── triggers.ts             # enum Trigger { TUTORIAL_COMPLETED, MATCH_ENDED, CUP_COMPLETED, ... }
├── rules/
│   ├── onboarding.rules.ts # first_team, first_match, profile_complete, tutorial_complete, ...
│   ├── matches.rules.ts    # matches_played_N, winning_streak_N, flawless_victory, elo_N, ...
│   ├── cups.rules.ts       # first_cup_created, cup_champion, cup_finisher, ...
│   ├── social.rules.ts     # social_butterfly, sportsmanship, ...
│   ├── donations.rules.ts  # donor_first, donor_silver, donor_gold, donor_legend
│   └── fun.rules.ts        # night_owl, daily_streak_N, birthday_match, ...
├── badge-grant.ts          # upsert UserBadge (idempotent)
├── title-grant.ts          # upsert UserTitle + éventuel auto-activate
├── stats-updater.ts        # incrémente UserStats
└── notify.ts               # emit socket "user:badge-unlocked" + push notif
```

### Points d'intégration (call-sites)

| Trigger | Call-site | Sprint |
|---|---|---|
| `TEAM_CREATED` | `apps/server/src/routes/team.ts` POST `/teams` | P1 |
| `PROFILE_UPDATED` | `apps/server/src/routes/user.ts` PUT `/me` | P1 |
| `TUTORIAL_STEP_COMPLETED` | nouveau POST `/api/me/tutorial-progress` | P1 |
| `MATCH_ENDED` | `apps/server/src/services/game-broadcast.ts::broadcastMatchEnd` | P2 |
| `MATCH_FORFEITED` | `apps/server/src/services/forfeit-tracker.ts` | P2 |
| `CUP_CREATED` | `apps/server/src/routes/cup.ts` POST | P2 |
| `CUP_COMPLETED` | endpoint cup status → `terminee` | P2 |
| `DONATION_RECEIVED` | webhook Ko-fi `POST /api/donations/webhook/kofi` | P3 |
| `LOGIN` | middleware auth (streak) | P7 |

## API cible (résumé)

```
GET    /api/me/badges            # mes badges + progression
GET    /api/me/titles            # mes titres + isActive
PUT    /api/me/title             # body { titleId | null } → active
GET    /api/users/:id/profile    # public : titre actif + vitrine badges non-hidden
GET    /api/badges               # catalogue public (sans hidden)
POST   /api/me/tutorial-progress # { scriptSlug, completed }
POST   /api/donations/webhook/kofi  # webhook Ko-fi (P3)
POST   /api/donations/manual     # admin only (P3)
```

## Catalogue badges validé (tous activés)

**Onboarding (7)** : tutorial_started, tutorial_complete, first_team, roster_collector_bronze/silver/gold, first_match, first_win, profile_complete.

**Compétition (13)** : matches_played_10/50/100/500, winning_streak_3/5/10, flawless_victory, comeback_king, shutout_master, quick_finish, goldsmith, elo_1500/1800/2000, forfeit_zero_50matches.

**Coupes (6)** : first_cup_created, cup_finisher, cup_champion, cup_champion_x5/x10, cup_runner_up, community_organizer.

**Faits du jeu (8)** : nuffle_loved, nuffle_cursed, kaboom, passmaster, interceptor_extraordinaire, mvp_collector, apothecary_hero, legendary_player.

**Soutien & Communauté (6)** : donor_first, donor_silver, donor_gold, donor_legend, social_butterfly, sportsmanship.

**Régularité / Fun (hidden=true, 5)** : night_owl, daily_streak_7/30, early_bird, easter_egg_konami, birthday_match.

## Catalogue titres validé

`rookie`, `veteran`, `assidu`, `mecene`, `grand_mecene`, `pilier`, `champion_cup` (dynamique), `vice_champion_cup` (dynamique), `bug_hunter`, `beta_tester`, `coach_elite`, `legende_vivante`, `taulier_du_terrain`, `nuffle_chosen`, `dev`.

## Risques & invariants

1. **Idempotence** : `@@unique [userId, badgeId]` sur `UserBadge` + `upsert` garantit aucune duplication.
2. **Migration additive** : aucun risque de perte de données — tous les nouveaux modèles sont optionnels depuis `User`.
3. **Patreon legacy** : `User.patreon` conservé en l'état (compatibilité), la logique dons s'appuie sur `Donation` + badges donor_*.
4. **Performance** : `UserStats` évite les `count()` à chaque dispatch ; mises à jour incrémentales.
5. **Titre actif unique** : à l'activation d'un titre, désactiver les autres dans une transaction Prisma.
6. **Titre dynamique** : le `label` est figé à l'attribution (indépendant des renames de coupe).
7. **i18n** : `nameFr/nameEn` suit le pattern existant (Skill, Roster).
