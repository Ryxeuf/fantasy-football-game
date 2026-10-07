# Tasks — Une ligue privée est invisible

## 1. Sémantique et helper unique
- [x] 1.1 Commentaire Prisma sur `League.isPublic` (schéma racine + miroir
      SQLite) : `false` = privée, lisible par commissaire / admin / inscrit /
      invité, 404 pour les autres.
- [x] 1.2 `services/league-access.ts` : `isLeagueVisibleTo` (pur),
      `canViewLeagueRow`, `findVisibleLeague`, `findVisibleSeasonLeague`,
      `isLeaguePairingHiddenFrom`, `canViewLeague`. Tests unitaires.

## 2. Lectures par id
- [x] 2.1 `routes/league.ts` : gardes `ensureVisibleLeague` /
      `ensureVisibleSeason` / `ensureVisiblePairingLeague` ; détail, saison,
      classement, poules, classements individuels (×3), récap, bracket,
      feuille de match + `can-invalidate`, rosters en lecture seule, inscription
      à une saison.
- [x] 2.2 Poules, classements individuels et récap montés derrière
      `optionalAuthUser`.
- [x] 2.3 `listThemedSeasons` limité aux ligues publiques.
- [x] 2.4 Documents officiels : ligue privée → 404 pour un tiers, invités
      acceptés ; coupes inchangées. Doc `docs/competition-documents.md` et
      scénario du change `add-competition-official-documents` mis à jour.

## 3. Tests de route
- [x] 3.1 `routes/league-access.test.ts` (chaîne Express réelle, JWT réels) :
      ligue privée lue par un tiers → 404 identique à « inexistant », par un
      inscrit / invité / commissaire / admin → 200, ligue publique par un tiers
      → 200, sans compte → 200 (routes ouvertes) ou 401 ; rien n'est calculé
      pour un tiers ; rosters 404 / 403 ; inscription 404 / 201.
- [x] 3.2 Fixtures des tests existants (`league`, `league-playoff-routes`,
      `league-roster-view`, `league-leaderboards-by-team`,
      `league-team-leaderboards`, `competition-documents`) portent la
      visibilité ; cas « ligue privée » ajoutés à chacun.

## 4. Web et documentation
- [x] 4.1 `LeagueForm` : indice sous Publique / Privée (fr/en), test.
- [x] 4.2 `CLAUDE.md` : la règle « une ligue privée est invisible (404), pas
      interdite (403) » et ses pièges.
