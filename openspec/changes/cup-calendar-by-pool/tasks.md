# Tasks — Calendrier de coupe groupé par poule

## 1. Moteur commun
- [x] 1.1 `lib/competition-pools` (pur) : `putPoolFirst` (déménagé) +
      `groupByPool` générique. Tests.
- [x] 1.2 `SeasonCalendar.groupPairingsByPool` délègue ; signature, champ
      `pairings` et six tests de non-régression inchangés.
- [x] 1.3 `leagues/[id]/pool-order` ré-exporte `putPoolFirst`.

## 2. Côté coupe
- [x] 2.1 `cups/[id]/round-pools` (pur) : `groupCupRoundByPool` (poule par
      l'équipe à domicile, jamais sur une ronde de bracket),
      `preferredPoolIdFor`, `poolIdByTeamId`, `poolNamesById`. Tests.
- [x] 2.2 `CupRoundsView` : props `poolNamesById` / `poolIdByTeamId` /
      `preferredPoolId`, rendu groupé avec badge « Ma poule ». Tests.
- [x] 2.3 `cups/[id]/page` alimente les trois depuis la coupe chargée.
- [x] 2.4 i18n `cups.myPoolBadge` (fr/en).

## 3. Serveur
- [x] 3.1 `GET /cup/:id` sert `pools` (champ additif).
- [x] 3.2 e2e-api : la lecture d'une coupe porte de quoi grouper une ronde.

## 4. Documentation
- [x] 4.1 `docs/cup-pools-and-playoffs.md` (section calendrier).
- [x] 4.2 Backlog des suites : entrée barrée.
