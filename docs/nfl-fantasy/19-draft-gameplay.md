# 19 — Draft + gameplay V1 (Phase A)

> Premier lot "module jouable" : `autoFillRosters` (V1 minimal viable
> sans draft interactif) + `finalizeLeague` + page lineup builder
> user-facing + cartes admin.

## Backend

### Service `nfl-fantasy-draft.ts`

| Fonction | Comportement |
|---|---|
| `autoFillRosters({ leagueId, playersPerEntry?, seed? })` | Distribue `playersPerEntry` (default 15, range 11-30) joueurs aleatoires deterministes (seed = leagueId par defaut) a chaque entry. Skip les entries deja remplies (idempotent partiel). |
| `finalizeLeague({ leagueId })` | Transitionne status `draft` → `in_progress` et appelle `seedStartingRerolls` (8 par entry V1) pour toutes. |
| `getDraftStats(leagueId)` | Stats UI : status + nombre de joueurs rostered par entry. |

### Helper pur `seededShuffle(seed, items)`

Fisher-Yates deterministe via mulberry32 PRNG + seed FNV hash. Pur,
testable. Reuse-able pour le snake draft interactif future Phase A'.

### Erreur typee `NflFantasyDraftError`

Codes : `LEAGUE_NOT_FOUND` (404) / `INVALID_STATUS` (409) /
`NO_ENTRIES` (422) / `POOL_TOO_SMALL` (422) /
`INVALID_PLAYERS_PER_ENTRY` (422). Mapping ajoute dans
`nfl-error-mapper.ts`.

### Routes admin ajoutees

| Method | Path | Service |
|---|---|---|
| POST | `/admin/nfl-fantasy/auto-fill-rosters` | `autoFillRosters` |
| POST | `/admin/nfl-fantasy/finalize-league` | `finalizeLeague` |
| GET | `/admin/nfl-fantasy/draft-stats/:leagueId` | `getDraftStats` |

### Endpoint user-facing modifie

`GET /api/nfl-fantasy/entries/:entryId/roster` retourne maintenant
les joueurs hydratees via `getRosterWithPlayers` :

```jsonc
{
  "roster": [
    {
      "rosterId": "cuid",
      "acquiredVia": "draft",
      "acquiredAt": "2026-05-20T...",
      "tvCost": 0,
      "player": {  // ★ joint depuis NflPlayer (sans realName, Q8)
        "id": "00-...",
        "pseudonym": "Le Sidearm Wizard de Kansas City, #15",
        "realNameDisplay": false,
        "teamCode": "KC",
        "nflPosition": "QB",
        "bbPosition": "Thrower",
        "jerseyNumber": null,
        "status": "active"
      }
    }
  ]
}
```

**Q8** : le `realName` n'est jamais expose cote API. Seul le
`pseudonym` + le flag `realNameDisplay` sortent du backend.

## Frontend

### Page `/nfl-fantasy/leagues/[id]/lineup`

V1 minimal : table avec checkboxes + radios captain/vice. Pas de
drag-and-drop (futur 3.C').

- Detecte l'entry de l'utilisateur via `/auth/me` + `league.entries`.
- Selecteur `weekId` (defaut `2025:W10`).
- Affiche le roster (sortable par nom), 11 starters max via checkbox.
- Captain ×1.5 + vice ×1.2 via radios (vice optionnel).
- Submit `PUT /api/nfl-fantasy/entries/:entryId/lineup` → recharge.
- Lock indicateur : si `lockedAt` set, inputs disabled + banner amber.

### CTA "Régler mon lineup"

Ajoute sur `/nfl-fantasy/leagues/[id]` quand `isMember && status =
"in_progress"`. Link vers la page lineup.

### Cartes admin `/admin/nfl-fantasy`

2 cartes ajoutees dans une nouvelle section "🎲 Draft (Phase A.1)" :

- **Auto-fill rosters** : leagueId + playersPerEntry (11-30 default 15)
- **Finalize league** : leagueId

Sequence type pour un admin :
```
1. createLeague (route user) → recoit inviteCode
2. joinLeague pour chaque member (route user)
3. admin /admin/nfl-fantasy : auto-fill-rosters
4. admin /admin/nfl-fantasy : finalize-league
5. users settent leur lineup chaque semaine via /nfl-fantasy/leagues/{id}/lineup
6. cron Sun 17h UTC : lockLineups
7. cron Tue 12h UTC : settleNflFantasyWeek (genere matchups + scores)
```

## Validation E2E

`scripts/nfl-fantasy-draft-e2e.ts`, **8 etapes OK** sur DB Postgres :

```
docker exec nufflearena_server sh -c "cd /app/apps/server && \
  pnpm exec tsx src/scripts/nfl-fantasy-draft-e2e.ts"
```

1. autoFillRosters → 2 entries x 15 = 30 picks
2. Re-run → 0 (idempotent partiel)
3. getDraftStats reflete 15 par entry
4. finalizeLeague → in_progress + 16 rerolls (8 × 2)
5. Re-finalize → rejet INVALID_STATUS (typee correctement)
6. setLineup 11 starters owner
7. setLineup 11 starters member
8. generateMatchups + settle W10 → scores réels (home=24 vs away=15
   sur stats W10 ingerees)

## Tests unitaires

| Fichier | Tests | Couvre |
|---|---|---|
| `nfl-fantasy-draft.test.ts` | 20 | seededShuffle (5) + autoFillRosters (7) + finalizeLeague (4) + getDraftStats (1) + Error + constants |
| `nfl-error-mapper.test.ts` | +1 | Nouveau test pour `NflFantasyDraftError` mapping HTTP |

## Hors scope V1 (Phase A')

- **Snake draft interactif** : tour par tour, ordre serpenté,
  `pickPlayer` par owner. Le helper pur `seededShuffle` est reuse-able.
- **Regles positionnelles** sur les starters : V1 accepte n'importe
  quels 11 joueurs distincts du roster. V2 enforcera (1 Thrower + 2
  Blitzers + ... selon la race de l'entry).
- **UI drag-and-drop** : aujourd'hui table checkbox-only. Suffisant
  pour V1, beautification en Phase 3.C'.
- **Page matchups** dediee : aujourd'hui les scores se voient via
  `GET /api/nfl-fantasy/leagues/:id/matchups?weekId=` (route existante
  Phase 2.G) ou indirectement via `lineup.totalSpp` apres settle. Une
  page UI dediee `/nfl-fantasy/leagues/[id]/matchups` est Phase 3.D.
