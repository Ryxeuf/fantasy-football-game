# TODO — Nuffle Arena (Blood Bowl 3 Online)

> Derniere mise a jour : 2026-05-05
> Version actuelle : v1.73.0 (beta ouverte au public).
>
> La roadmap v1 (Sprints 0-23, Phases A-Q, 201 taches livrees) est
> archivee dans [`docs/roadmap/archive/v1.73/`](./docs/roadmap/archive/v1.73/README.md).

## Roadmap v2

La nouvelle feuille de route est dans
[`docs/roadmap/phases.md`](./docs/roadmap/phases.md) (page blanche
prete a accueillir les phases R+).

## Priorite immediate

- [**SPRINT Ligues v2 — Gestion complete des ligues Blood Bowl**](./docs/roadmap/sprints/SPRINT-leagues-v2.md)
  — **P0** — Sprint dedie a transformer l'infrastructure ligues
  (Sprint 17 archive) en produit utilisable : creation UI, inscription,
  calendrier auto round-robin, forfait, Jeu en Ligue post-match,
  awards de saison. Decoupe en 3 lots (MVP / Jeu en Ligue / Polish),
  ~12 jours, 7 PR planifiees. A demarrer immediatement.

- [**SPRINT Sim Engine — Fondation simulation Blood Bowl**](./docs/roadmap/sprints/SPRINT-sim-engine.md)
  — **P0** (post-Ligues v2) — **Priorite numero 1 a partir de maintenant.**
  Construire un moteur de simulation BB credible (driver hybride, 16 profils
  tactiques, variance Nuffle, bench harness vs FUMBBL, validation panel
  humain BB experts >= 7/10). Sprint **bloquant** pour PvE Bot et Pro
  League. ~10 sem (8 sem moteur + 2 sem polish PvE-ready : niveaux
  difficulte, latence interactive <500ms, 12 personnalites bot).

- [**SPRINT PvE Bot MVP — Vrais joueurs vs IA online**](./docs/roadmap/sprints/SPRINT-pve-bot-mvp.md)
  — **P1** (post Sim Engine, gate humain passe) — Mode killer pour
  onboarding et disponibilite 24/7. Integration sim-engine dans flow PvP
  existant + UI selection difficulte/personnalite + tutorial 4 matchs +
  historique PvE separe (pas d'impact ELO). ~4 sem. KPI 3 mois (>= 60%
  nouveaux jouent PvE, retention boost, NPS >= 35) declenche le SPRINT
  Pro League ou itere sur PvE.

- [**SPRINT Pro League — Championnat virtuel + Paris MVP**](./docs/roadmap/sprints/SPRINT-pro-league.md)
  — **P2/P3 (DIFFERE)** — Reactive uniquement si KPI PvE atteints. Champ.
  permanent 16 equipes IA vs IA, matchs auto live mardi 21h, paris en
  Crowns, mode fan, Nuffle Gazette LLM. ~5 sem. Backlog idees differees
  (MPG-layer mercato, multi-leagues, weather sync IRL...) consigne dans
  [`docs/roadmap/backlog/future-ideas.md`](./docs/roadmap/backlog/future-ideas.md).

## Suivi qualite actif

- [Hardcodes skill registry residuels (B0.1)](./docs/roadmap/follow-up-b01.md) —
  blocking.ts (Stunty AV), movement.ts (Sure Feet, Sprint), foul.ts
  (Sneaky Git mixte). Estimation 3-4h.

## Backlog

(a definir post-Sprint Ligues v2 selon retours beta et priorites)
