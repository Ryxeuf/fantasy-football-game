# SPRINT Sim Engine — Observability + Full Driver + Sandbox

> Statut : **planifié** (2026-05-07)
> Owner : `@bb/sim-engine`, `apps/server`, `apps/web/admin`
> Phase 1 livrée : PRs #655 + #658 (engineVer 0.13.0 → 0.16.0)

## Contexte

Phase 1 (terminée) a corrigé les bugs narratifs du hybrid driver
(turnover→TD, breakthrough yards, hasPossession dead state, passes
qui n'avancent pas, sub-turn timing) et introduit les events `MOVE`
pour rendre chaque yard visible sur la timeline.

Ce sprint cible trois objectifs successifs :

1. **Phase 2 — Observabilité** : on doit *voir* le moteur (drift,
   stabilité, broadcaster, conformité FUMBBL) avant de le faire
   évoluer. Filet de sécurité pour Phase 3.

2. **Phase 3 — Full Driver MVP** : remplacer la synthèse
   archétype-vs-archétype (`home-LOS` / `away-LOS`) par des matchs
   joueur-par-joueur avec vraies rosters, casualties spécifiques,
   SPP réelle. Replays roster-aware.

3. **Phase 4 — Production hardening** : robustesse, perfs,
   comparaisons inter-saisons, scaling broadcaster si nécessaire.

L'observabilité s'appuie sur la stack **Grafana + Loki + Prometheus
+ Traefik** déjà en place (cf. `grafana.ryxeuf.fr`). Aucun service
tiers payant. cAdvisor remonte déjà RAM/CPU par container, Loki
indexe les logs JSON pino structurés (`service: "@bb/server"`,
`level`, `time`, `err`), et l'alerting Grafana est configuré.

---

## Phase 2 — Observabilité (~2 semaines)

### Lot 2.A — Instrumentation backend (~5 jours)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **2.A.1** | Audit `serverLog` (pino). Vérifier que `simulateProMatch`, broadcaster, sim-runner émettent en JSON structuré avec `service`, `matchId`, `engineVer`, `seasonId`, `seed`. Aligner ce qui ne l'est pas. | S | TODO |
| **2.A.2** | Endpoint `/metrics` Prometheus via `prom-client`. Exposé en interne Docker. Module `apps/server/src/metrics.ts` qui définit les compteurs/histogrammes/gauges. | S | TODO |
| **2.A.3** | Instrumenter `pro-league-sim-runner.ts` — métriques : `nuffle_sim_match_duration_seconds{engineVer,homeRace,awayRace,outcome}`, `nuffle_sim_match_total{status}` (success/failed), `nuffle_replay_size_bytes{engineVer}`. | M | TODO |
| **2.A.4** | Instrumenter `pro-league-match-broadcaster.ts` — métriques : `nuffle_broadcaster_active_sessions`, `nuffle_broadcaster_total_subscribers`, `nuffle_broadcaster_event_dispatch_lag_ms` (histogram, mesure `Date.now() - (startedAt + displayAtMs)`). | M | TODO |
| **2.A.5** | Service `engine-drift-watcher.ts` — calcul horaire de la drift réelle (rolling 7 jours sur `proLeagueMatch` joués) vs `bench-baseline.json` et `reference-fumbbl.json`. Push gauge `nuffle_engine_drift{metric,race,seasonId}`. Run via setInterval (compatible avec l'archi sim-runner existante). | M | TODO |

### Lot 2.B — Visualisation + alerting (~3 jours)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **2.B.1** | Dashboard Grafana JSON "Sim Engine" (sessions live, drift par race, latence dispatch, sim duration p50/p95, taux failed). | M | **DEFERRED** (à monter ensemble) |
| **2.B.2** | Alert rules Grafana (drift, failure rate, broadcaster lag). | S | **DEFERRED** (après dashboard) |
| **2.B.3** | UI `/admin/sim/health` — dashboard interne minimaliste (table par race : winrate observée vs FUMBBL avec 🟢🟡🔴, tdMean rolling, drift par métrique, dernière sim datetime). Sert de fallback quand Grafana est down. | M | TODO |
| **2.B.4** | UI `/admin/broadcaster/stats` — sessions actives, subscribers, lag p95 en live (refresh 5s). Branche sur `getBroadcasterStats()` qui existe déjà + nouvelles métriques 2.A.4. | S | TODO |

### Lot 2.C — Sandbox / test mode (~1 semaine)

> Critique pour valider Phase 3 avant promotion en prod. Permet de
> lancer des matchs sans impact ELO / ligue / paris depuis l'admin.

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **2.C.1** | Schema Prisma — flag `ProLeagueMatch.isTest = boolean default false` (ou modèle séparé `SandboxMatch` selon impact sur les requêtes existantes). Migration. | S | TODO |
| **2.C.2** | Backend route `POST /admin/sim/test-match` — input : `{ homeTeamId, awayTeamId, seed?, driver: 'hybrid' \| 'full', weather? }`. Output : `{ matchId }`. Crée un match `isTest=true`, l'envoie au sim-runner, retourne l'id pour suivi. | M | TODO |
| **2.C.3** | Guards — les matchs `isTest=true` sont **exclus** des : standings (`/api/pro-league/standings`), classement ELO (`pro-league-standings.ts`), paris (création de bets refusée), distribution wallet, leaderboards. À auditer service par service. | M | TODO |
| **2.C.4** | UI `/admin/sim/test-match` — formulaire (selection rosters, seed override optionnel, driver hybrid/full, weather), bouton "lancer", redirection vers replay une fois `status='ready'`. Liste des derniers test matches lancés. | M | TODO |
| **2.C.5** | Intégration replay — le replay d'un test match utilise la même infra broadcaster + replay viewer. Bandeau "TEST MATCH — does not count" sur les pages de visualisation. | S | TODO |

### Livrable Phase 2

À la fin de la Phase 2, on peut affirmer **avec preuves chiffrées** :
- "Le moteur 0.16.0 produit en prod un tdMean de X ± σ, conforme à FUMBBL à ±N% par race"
- "Le broadcaster tient Y sessions concurrentes avec un lag p95 de Z ms"
- "Aucune drift détectée sur les 30 derniers jours"
- "Un admin peut lancer un test match en 30 secondes pour valider une nouvelle version d'engine"

C'est le filet de sécurité indispensable pour Phase 3.

---

## Phase 3 — Full Driver MVP (~4-6 semaines)

> **Hypothèse à valider en Lot 3.A.1** : l'AI de
> `packages/game-engine/src/ai/` est suffisamment mature pour de
> l'auto-play déterministe. Si ce n'est pas le cas, Phase 3 grossit
> d'un sous-projet IA avant de pouvoir continuer.

### Lot 3.A — Driver foundation (~3 semaines)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **3.A.1** | **Audit AI game-engine** — analyse de la qualité de décision tour par tour (move/block/pass/foul). 50 matchs auto-play vs benchmark FUMBBL. Décision : "AI ready" / "AI needs work + plan détaillé". | M | TODO |
| **3.A.2** | **`runFullDriver(input)`** — orchestrateur tour par tour qui boucle : `currentTeam.aiDecideAction → applyAction(state, action) → emit MatchEvent`. Réutilise les resolvers BB existants de game-engine. Pinné derrière un toggle `season.driverKind`. | XL | TODO |
| **3.A.3** | **Mapping actions → MatchEvent** — convertir les `Action` du game-engine en wire-events lisibles. Nouveaux types : `PLAYER_ACTIVATION`, `KNOCKDOWN`, `BLITZ_DECLARED`. Maintenir compatibilité descendante via `engineVer` bump. | L | TODO |
| **3.A.4** | **Roster-aware meta** — chaque event porte `playerId`, `playerName`, `playerPosition`. Le narrator passe de "home-LOS plaque away-LOS" à "Bob le Blitzer plaque Carla la Thrower". Mise à jour `replay/narrator.ts`. | M | TODO |

### Lot 3.B — Cohabitation hybrid / full (~1-2 semaines)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **3.B.1** | Champ Prisma `season.driverKind = 'hybrid' \| 'full'` (default `hybrid`). Le sim-runner choisit le driver en fonction. Migration + tests. | S | TODO |
| **3.B.2** | **Infra A/B test** — script `scripts/compare-drivers.ts` qui sime les mêmes seeds en hybrid + full, compare TD/cas/turnover/winrate par race. Push résultats dans Prometheus pour visualiser le delta dans Grafana. | M | TODO |
| **3.B.3** | **Perf baseline** — durée de sim/match, taille replay compressé, nb events/match par driver. Si full driver fait des replays >10× plus gros, on ajoute un mode `verbose=false` qui filtre les events triviaux. | M | TODO |

### Lot 3.C — Roster lifecycle (~1 semaine)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **3.C.1** | **Casualty roster impact** — quand le full driver émet une `CASUALTY` sur un `playerId` réel, le service `pro-league-casualty-applier.ts` doit retirer le joueur N matchs (déjà partiel). Audit + complétion. | M | TODO |
| **3.C.2** | **SPP / progression** — TD/CAS/MVP réels → XP réelle vers le joueur réel → level-up entre matchs. Probablement déjà partiel dans game-engine pour le mode interactif, à brancher en mode auto. | L | TODO |

### Livrable Phase 3

- Une saison Pro League peut tourner en `driverKind = 'full'` avec
  replays roster-aware
- A/B test prouve : "le full driver dérive de FUMBBL de moins de 5%, p99 sim duration < 3s"
- Carrières joueur évoluent réellement (SPP, casualties, level-ups)
- Phase 2 metrics confirment broadcaster + storage tiennent la charge
- Test mode (Lot 2.C) permet de lancer des matchs full driver sans
  affecter ligue / ELO / paris

---

## Phase 4 — Production hardening (~2-3 semaines)

À traiter **après** que le full driver tourne en prod sur ≥1 saison
sans incident.

### Lot 4.A — Robustesse (~1 semaine)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **4.A.1** | **Error tracking enrichi** — query Loki structurées + Grafana alert rules ciblées (par `err.type`, par `engineVer`, par race). Équivalent fonctionnel d'un Sentry sur la stack Loki. | M | TODO |
| **4.A.2** | **Slow sim profiling** — capture `console.profile`-style stack trace pour les sims qui dépassent un seuil (p99 + 1σ). Pour traquer les corner-case du full driver. | M | TODO |
| **4.A.3** | **Alertes raffinées** — drift par race (ex : Halflings devraient être <40% winrate, alerte si >50% sur 7j), engine version mismatch en prod. | S | TODO |

### Lot 4.B — Comparaisons inter-saisons (~1 semaine)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **4.B.1** | **Cross-version comparator** — UI admin qui compare engineVer N vs N+1 sur les mêmes seeds (2000 runs). Visualise la drift introduite par chaque bump. À faire **avant chaque release** d'un bump majeur. | M | TODO |
| **4.B.2** | **Replay diff tool** — given two replays of same seed sur deux engineVer, diff événement par événement avec annotation "où ça diverge". Outil de debug pour les régressions déterministes. | L | TODO |

### Lot 4.C — Scale (~1 semaine, à faire si besoin)

| Lot | Description | Effort | Statut |
|---|---|---|---|
| **4.C.1** | **Load test broadcaster** — script qui simule 1000+ subscribers concurrents sur 10 matchs. Mesure CPU, RAM, lag dispatch p99. Identifie le seuil de scaling. | M | TODO |
| **4.C.2** | **Redis pub/sub broadcaster** (si nécessaire) — passe le broadcaster en multi-instance via Redis. Mentionné en "Phase 2" dans `pro-league-match-broadcaster.ts`, à activer si scaling horizontal devient nécessaire. | L | TODO |

---

## Ordre de bataille recommandé

```
Maintenant      Phase 2.A (instrumentation)        ~5 jours
                Phase 2.B.3 + 2.B.4 (admin UIs)     ~3 jours
                Phase 2.C (sandbox / test mode)     ~1 semaine
                  ↓
                ⏸ pause prod pour observer baseline ~1 semaine
                  ↓
                Phase 2.B.1 + 2.B.2 (Grafana)       config ensemble
                  ↓
                Phase 3.A.1 (audit AI)              ~3 jours
                  ↓
                Décision : feu vert full driver, ou sous-projet IA d'abord
                  ↓
                Phase 3.A.2-3.A.4                   ~3 semaines
                Phase 3.B (cohabitation)            ~1-2 semaines
                Phase 3.C (roster lifecycle)        ~1 semaine
                  ↓
                Saison test en `driverKind='full'`
                  ↓
                Phase 4 selon besoin
```

## Décisions architecturales actées

- **Pas de service tiers payant** (Sentry / Datadog / etc.) — la
  stack Grafana + Loki + Prometheus + Traefik en place couvre
  l'ensemble des besoins.
- **Engine version pinning par saison** déjà actif via
  `season.engineVer` (lot 1.A.5) — protège les matchs déjà simulés
  contre les bumps d'engine.
- **Broadcaster in-process EventEmitter** au MVP — Redis pub/sub
  reportée en Phase 4.C.2 si besoin de scaling horizontal.
- **Test mode via flag `isTest`** sur `ProLeagueMatch` plutôt qu'un
  modèle séparé — minimise la duplication, mais nécessite d'auditer
  chaque service qui agrège (standings, paris, wallet) pour exclure
  les matchs `isTest`.
- **Sub-turn timing** déjà en place (#5) : NUFFLE T+2s, key moments
  T+5/+10/+15s, bulk T+20s. Le full driver devra réutiliser ces
  offsets ou en proposer une variante adaptée à 11+ activations par
  tour.
