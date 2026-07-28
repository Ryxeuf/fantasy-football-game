# Tasks — colonnes étendues du classement de ligue

## 1. Backend — agrégation des stats étendues
- [x] 1.1 Nouveau service `league-standings-stats.ts` : `SeasonExtraStats`, `EMPTY_EXTRA_STATS`, `TRACKED_EVENT_KINDS`.
- [x] 1.2 `foldSeasonExtraStats(pairings, eventCounts)` pur : attribution par côté, forfaits depuis `LeaguePairing.status`, kinds non suivis ignorés.
- [x] 1.3 `aggregateSeasonExtraStats(seasonId)` : `findMany` pairings + `groupBy` events (2 requêtes, pas de N+1) ; court-circuit si aucune feuille de match.

## 2. Backend — intégration au classement
- [x] 2.1 `StandingRow` étendu : `casualtyDifference`, `forfeits`, `forfeitPoints`, `passes`, `aggressions`, `crowdSurges`, `expulsions` (tous optionnels).
- [x] 2.2 `attachExtraStats(rows, stats, forfeitPointsBareme)` pur et immutable ; normalisation du `-0`.
- [x] 2.3 `computeSeasonStandings` sélectionne `League.forfeitPoints` et appelle `loadSeasonExtraStatsSafely` (try/catch → colonnes à zéro).
- [x] 2.4 `computeSeasonStandingsByPool` et `computeSeasonRecap` héritent des colonnes sans changement (ils délèguent à `computeSeasonStandings`).

## 3. Frontend — tableau
- [x] 3.1 `types.ts` : miroir des nouveaux champs optionnels.
- [x] 3.2 `SeasonStandings` piloté par un tableau de colonnes déclaratives ; ordre `Pts | Bo | MJ | For | TD+ | TD- | Diff TD | Sor+ | Sor- | Diff Sor | P | Agr | SP | Exclu | V | N | D` (+ ELO en dernier si classant).
- [x] 3.3 Vue synthétique par défaut + bouton `standings-toggle-details` (`aria-expanded`), prop `defaultExpanded`.
- [x] 3.4 Colonne `Bo` toujours visible ; `Diff Sor` recalculé si absent de l'API.
- [x] 3.5 `data-testid` de cellules renommés en `standings-cell-<pid>-<key>`.

## 4. i18n
- [x] 4.1 `fr.json` / `en.json` : `standingsCasDiff`, `standingsForfeit`, `standingsPasses`, `standingsAggressions`, `standingsCrowdSurges`, `standingsExpulsions`, `standingsShowDetails`, `standingsHideDetails` + `*Hint` associés.
- [x] 4.2 Libellés FR alignés sur la demande coach : `Sor+` / `Sor-` (au lieu de `Sorties+` / `Sorties-`), `Bo` (au lieu de `Bonus`).

## 5. Tests
- [x] 5.1 `league-standings-stats.test.ts` — 12 tests du pliage pur (attribution par kind/côté, forfaits, kinds ignorés, comptes invalides, entrées par défaut).
- [x] 5.2 `league-standings-extra.test.ts` — 7 tests : intégration `computeSeasonStandings`, barème de forfait, court-circuit sans feuille, dégradation sur erreur, `attachExtraStats` pur.
- [x] 5.3 `league-standings-bonus.test.ts` — mocks Prisma complétés (`leaguePairing.findMany`, `leagueMatchEvent.groupBy`).
- [x] 5.4 `SeasonStandings.test.tsx` — 15 tests : ordre exact des en-têtes (synthétique et déplié), bascule, ELO, valeurs étendues, rétro-compat, état vide.
- [x] 5.5 Suites complètes `@bb/server` + `@bb/web` vertes, `typecheck` vert.
