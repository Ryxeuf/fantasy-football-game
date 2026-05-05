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
  — **TERMINE** (Lots A/B/C livres en PRs #535-#545). Restes optionnels
  reportes en backlog ci-dessous.

- [**SPRINT Pro League — Championnat virtuel + Paris MVP**](./docs/roadmap/sprints/SPRINT-pro-league.md)
  — **P1** (post-Ligues v2) — Championnat permanent 16 equipes IA vs IA
  (hommages NFL × races BB), matchs auto diffuses live le mardi 21h, paris
  en Crowns, mode spectateur/fan, Nuffle Gazette LLM quotidienne. **Phase 0
  sim foundation bloquante** (8 sem : behavior trees, profils tactiques,
  variance Nuffle, bench harness, validation panel humain). **Phase 1 MVP**
  (4 sem : data model, broadcaster live SSE, UI, paris, Gazette,
  casualties, HoF light). Calendrier aligne saison NFL 2026-27 (kickoff
  cible 5 sept 2026). Backlog idees differees (MPG-layer mercato,
  multi-leagues, weather sync IRL...) consigne dans
  [`docs/roadmap/backlog/future-ideas.md`](./docs/roadmap/backlog/future-ideas.md).

## Suivi qualite actif

- [Hardcodes skill registry residuels (B0.1)](./docs/roadmap/follow-up-b01.md) —
  blocking.ts (Stunty AV), movement.ts (Sure Feet, Sprint), foul.ts
  (Sneaky Git mixte). Estimation 3-4h.

## Backlog

### Ligues v2 — restes optionnels

- [ ] **L2.C.4 — Promotion/relegation multi-tier** (Backend, L)
  Modele `LeagueTier` (D1/D2/D3) avec `League.tierId`. Service
  `applyPromotionRelegation(leagueId)` : top 2 montent / bottom 2
  descendent au passage de saison. Reporte de
  [`SPRINT-leagues-v2`](./docs/roadmap/sprints/SPRINT-leagues-v2.md)
  (L2.C.4) — explicitement marque optionnel. A activer si demande
  utilisateur (ligues longues, structure pyramidale).

- [ ] **L2.C.7 — Mobile parite ligues** (Mobile, L)
  Sur l'app Expo (`apps/mobile/app/leagues/`) : liste, detail saison,
  calendrier, classement, bouton inscription, bouton "Lancer match"
  qui redirige vers le flow match existant. Reporte de
  [`SPRINT-leagues-v2`](./docs/roadmap/sprints/SPRINT-leagues-v2.md)
  (L2.C.7). Reutilise i18n module S27.3.

### Autres

(a definir selon retours beta et priorites)
