# Archive — Roadmap v1.0 → v1.73

> Date d'archivage : 2026-04-27
> Version livree : v1.73.0 (beta ouverte au public depuis #301)

Cette archive contient la roadmap historique du projet Nuffle Arena
**de la v1.0 (avril 2025, premier commit) jusqu'a la v1.73.0**, soit
les Sprints 0 a 23 et les phases A a Q (196 taches livrees).

## Pourquoi archiver ?

Toutes les phases planifiees dans cette roadmap ont ete cochees `[x]`
au 27 avril 2026 (cf commit `b8d549b` pour `phases.md`, commit
`8ca7707` pour `TODO.md`). Le document est devenu un journal de
completion plutot qu'une feuille de route active.

Le projet continue avec une **nouvelle feuille de route v2** dans
`docs/roadmap/phases.md` (page blanche pour les phases R+).

## Contenu

```
archive/v1.73/
├── README.md                                  ← ce fichier
├── TODO.md                                    ← table des sprints 0-23
├── phases.md                                  ← phases A a Q detaillees
├── audit-report.md                            ← audit code 2026-04-02
├── evolution-analysis-2026-04-12.md           ← plan sprints 12-20
├── sprint-0.md                                ← bugs critiques + securite
└── sprints/
    ├── README.md                              ← index des sprints 1-7
    ├── SPRINT-2-game-engine-stabilization.md
    ├── SPRINT-3-frontend-stabilization.md
    ├── SPRINT-4-server-security.md
    ├── SPRINT-5-test-infrastructure.md
    ├── SPRINT-6-badges-foundation.md
    ├── SPRINT-7-badges-match-cup-triggers.md
    └── FEATURE-BADGES-TITLES-REWARDS.md
```

## Bilan livre (Sprint 0 → 23)

| Phase | Taches | Sprint(s) |
|-------|--------|-----------|
| S0 — Bugfixes & securite | 5 | Sprint 0 |
| A — Multijoueur temps reel | 10 | Sprint 1 |
| B0 — Architecture skills | 2 | Sprint 1 |
| B1 — Regles BB3 critiques | 10 | Sprint 1-2 |
| B2 — Regles BB3 importantes | 10 | Sprint 6 |
| B3 — Star Players specials | 2 | Sprint 14 |
| C — Matchmaking & flow | 8 | Sprint 3-6 |
| D — Progression joueurs | 8 | Sprints anterieurs |
| E — Animations web | 7 | Sprint 9 |
| F — ELO & classement | 4 | Sprint 4 |
| G — Notifications push | 5 | Sprint 7 |
| H — Polish | 7 | Sprint 8-11 |
| I — Contenu & donnees | 10 | Sprint 8-11 |
| J — Traits negatifs | 11 | Sprint 12-13 |
| K — Skills fort impact | 13 | Sprint 13-15 + 20-21 |
| L — Ligues | 9 | Sprint 17 |
| M — Parite mobile | 12 | Sprint 18-19 |
| N — Croissance & engagement | 9 | Sprint 15-16 |
| O — Contenu & polish | 11 | Sprint 20-22 |
| P1 — Skills 5 equipes | 11 | Sprint 13 |
| P2 — Progression & Stars 5 equipes | 10 | Sprint 14 |
| Q — SEO, GEO & rayonnement | 27 | Sprint 23 |

**Total : 201 taches livrees** (S0 + A-Q + P1-P2).

## Dette qualite identifiee post-archive

Les hardcodes du skill registry (B0.1) ont ete documentes dans
`docs/roadmap/follow-up-b01.md` (toujours actif, hors archive).
Voir aussi le commit `97e063b` pour le refactor `passing.ts` realise
en post-Sprint 23.
