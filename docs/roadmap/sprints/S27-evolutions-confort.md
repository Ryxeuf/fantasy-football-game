# Sprint 27 — Evolutions & confort

> Duree cible : ~6 jours (allegé : replay sharable retiré, hot-reload
> Docker remonte en S24.9)
> Theme : preparer la suite long-terme et boucler la dette mineure.
> Pre-requis : S24 (DX hot-reload), S25 (logs/perf), S26 (refactor +
> retention).

## Taches

| # | Tache | Cat | Effort | Statut | Detail |
|---|-------|-----|--------|--------|--------|
| S27.1 | Compétitions esport mensuelles "Nuffle Cup" + bracket visuel + match-of-week | EVO | L | [ ] | Infra Cup deja en place (`prisma/Cup`, standings, matchmaking). Lancer : 1 cup mensuelle programee, bracket visuel `/cups/{slug}`, page "match-of-the-week" (pick admin), badge profil "Champion Nuffle Cup {date}". **Version A : 100% numerique** (trophees + badge + Discord match-of-week). Pas de prix physique pour eviter logistique / fiscal. Ouvert a evolution selon retours communautaires. |
| S27.2 | Mobile parite : Action Picker Throw Team-Mate + flow 2-clics | AMELIO | M | [ ] | `apps/mobile/app/play/[id].tsx:390`. Refrappe ce qui a ete fait en S23 sur web (commit `28c31e4`). Backend deja pret (B2.4). Idem pour les autres popups d'action si lacunes detectees. |
| S27.3 | Mobile : i18n complet (FR/EN) + refactor `lobby.tsx` (816l) | AMELIO | L | [ ] | `apps/mobile/app/settings.tsx:152` et autres : strings hardcoded en francais. Ajouter `i18next` mobile aligne avec le web. Splitter `lobby.tsx` en `MatchCard`, `MatchList`, `FilterBar`. |
| S27.4 | Mobile : accessibilite touch board + hooks composites | AMELIO | M | [ ] | `apps/mobile/app/play/[id].tsx:363-367`. Ajouter `accessibilityRole`, `accessibilityLabel` sur PixiBoardNative. Consolider `use-game-socket` + `use-game-chat` -> `useGameMatch`. |
| S27.5 | Skeleton Season 4 BB3 (pattern S3 = clone + overrides) | EVO | M | [ ] | `packages/game-engine/src/rosters/star-players.ts:1105-1141`. Pattern S3 clair (`SEASON_THREE_STAR_PLAYER_OVERRIDES` + `buildSeason3StarPlayers()`). Creer `SEASON_FOUR_*` skeleton vide pret a recevoir les rosters officiels GW 2025-2026. Zero contenu mais infra prete. |
| S27.6 | Audit log admin (table AuditLog : qui change quoi sur skills/rosters/users) | EVO | L | [ ] | Aucune trace actuelle des actions admin (create/update/delete contenu). Compliance + tracabilite. Modele Prisma `AuditLog(userId, action, entity, entityId, oldValue Json?, newValue Json?, createdAt)`. Hook dans toutes les routes `/admin/data/*`. UI lecture `/admin/audit-log`. |
| S27.7 | B0.1 residuels : Stunty AV, GFI Sure Feet/Sprint, Horns vers registry | CONFORT | M | [ ] | Solde [`docs/roadmap/follow-up-b01.md`](../follow-up-b01.md). Etendre `SkillContext.currentTrigger` pour discriminer Stunty (on-dodge ET on-armor). Refactor `blocking.ts:141`, `movement.ts` (aucun import skill-bridge), `foul.ts` (Sneaky Git mixte). |
| S27.8 | Refactor `actions.ts` (2695l) + `match.ts` (1605l) + `team.ts` (2150l) en micro-modules | CONFORT | XL | [ ] | Etalable post-S27 si trop dense. `actions/{move,block,pass,foul,blitz,handoff}.ts` + `index.ts` unificateur. `match.ts` -> `match/{game,state,actions,prematch}.ts`. Pre-requis avant de poser de nouvelles features sur ces fichiers. |

## Definition of done

- [ ] 1 Nuffle Cup mensuelle ouverte, calendrier publie
- [ ] Mobile : Throw Team-Mate jouable de bout en bout
- [ ] Mobile : 100% des strings en i18n (audit script)
- [ ] Schema Prisma `Season4*` present mais vide (migration applicable)
- [ ] AuditLog : 1 action admin = 1 entree visible dans `/admin/audit-log`
- [ ] Hardcode `player.skills.includes(...)` = 0 dans mechanics/blocking, movement, foul
- [ ] `actions.ts` <= 600 lignes, le reste en modules <= 400 lignes

## Risques

- **Esport Nuffle Cup (S27.1)** : risque de cup vide si pas assez de
  joueurs. Lancer en mode "soft" avec annonce Discord 1 semaine avant.
- **i18n mobile (S27.3)** : ne pas oublier les strings dans les
  components Reanimated/Pixi.js qui sont moins evidents a auditer.
- **Audit log (S27.6)** : risque de saturer la DB si log trop verbeux.
  Limiter aux actions /admin/data/* + /admin/users (pas les lectures).
- **Refactor monoliths (S27.8)** : risque XL d'eclater le scope.
  Decoupage incremental, 1 fichier par PR, tests e2e en garde-fou.

## Sources

Findings agents : engagement#6 (esport), mobile#1-6 (parite + i18n + lobby
+ a11y), contenu#5 (S4 skeleton), securite#6 (audit log), engine#2,
follow-up-b01.md (B0.1 residuels), engine#5 + backend#4 (refactor monoliths).
