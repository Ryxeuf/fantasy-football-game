# Classement de ligue : colonnes étendues et vue synthétique dépliable

## Why

Retour d'un coach (Ombrelame, 25/07/2026) sur le classement de saison :

- **L'ordre des colonnes ne suit pas la lecture d'un coach.** Le tableau
  ouvrait sur `MJ | V | N | D | TD+ | TD- | Diff TD | Sorties+ |
  Sorties-` et terminait par `Pts` — alors que le point d'entrée d'un
  classement, c'est le total de points, puis le bonus, puis le volume de
  matchs.
- **Il manque des colonnes que les coachs suivent réellement** : les
  points en retrait dus aux forfaits (`For`), les passes (`P`), les
  agressions (`Agr`), les sorties infligées par le public (`SP`) et les
  exclusions (`Exclu`). Le différentiel de sorties (`Diff Sor`) manquait
  aussi, alors que son pendant `Diff TD` existait.
- **Un tableau de 19 colonnes n'est pas lisible par défaut.** Le coach
  demande explicitement une version synthétique affichée d'office, et
  le détail complet accessible au dépliage.

Les données existent déjà : le journal `LeagueMatchEvent` (feuille de
match v2, Lot G) porte les kinds `pass_complete`, `aggression`,
`crowd_surge` et `expulsion`, et les forfaits sont matérialisés par le
`status` du `LeaguePairing`. Rien n'était remonté au classement.

## What Changes

- **Nouvelles colonnes** sur `StandingRow` : `casualtyDifference`,
  `forfeits`, `forfeitPoints`, `passes`, `aggressions`, `crowdSurges`,
  `expulsions`.
- **Agrégation sans migration** : nouveau service
  `league-standings-stats` — un `findMany` sur les pairings de la saison
  + un `groupBy` sur `LeagueMatchEvent` (pas de N+1, pas de compteur
  matérialisé supplémentaire sur `LeagueParticipant`, donc pas de
  backfill). Une correction ex-post du commissaire sur la feuille de
  match se reflète immédiatement dans le classement.
- **Ordre des colonnes** conforme à la demande :
  `Pts | Bo | MJ | For | TD+ | TD- | Diff TD | Sor+ | Sor- | Diff Sor |
  P | Agr | SP | Exclu | V | N | D`.
- **Vue synthétique par défaut** (`Pts` → `Diff Sor`), dépliable via un
  bouton `Voir le détail` / `Masquer le détail` qui révèle
  `P | Agr | SP | Exclu | V | N | D` (+ `ELO` en dernier lorsqu'il est
  classant).
- **Colonne `Bo` toujours visible** (elle était masquée quand aucune
  équipe n'avait de bonus) : elle fait partie de la vue synthétique
  demandée.

## Impact

- Specs : `league-standings` (nouvelle capability).
- Code : `apps/server/src/services/league-standings-stats.ts` (nouveau),
  `apps/server/src/services/league.ts`,
  `apps/web/app/leagues/[id]/SeasonStandings.tsx`,
  `apps/web/app/leagues/[id]/types.ts`, locales `fr.json` / `en.json`.
- **Aucune migration Prisma.** Aucun changement de contrat cassant :
  tous les nouveaux champs API sont optionnels et l'UI les traite comme
  `0` s'ils sont absents.
