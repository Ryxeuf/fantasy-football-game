# Ligue offline — Phase 5 (polish) — 2026-06-01

Dernier lot du workstream « saisie manuelle offline » (cf. service
`apps/server/src/services/league-offline-result.ts`, option b : un `Match`
synthetique `mode:"offline"` reutilise tout le pipeline `recordLeagueMatchResult`).

Phase 5 corrige deux effets de bord du Match synthetique offline, identifies
en fin de workstream.

## 1. Exclure les matchs `offline` de l'historique perso

Le Match offline est cree avec `players: { connect: [ownerHome, ownerAway] }`
(pour rattacher le match aux 2 coachs et nourrir le pipeline). Du coup il
remontait dans les surfaces d'historique qui filtrent
`players: { some: { id: userId } }` — alors qu'il n'a **ni turns ni gameState**
(carte 0-0 vide, lien replay cassé).

Surfaces auditees :

| Surface | Statut | Action |
|---|---|---|
| `GET /me/matches` (`routes/user.ts`) | ⚠️ fuyait | **filtre `mode: { not: "offline" }`** sauf `?mode=async\|realtime` |
| `GET /match/my-matches` (`routes/match-details-handlers.ts`) | ⚠️ fuyait | **filtre `mode: { not: "offline" }`** |
| `GET /match/live` | ✅ deja safe | filtre `status IN ['active','prematch-setup']`, l'offline est `completed` |
| `exportGdprUserData` (RGPD) | ✅ inchange | la completude RGPD impose de **garder** l'offline |
| `GET /admin/matches`, `/admin/dashboard` | ✅ inchange | l'admin doit voir tous les matchs |

Constante `OFFLINE_MATCH_MODE` extraite dans un module minimal sans dependance
`apps/server/src/services/match-modes.ts`, importable depuis les routes chaudes
sans tirer tout le pipeline ligue.

## 2. Cycle de vie `missNextMatch` en offline

En online, le flag `missNextMatch` (Seriously Hurt / Serious Injury / Lasting
Injury → rate le prochain match) est **efface par le game-engine** au demarrage
du match suivant (`match-start.ts` : `updateMany` sur les 2 equipes,
`missNextMatch:true & dead:false → false`) et lors de l'attribution SPP post-match
(`spp-tracking.ts`).

Les matchs offline **ne passent pas par le game-engine** → sans correctif, un
joueur suspendu en offline restait suspendu **a vie**.

Correctif : `recordOfflineLeagueResult` purge le flag pour les joueurs (non morts)
des 2 equipes via `clearServedSuspensions`, **mirror exact de `match-start.ts`**.
Ordre critique :

1. `clearServedSuspensions(home, away)` — purge les suspensions purgees par CE match,
2. **puis** `applyOfflineInjuries` — re-pose `missNextMatch` pour les blessures
   encaissees DANS ce match (suspension du match suivant).

Semantique : enregistrer le resultat du match N signifie « le match N a eu lieu » →
toute suspension issue de N-1 est consideree purgee, et les blessures de N
suspendent pour N+1. Le flag reste **advisory** en offline (honor system : le
createur choisit qui joue), le correctif garantit juste qu'il ne se bloque jamais.

## Tests

- `league-offline-result.test.ts` : +2 tests (purge des 2 equipes ; purge AVANT
  les blessures pour que la suspension du match suivant survive). 8/8.
- `match.test.ts` : assertion `where` de `/match/my-matches` mise a jour avec
  `mode: { not: "offline" }`. 64/64.
- `tsc --noEmit` server : clean.

## Hors-scope (assume)

- Pas de changement web : `/me/matches/async` passe deja `?mode=async` ; les autres
  listes de matchs web ciblent la pro league (modele distinct).
- Pas de maj page regles (`/nfl-fantasy/rules`) : aucun changement de regle
  SPP/scoring, on aligne juste le cycle offline sur l'online existant.
