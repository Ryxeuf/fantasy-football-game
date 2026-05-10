# Session UI/Polish Pro League — 2026-05-10

> 12 lots livres en une seule session (Claude Code). Branche directe
> sur main, PR independantes, merges sequentiels.
>
> Source : suite des sprints 1.C / 1.D / 2.B / 4.A-F deja livres. Cette
> session ferme des gaps UX residuels (drill-down joueur, top earners,
> wallet, broadcaster load test) et corrige un bug logique introduit
> par Lot H (badge "ready" jamais declenche).

## Recap des 12 lots

| Lot | Titre | Surface | PR |
|-----|-------|---------|----|
| **F** | Sim health hub | admin | #728 |
| **A** | Drift watcher + alerts | admin | #732 |
| **C** | Compare engine versions UI | admin | #730 |
| **E** | Roster level/SPP/TV/bonuses/career | pro-league/teams | #731 |
| **J** | Broadcaster load test UI | admin | #735 |
| **G** | Player detail page | pro-league/teams/:slug/players/:id | #736 |
| **H** | Roster filters/sort + ready badge | pro-league/teams/:slug | #737 |
| **I** | Standings TV column + sort by TV | pro-league/standings | #738 |
| **K** | Fix ready badge phantom (audit applier) | pro-league | #739 |
| **L** | Player match history (per-match SPP delta) | pro-league/players | #740 |
| **M** | Top earners widget | pro-league/teams/:slug | #741 |
| **N** | Wallet page + ledger transactions | pro-league/me/wallet | #742 |

## Surfaces backend touchees

### Nouveaux services
- `pro-league-sim-health` (F) — snapshot drift + bound alerts + last sim.
- `pro-league-broadcaster-loadtest` (J — deja existant, expose via route).
- `pro-player-detail` (G) — fiche joueur agregee.
- `pro-player-match-history` (L) — mine replays + reutilise `attributeSpp`.

### Services etendus
- `pro-league-team` : +`topEarners` (M), +`totalRosterTv` (M),
  +`progression.readyToLevelUp` (K).
- `pro-league-standings` : +`teamValue` via `groupBy(tvCached)` filtre
  status='active' (I).
- `admin-tools` : `compareBaselines` expose (C).

### Nouvelles routes
| Route | Lot | Auth |
|-------|-----|------|
| `POST /admin/sim/loadtest` | J | admin |
| `GET /api/pro-league/players/:id` | G | public |
| `GET /api/pro-league/players/:id/history?limit=N` | L | public |

### Bug fix critique
- **Lot K** : `nextLevelSpp(spp)` retourne le seuil **strictement
  superieur** a spp. La condition `spp >= nextLevelSpp` de Lot H etait
  donc mathematiquement impossible et le badge ne se declenchait
  jamais. Fix : flag `readyToLevelUp` calcule server-side via
  `levelForSpp(spp) > rawDbLevel`.

## Surfaces frontend touchees

### Nouvelles pages
- `/admin/sim/loadtest` (J).
- `/pro-league/teams/[slug]/players/[playerId]` (G).
- `/pro-league/me/wallet` (N).

### Pages enrichies
- `/admin/sim/health` (F, K, J) — alerts + cross-links.
- `/pro-league/standings` (I) — colonne TV + sort.
- `/pro-league/teams/[slug]` (E, G, H, M) — roster enrichi + filtres/
  sort + top earners widget + link nom joueur.

## Tests

| Domaine | Avant session | Apres session |
|---------|---------------|---------------|
| `@bb/server` | ~2080 | **2141** |
| `@bb/web` | ~870 | **901** |

Tous typecheck OK, aucun commentaire de review en attente.

## Patterns recurrents (a reutiliser)

### Backend
- **Caps server-side stricts** (Lot J) : un wrapper d'un CLI offline
  doit avoir des caps Zod plus stricts pour eviter de saturer
  l'event loop prod (matches ≤ 50, subscribers ≤ 1000 vs CLI 5000).
- **Aggregation `groupBy` au lieu de N+1** (Lot I, M) :
  `prisma.proTeamRoster.groupBy({ by: ['teamId'], _sum: { tvCached: true } })`
  pour 16 equipes = 1 round-trip.
- **Reuse de logique pure** (Lot L) : `attributeSpp(events, casualties)`
  est pur ⇒ on peut le rappeler en read-only sur les replays existants
  sans dupliquer les regles BB.
- **Fallback retired/dead** (Lot L) : pour les services qui filtrent par
  `status='active'`, prevoir un fallback si le rosterId vise est
  desormais retired (ex: SPP history). Ajout manuel cote correct via
  `teamId`.
- **Flag brut + flag computed** (Lot K) : quand l'API expose une valeur
  computed pour cacher un lag (ex: `level = max(rawDb, computed)`), il
  faut **aussi** exposer un flag brut (`readyToLevelUp`) pour
  signaliser cote UI l'etat "en attente".

### Frontend
- **Promise.all([detail, optional])** (Lot L) : charger un endpoint
  principal + un endpoint optionnel en parallele dans le meme
  `useEffect`. Catch sur l'optionnel ⇒ `[]` au lieu de bloquer
  l'affichage du detail.
- **Backwards-compat** : ajouter un champ optionnel `?` cote UI quand
  l'API change. Permet de deployer le frontend avant la prochaine PR
  serveur si besoin.
- **`data-testid` parlants** : `roster-toolbar`, `top-earner-1`,
  `player-history-row`, `wallet-tx-bet`. Plus stables que les texte
  selectors avec i18n.

### Git workflow
- **PRs paralleles depuis main** : les 4 PR F/A/C/E ont ete creees
  toutes depuis main sans rebase. Conflits potentiels resolus en M
  qui touchait des composants partages (RosterTable signature). Quand
  c'est trop risque, sequencer.
- **`git checkout main && git pull && git checkout -b claude/lot-X`**
  systematiquement entre chaque lot pour repartir propre.

## Cumul cibles roadmap

Ces 12 lots etendent les sprints :
- **Sprint Pro League** lots **1.C** (UI), **1.D** (paris/wallet),
  **2.B** (admin observability), **4.A-F** (drift / replay tools).
- **Pas de scope nouveau** vs `SPRINT-pro-league.md` — pure
  consolidation UX.

## Liens

- [Sprint Pro League](../sprints/SPRINT-pro-league.md) — sprint
  d'origine (Phase 0 + Phase 1 livres).
- [TODO.md](../../../TODO.md)
