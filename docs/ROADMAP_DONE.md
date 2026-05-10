# Roadmap — Tâches terminées

## Session UI/Polish Pro League — 2026-05-10

12 lots livrés en une seule session (PRs #728-#742). Détail :
[`docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md`](./roadmap/sessions/2026-05-10-pro-league-ui-polish.md).

- [x] **Lot F** : `/admin/sim/health` — hub d'observabilité sim engine (drift + alerts + cross-links). PR #728.
- [x] **Lot A** : Drift watcher + race-bound alerts au-dessus de la table. PR #732.
- [x] **Lot C** : `/admin/sim/compare-versions` UI (wrapping `compareBaselines`). PR #730.
- [x] **Lot E** : Roster enrichi sur `/pro-league/teams/[slug]` — level, SPP progress bar, TV, stat bonuses, career counters. PR #731.
- [x] **Lot J** : `/admin/sim/loadtest` UI (wrap CLI `pnpm sim:loadtest:broadcaster` avec caps server-side stricts). PR #735.
- [x] **Lot G** : `/pro-league/teams/[slug]/players/[playerId]` — fiche joueur (stats + bonuses + skills + progression + carrière + pools d'accès G/A/S/P/M). PR #736.
- [x] **Lot H** : Roster filters (Tous/Actifs/Blessés) + tri (Nom/Position/Level/SPP/TV) + badge ⬆ ready. PR #737.
- [x] **Lot I** : Colonne TV sur `/pro-league/standings` + sort by TV (via `groupBy(tvCached)` filtre active). PR #738.
- [x] **Lot K** : Fix bug logique Lot H — le badge "ready to level-up" ne se déclenchait jamais. Flag `readyToLevelUp` server-side (`levelForSpp(spp) > rawDbLevel`). PR #739.
- [x] **Lot L** : Player match history (5 derniers matchs avec SPP delta TD/CAS/COMP/MVP via mining replay + `attributeSpp`). PR #740.
- [x] **Lot M** : Top earners widget sur page équipe (top 5 actifs par TV + total roster TV). PR #741.
- [x] **Lot N** : `/pro-league/me/wallet` — balance + ledger 20 dernières transactions colorisées par type (BET/WIN/REWARD/DAILY/BADGE). PR #742.

Tests : **2141 serveur (+61)** + **901 web (+31)**, typecheck clean.

## Sprint 0 — Bugfixes critiques & sécurité

- [x] **BUG-1** : Fix `armorSuccess = true` hardcodé dans actions.ts — les dodges ratés causent maintenant des blessures
- [x] **BUG-2** : Remplacer `Math.random()` par RNG seedé dans game-state.ts — résultats reproductibles
- [x] **BUG-3** : Câbler `handleInjuryByCrowd()` dans blocking.ts — surf fonctionnel
- [x] **SEC-1** : Auth middleware déjà présent sur `/admin/data/*`
- [x] **SEC-2** : Validation participant match dans socket room join

## Sprint 1 — Match online jouable

- [x] **B0.1** (partiel) : Brancher `skill-registry.ts` dans le moteur — skill-bridge créé, modifiers intégrés dans dodge/pickup/GFI (15+ skills activés : Two Heads, Break Tackle, Stunty, Very Long Legs, Prehensile Tail, Diving Tackle, Big Hand, Extra Arms, Pro, Pass, Catch, etc.)
- [x] **A.4** : Émettre gameState via WebSocket après chaque action — `broadcastGameState()` et `broadcastMatchEnd()` câblés dans POST /match/:id/move, émettent `game:state-updated` et `game:match-ended` sur le namespace /game
- [x] **A.5** : Hook client `useGameSocket(matchId)` — connexion socket.io au namespace /game avec auth JWT, join/leave match room, listeners typés pour state-updated/player-connected/player-disconnected/match-ended, intégré dans useGameState (remplace le polling 3-10s par WebSocket temps réel + fallback polling 30s)
