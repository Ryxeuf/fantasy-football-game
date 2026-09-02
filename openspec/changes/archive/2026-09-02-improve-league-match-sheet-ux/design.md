# Design — Refonte UX feuille de match de ligue

## Contexte

`apps/web` ne dépend **pas** de `@bb/game-engine` ; seul `apps/server`
l'importe. Les catalogues (météo, coups de pouce, Star Players) et le
calcul de budget vivent dans le moteur :

- `core/weather-types.ts` — `WEATHER_TYPES` (12 tables × résultats 2..12,
  `{ condition, description }`).
- `core/inducements.ts` — `INDUCEMENT_CATALOGUE`, `calculatePettyCash`.
- `rosters/star-players.ts` — `getAvailableStarPlayers(roster)`.
- `rosters/positions.ts` — `TEAM_ROSTERS[roster].name` (libellé race).

## Décision : enrichir l'API plutôt qu'importer le moteur côté web

On expose un bloc **`reference`** depuis `getMatchSheet` (le serveur
importe déjà le moteur), consommé via `apiRequest` comme le reste de la
page. Évite d'ajouter `@bb/game-engine` au bundle Next.js et garde le
calcul de budget (petty cash) côté serveur, source de vérité.

```
GET /leagues/pairings/:id/sheet
  -> { sheet, summary, viewerRole,
       teams: { home, away },           # + raceName, coachName, teamValue,
                                        #   currentValue, treasury
       reference: {
         weatherTables[],               # WEATHER_TYPES aplati (roll trié)
         inducements[],                 # INDUCEMENT_CATALOGUE sauf star_player
         starPlayers: { home, away },   # getAvailableStarPlayers(roster)
         budget: { home, away },        # calculatePettyCash(CTV, treasury)
       } }
```

## Décision : mi-temps / tour dans `meta` (pas de migration)

`LeagueMatchEvent.meta` (`Json?`) existe déjà. `addEventSchema` gagne
`half`/`turn` validés (1..2 / 1..16), fusionnés dans `meta` côté service
sans écraser un `meta` fourni. La mémoire projet rappelle que les
migrations dev sont fragiles → on évite une colonne dédiée.

## Décision : budget — enforcement double + comptabilité petty cash

- **Save** (`updatePreMatch`) : si une sélection de coups de pouce est
  fournie, on calcule le budget (`calculatePettyCash` sur les CTV +
  trésorerie) et on rejette le dépassement (`inducement_over_budget`).
- **UI** : jauge + bouton désactivé si dépassement (feedback immédiat).
- **Validation** (`buildOfflineInputFromSummary`) : nouveau paramètre
  `pettyCash` (défaut `{home:0, away:0}` pour rétro-compat) ; le débit
  trésorerie des coups de pouce devient `max(0, coût − pettyCash)`.
  `validateByCommissioner` charge les équipes et passe le petty cash.

## Forme de stockage des coups de pouce

`{ slug, name, cost, qty, starPlayerSlug? }`. `slug` identifie l'entrée
catalogue (ou `"star_player"`). `sumGold` (lecture `cost`/`qty`) reste
compatible ; le parseur web tolère l'absence de `slug` (anciennes
données → `"other"`).

## Météo dépendante

La table choisie pilote la liste des conditions (`results`). Changer de
table réinitialise la météo. La conséquence affichée = `description` du
résultat sélectionné. Valeurs héritées hors catalogue : ajoutées comme
option de repli pour rester affichables.
