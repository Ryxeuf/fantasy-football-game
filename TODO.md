# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Derniere mise a jour : 2026-06-15
> Version actuelle : v1.173.x (beta ouverte au public).
>
> La roadmap v1 (Sprints 0-23, Phases A-Q, 201 taches livrees) est
> archivee dans [`docs/roadmap/archive/v1.73/`](./docs/roadmap/archive/v1.73/README.md).

## Roadmap v2

La nouvelle feuille de route est dans
[`docs/roadmap/phases.md`](./docs/roadmap/phases.md) (page blanche
prete a accueillir les phases R+).

## Sessions de polish recentes

- **2026-05-10** — Pro League UI polish (12 lots livres, PRs #728-#742).
  Ferme les gaps UX residuels des sprints 1.C / 1.D / 2.B / 4.A-F
  (drill-down joueur, top earners, wallet ledger, broadcaster load
  test admin, fix badge "ready to level-up" phantom). Detail :
  [`docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md`](./docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md).
- **2026-05-11** — Sprint O termine a 87% (7 lots livres, PRs #744-#751).
  Fix regen/apothecary BB order, kill-switch validation admin,
  onboarding modal, daily bonus UI, badge unlock toast, OG image
  dynamique + share buttons matchs, match report banner. Lot
  O.A.2-4 (skill registry wiring) differe a session focused engine.
  Detail :
  [`docs/roadmap/sessions/2026-05-11-sprint-O.md`](./docs/roadmap/sessions/2026-05-11-sprint-O.md).
- **2026-05-12** — Sprint Q termine (12 PRs #772-#784). Q.A/Q.B/Q.D
  livres (career pages, rivalries, vote MVP, commentaires, fan
  predictions, mini-leagues, Survivor). Q.C (clips MP4) differe. Detail :
  [`docs/roadmap/sessions/2026-05-12-sprint-Q.md`](./docs/roadmap/sessions/2026-05-12-sprint-Q.md).
- **2026-05 (post-Q)** — **NFL Fantasy** : nouvel axe MPG-like sur stats
  NFL reelles skinnees BB. Package `@bb/nfl-mapper`, ingestion nflverse +
  ESPN, league/roster/lineup/scoring/mercato, crons, admin explorer,
  frontend `/nfl-fantasy/*`, Gazette LLM, backfill 2023+2024. ~14 modeles
  `Nfl*`. Doc vivante : [`docs/nfl-fantasy/README.md`](./docs/nfl-fantasy/README.md).
- **2026-06-06** — Gestion des Ligues (#886-#889) : invitations, withdraw
  guard, multi-poules + scheduler, feuille de match v2, edition ex-post,
  classements joueurs. Detail :
  [`docs/roadmap/sessions/2026-06-06-league-management.md`](./docs/roadmap/sessions/2026-06-06-league-management.md).
- **2026-06-13→15** — Vague acquisition/retention web (#890-#897) :
  refonte home Nuffle + accueil personnalise, comparateur de rosters SSR
  + tier-list, notifications de re-engagement (Web Push + digest e-mail),
  onboarding "Cree ton equipe en 60 secondes", OpenSpec workflow.

## Priorite immediate

- [**SPRINT O — Bug fixes engine + deblocage acquisition**](./docs/roadmap/sprints/SPRINT-O-bug-fixes-acquisition.md)
  — **TERMINE a 87%** (7/9 lots livres, PRs #744-#751 mergees, 2026-05-11).
  Lot O.A.2-4 (skill registry wiring : Sure Feet, Sprint, Horns,
  Stunty, Sneaky Git, Pile Driver) **differe** a session focused
  engine — ~3 jours dans `packages/game-engine/src/mechanics/` +
  bench drift FUMBBL verification.

- [**SPRINT P — Ops readiness + scaling 10k MAU**](./docs/roadmap/sprints/SPRINT-P-ops-readiness.md)
  — **PLANIFIE** (post-Sprint O, 3 semaines) — mode maintenance, admin
  wallet UI, season factory Pro League, password reset self-service,
  soft-delete users + GDPR export, sinks Crowns (cosmetiques HoF +
  tournois entry), dashboard analytics admin (DAU/MAU/funnel/inflation
  Crowns), moderation matchs humains.

- [**SPRINT Q — Differenciation fan / engagement narratif**](./docs/roadmap/sprints/SPRINT-Q-fan-differentiation.md)
  — **TERMINE** (12 PRs #772-#784, 2026-05-12). Career pages + rivalries,
  player-of-the-week vote, prediction mini-leagues privees, Survivor
  Pick'em, Gazette commentaires + fan predictions livres. Reste differe :
  clips highlights MP4 vertical (Q.C, TikTok/Shorts).

- [**SPRINT R — International + monetisation + mobile release**](./docs/roadmap/sprints/SPRINT-R-international-monetization-mobile.md)
  — **PLANIFIE** (post-Sprint Q, 3-6 mois) — i18n EN/DE/PL/ES
  complete, Patreon Founders Club + Season Pass cosmetique, mobile
  parite + App Store + Play Store, Discord officiel + bot Gazette,
  programme ambassadeur 5 casters, NAF integration, PvP async tours-
  par-jour (FUMBBL-killer feature). Win condition : 10k MAU + top 3
  BB online FR/EN/DE a 12 mois.

- [**SPRINT Ligues v2 — Gestion complete des ligues Blood Bowl**](./docs/roadmap/sprints/SPRINT-leagues-v2.md)
  — **TERMINE** (Lots A/B/C livres en PRs #535-#545). Restes optionnels
  reportes en backlog ci-dessous.

- [**SPRINT Pro League — Championnat virtuel + Paris MVP**](./docs/roadmap/sprints/SPRINT-pro-league.md)
  — **TERMINE Phase 0 + Phase 1 + session polish 2026-05-10 (PRs #728-#742)**.
  Reste : tuning bench panel humain (Phase 0 gate) et go-live calendrier
  saison NFL 2026-27 (cible kickoff 5 sept 2026). Backlog idees differees
  consigne dans [`docs/roadmap/backlog/future-ideas.md`](./docs/roadmap/backlog/future-ideas.md).

## Suivi qualite actif

- ✅ **B0.1 (hardcodes skill registry residuels) clos** le 2026-05-11 via
  Sprint O lot O.A.2-4 (verrouille par `registry-wiring.test.ts`, 17
  tests). Seul item differe : **Pile Driver** (foul gratuit post-knockdown,
  action speciale a traiter en lot dedie). Detail :
  [`docs/roadmap/follow-up-b01.md`](./docs/roadmap/follow-up-b01.md).

## Backlog

### Ligues v2 — extensions reportees

> Toutes les extensions optionnelles de Ligues v2 ont ete archivees dans
> [`docs/roadmap/backlog/future-ideas.md`](./docs/roadmap/backlog/future-ideas.md)
> (annexe A) le 2026-05-05 :
> - **A.0** : L2.C.4 Promotion/relegation multi-tier (focus acquisition/retention).
> - **A.1** : L2.C.7 Mobile parite ligues (priorisation Pro League).

### Pro League — idees post-MVP

> Issues de la session 2026-05-10 mais hors scope MVP :
> - Cache materialise `ProMatchPlayerStat` si le mining replay (Lot L)
>   devient trop couteux (>5 matchs ou usage frequent).
> - Graphique evolution SPP / TV par joueur (timeline sur saison).
> - Top earners par equipe sur la page standings (Lot I + Lot M
>   combine).
> - Wallet : pagination des transactions au-dela des 20 dernieres.

### Autres

(a definir selon retours beta et priorites)
