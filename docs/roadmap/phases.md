# Roadmap v2 — Sprints 24-27

> Derniere mise a jour : 2026-05-10
> Contexte : v1.74.0 livree (beta publique). Roadmap v1 archivee dans
> [`archive/v1.73/`](./archive/v1.73/README.md). Cette nouvelle roadmap
> couvre les 4 sprints initiaux S24-27 + sprints post-audit O-R derives
> du gap analysis 2026-05-10.

## Index des sprints

| Sprint | Theme | Fichier | Etat |
|--------|-------|---------|------|
| **S24** | Stabilite & DX core (fix P0 + securite + hot-reload dev) | [sprints/S24-stabilite-securite.md](./sprints/S24-stabilite-securite.md) | TERMINE |
| **S25** | Observabilite, perf & qualite (logs, metrics, tests, bundle) | [sprints/S25-observabilite-qualite.md](./sprints/S25-observabilite-qualite.md) | TERMINE |
| **S26** | Refactor + Retention & engagement (page.tsx prerequis, achievements, profil, ligues) | [sprints/S26-retention-engagement.md](./sprints/S26-retention-engagement.md) | TERMINE |
| **S27** | Evolutions & confort (esport, mobile parite, S4 skeleton, audit log, B0.1 residuels) | [sprints/S27-evolutions-confort.md](./sprints/S27-evolutions-confort.md) | TERMINE |
| **Ligues v2** | Gestion complete des ligues BB (creation UI, inscription, calendrier auto, forfait, Jeu en Ligue post-match, awards) | [sprints/SPRINT-leagues-v2.md](./sprints/SPRINT-leagues-v2.md) | TERMINE |
| **Pro League** | Championnat virtuel 16 equipes IA vs IA, matchs auto mardi 21h, paris Crowns, Gazette LLM, Hall of Fame | [sprints/SPRINT-pro-league.md](./sprints/SPRINT-pro-league.md) | TERMINE Phase 0 + 1 (session polish 2026-05-10 livre 12 lots #728-#742) |
| **Sprint O** | **Bug fixes engine + deblocage acquisition** (regles BB Perfect Defence/Illegal Procedure/regen order, skills registry, registration auto-approve, onboarding, OG image, share) | [sprints/SPRINT-O-bug-fixes-acquisition.md](./sprints/SPRINT-O-bug-fixes-acquisition.md) | **TERMINE** — Skill registry O.A.2-4 livre 2026-05-11. O.B.2 email verification livre 2026-05-15. Seul O.A.6 (Illegal Procedure) reste differe (scope referee transverse, a traiter en lot dedie). |
| **Sprint P** | **Ops readiness + scaling 10k MAU** (mode maintenance, season factory, admin wallet, password reset, soft-delete + GDPR, sinks Crowns, dashboard analytics) | [sprints/SPRINT-P-ops-readiness.md](./sprints/SPRINT-P-ops-readiness.md) | **TERMINE** — verifie 2026-05-15. 10/10 lots livres (P.A.1-3, P.B.1-4, P.C.1-3). |
| **Sprint Q** | **Differenciation fan / engagement narratif Pro League** (career pages, MVP vote, clips highlights MP4, mini-leagues privees, Survivor Pick'em, commentaires Gazette) | [sprints/SPRINT-Q-fan-differentiation.md](./sprints/SPRINT-Q-fan-differentiation.md) | **TERMINE 9/13** — Q.A, Q.B, Q.D livres session 2026-05-12 (PRs #772-#784). Q.C (clips highlights MP4) differe a un sprint video dedie. |
| **Sprint R** | **International + monetisation + mobile release** (i18n EN/DE/PL/ES, Patreon + Season Pass, App Store + Play Store, Discord, ambassadeurs, NAF, PvP async tours-par-jour) | [sprints/SPRINT-R-international-monetization-mobile.md](./sprints/SPRINT-R-international-monetization-mobile.md) | **EN COURS 7/19** — R.A.1 + R.A.4 + R.B.3 + R.D.3 + R.E (3 lots) livres. Reste i18n traductions (XL), Patreon + cosmetics, mobile release, Discord + casters. |

> **Win condition 12 mois (Sprint R termine) :** 10 000 MAU + top 3
> reconnaissance BB online FR/EN/DE. Voir
> [session log 2026-05-10](./sessions/2026-05-10-pro-league-ui-polish.md)
> pour le contexte et l'audit complet 7 agents qui derive O-R.

## Suivi qualite actif

- [Hardcodes skill registry residuels (B0.1)](./follow-up-b01.md) —
  Stunty AV, Sure Feet/Sprint GFI, Horns, Sneaky Git, Pile Driver.
  Adresses en **Sprint O lot O.A.2-4**.

## Items ecartes / backlog

| Pourquoi | Items |
|----------|-------|
| Faux positifs (deja faits) | A.9 badge connexion, I.6 specialRules star players, O.2 / O.3 audit S2/S3 |
| Differes (non prioritaires) | Replay public sharable, OpenTelemetry full, CodeQL CI, lore par equipe, season passes / cosmetics premium |
| Hors scope 4 sprints | E2E mobile Detox/Appium (chantier complet, 1 sprint dedie a prevoir) |
| Backlog idees Pro League differees | MPG-layer mercato, multi-leagues, weather sync IRL, NFL Twin Mirror, Twitch auto-cast, etc. — voir [`backlog/future-ideas.md`](./backlog/future-ideas.md) |

## Source

Audit conduit le 2026-04-27 par 10 agents Explore en parallele (game
engine, frontend web, mobile, backend/API/DB, tests/CI, securite,
performance/scaling, DX/monitoring, contenu/data/i18n, engagement/
retention). 74 findings consolides en 32 taches reparties sur 4 sprints.
