# Neutralisation de l'ELO en ligue — 2026-06-01

## Pourquoi

L'ELO (`LeagueParticipant.seasonElo`) n'est pas pertinent pour une ligue
Blood Bowl classique :

- une ligue est un **système fermé** (calendrier fixe) : le classement qui fait
  foi = **points** (V/N/D) + départages sportifs (diff TD, diff CAS) ;
- l'ELO mesure un niveau relatif sur un **pool ouvert et continu** ; sur une
  saison de quelques matchs il ne converge pas ;
- pour de l'**offline saisi à la main** (système de confiance), alimenter un
  rating invite à la distorsion.

Décision : **neutraliser l'ELO par défaut**, réactivable par ligue.

## Changements

### 1. L'offline n'alimente plus l'ELO
`recordLeagueMatchResult` accepte `skipSeasonElo?: boolean`. Quand `true`, le
delta ELO est forcé à 0 (le `seasonElo` réécrit = valeur courante → no-op, le
snapshot retourne `delta 0`). `recordOfflineLeagueResult` passe `skipSeasonElo:
true`. Les matchs **joués en ligne** continuent de calculer l'ELO normalement.

### 2. L'ELO n'est plus un critère de classement par défaut
`DEFAULT_TIE_BREAK_RULES` : `season_elo` remplacé par `cas_diff` (départage
sportif). Une ligue peut le **réactiver** en mettant `season_elo` dans son
`League.tieBreakRules` (champ déjà éditable, JSON) — aucune migration.

### 3. L'ELO est masqué dans l'UI par défaut
Nouveau helper exporté `isSeasonEloRanked(tieBreakRules)` = `season_elo` présent
dans les règles effectives. `GET /leagues/seasons/:id/standings` renvoie
`showSeasonElo`. `SeasonStandings` (colonne) et `SeasonParticipants`
(indicateur) ne rendent l'ELO que si `showSeasonElo === true`. Réactivation =
ajouter `season_elo` aux tie-breaks de la ligue.

## Tests

- `league-match-result.test.ts` : +1 (skipSeasonElo → delta 0, points/td appliqués). 16/16.
- `league-offline-result.test.ts` : assertion de délégation maj (`skipSeasonElo: true`). 8/8.
- `league-tiebreak.test.ts` : défaut `cas_diff` (4 assertions) + `isSeasonEloRanked` (4 tests).
- `league.test.ts` (route) : mock `isSeasonEloRanked` + `leagueSeason.findUnique` + assertion `showSeasonElo: false`. 27/27.
- Web `app/leagues` 58/58. `tsc` server + web : clean.
