# Roadmap v2 — Sprints 24-27

> Derniere mise a jour : 2026-05-05
> Contexte : v1.74.0 livree (beta publique). Roadmap v1 archivee dans
> [`archive/v1.73/`](./archive/v1.73/README.md). Cette nouvelle roadmap
> couvre les 4 sprints suivants, derives d'un audit a 10 agents.

## Index des sprints

| Sprint | Theme | Fichier | Etat |
|--------|-------|---------|------|
| **S24** | Stabilite & DX core (fix P0 + securite + hot-reload dev) | [sprints/S24-stabilite-securite.md](./sprints/S24-stabilite-securite.md) | TERMINE |
| **S25** | Observabilite, perf & qualite (logs, metrics, tests, bundle) | [sprints/S25-observabilite-qualite.md](./sprints/S25-observabilite-qualite.md) | TERMINE |
| **S26** | Refactor + Retention & engagement (page.tsx prerequis, achievements, profil, ligues) | [sprints/S26-retention-engagement.md](./sprints/S26-retention-engagement.md) | TERMINE |
| **S27** | Evolutions & confort (esport, mobile parite, S4 skeleton, audit log, B0.1 residuels) | [sprints/S27-evolutions-confort.md](./sprints/S27-evolutions-confort.md) | A faire |
| **Ligues v2** | **PRIORITE** Gestion complete des ligues BB (creation UI, inscription, calendrier auto, forfait, Jeu en Ligue post-match, awards) | [sprints/SPRINT-leagues-v2.md](./sprints/SPRINT-leagues-v2.md) | A faire (P0) |
| **Sim Engine** | **PRIORITE P0 post-Ligues v2** Fondation simulation BB (driver hybride, 16 profils tactiques, variance Nuffle, bench harness, validation panel humain). Bloquant pour PvE et Pro League. ~10 sem. | [sprints/SPRINT-sim-engine.md](./sprints/SPRINT-sim-engine.md) | A faire (P0) |
| **PvE Bot MVP** | Vrais joueurs vs IA online avec niveaux de difficulte (Easy/Normal/Hard/Nuffle's Wrath), 12 personnalites bot, tutorial 4 matchs, mode killer pour onboarding et disponibilite 24/7. ~4 sem. | [sprints/SPRINT-pve-bot-mvp.md](./sprints/SPRINT-pve-bot-mvp.md) | A faire (P1, post Sim Engine) |
| **Pro League** | Championnat virtuel 16 equipes IA vs IA (hommages NFL × races BB), matchs auto diffuses live le mardi 21h, paris en Crowns, mode spectateur/fan, Nuffle Gazette LLM. **Differe**, depend du retour PvE 3 mois (KPI). ~5 sem. | [sprints/SPRINT-pro-league.md](./sprints/SPRINT-pro-league.md) | Differe (P2/P3, post-PvE) |

## Suivi qualite actif

- [Hardcodes skill registry residuels (B0.1)](./follow-up-b01.md) — solde
  prevu en S27.7. Stunty AV, Sure Feet/Sprint GFI, Horns, Sneaky Git.

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
