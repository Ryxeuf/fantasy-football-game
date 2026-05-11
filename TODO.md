# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Derniere mise a jour : 2026-05-10
> Version actuelle : v1.74.0 (beta ouverte au public).
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

## Priorite immediate

- [**SPRINT O — Bug fixes engine + deblocage acquisition**](./docs/roadmap/sprints/SPRINT-O-bug-fixes-acquisition.md)
  — **EN COURS** (demarre 2026-05-10, 2 semaines) — 4 bugs regles BB
  visibles par veterans FUMBBL (Perfect Defence, Illegal Procedure,
  regen/apothecary order, Diving Tackle) + 5 skills hardcodes a
  cabler dans registry (Sure Feet, Sprint, Horns, Stunty, Sneaky Git)
  + kill registration approval gate + onboarding modal + daily bonus
  claim UI + match report banner + badge unlock toast + OG image
  dynamique + share buttons.

- [**SPRINT P — Ops readiness + scaling 10k MAU**](./docs/roadmap/sprints/SPRINT-P-ops-readiness.md)
  — **PLANIFIE** (post-Sprint O, 3 semaines) — mode maintenance, admin
  wallet UI, season factory Pro League, password reset self-service,
  soft-delete users + GDPR export, sinks Crowns (cosmetiques HoF +
  tournois entry), dashboard analytics admin (DAU/MAU/funnel/inflation
  Crowns), moderation matchs humains.

- [**SPRINT Q — Differenciation fan / engagement narratif**](./docs/roadmap/sprints/SPRINT-Q-fan-differentiation.md)
  — **PLANIFIE** (post-Sprint P, 6-8 semaines) — career page joueur
  durable + rivalries, player-of-the-week vote, clips highlights auto
  MP4 vertical (TikTok/Shorts), prediction mini-leagues privees,
  Survivor Pick'em, Gazette commentaires + fan predictions.

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

- [Hardcodes skill registry residuels (B0.1)](./docs/roadmap/follow-up-b01.md) —
  blocking.ts (Stunty AV), movement.ts (Sure Feet, Sprint), foul.ts
  (Sneaky Git mixte). Estimation 3-4h.

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
