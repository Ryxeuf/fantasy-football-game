# Poules et play-offs de coupe

## Why

Le change `cups-managed-like-leagues` a mis la coupe au niveau de la ligue
sur la feuille de match, l'appariement et le classement. Il a laissé de côté
les deux pièces les plus STRUCTURANTES de la parité, listées dans
[`openspec-suites.md`](../../../docs/roadmap/backlog/openspec-suites.md) :

1. **Une coupe ne sait pas répartir ses inscrits.** La ligue a `LeaguePool`,
   son panneau de composition, son classement par poule et son calendrier
   groupé. Une coupe à 24 équipes n'avait qu'un seul classement et une seule
   ronde suisse : le format « phase de poules » — celui de la plupart des
   tournois réels — n'était pas exprimable.
2. **Une coupe n'a pas de bracket administrable.** La ligue a `startPlayoffs`,
   les seeds éditables, la publication différée. La coupe n'avait que
   `CupBracketView`, une lecture chronologique des matchs déjà joués : rien
   ne CRÉE de rencontre d'élimination directe, donc une coupe ne pouvait pas
   se terminer par une finale.

Ces deux manques se tiennent : le seeding d'un bracket se lit dans les quotas
de qualification des poules. Les livrer séparément aurait imposé de réécrire
le seeding.

## What Changes

Le principe est le même que pour la feuille de match : **une coupe est une
ligue moins ses effets**, donc on partage le code et on nomme la différence,
plutôt que d'écrire un second exemplaire.

- **Poules.** `CupPool` (nom, ordre, couleur, quota de qualifiés) +
  `CupParticipant.poolId`. Composition réservée au commissaire et FIGÉE dès
  la première ronde — réaffecter après coup réécrirait un classement déjà
  joué. Le QUOTA, lui, reste modifiable : il ne sert qu'au seeding, encore à
  venir.
- **Appariement par groupe.** Les rondes restent COMMUNES (un `roundNumber`
  unique par coupe), l'appariement se fait poule par poule. Conséquence
  assumée : une ronde peut compter PLUSIEURS exempts (un par groupe impair),
  d'où `CupRoundPlan.byes` en liste.
- **Classement par poule.** `groupCupStandingsByPool` (pur) PROJETTE le
  classement général — il ne le retrie pas : deux tris séparés auraient fini
  par diverger le jour où l'un oublierait un critère de départage.
- **Play-offs.** `CupRound.kind = "playoff"` + `bracketSlot`, une ronde par
  slot, une rencontre par ronde — exactement la convention de la ligue. Le
  MOTEUR de bracket est extrait de `league-playoffs` vers `bracket-seeding`
  et partagé : croisement des têtes, carte d'avancement, sélection depuis les
  quotas de poule. Il ne connaît que des identifiants opaques, on lui passe
  des `teamId` là où la ligue passe des `participantId`.
- **Création paresseuse.** `startCupPlayoffs` ne crée que le premier tour.
  Les tours suivants naissent à la clôture de leur tour amont, avec un
  placeholder (`home === away`) tant que le second qualifié manque : la FK
  exige un vrai `teamId`, c'est l'égalité qui encode « à déterminer ».
- **Publication explicite.** `Cup.playoffsPublished`, booléen à TROIS états
  (`null` = coupe antérieure à la colonne, donc visible). Le gating porte sur
  les DEUX lectures — le bracket et les rondes `kind=playoff` du calendrier.

## Impact

- Schéma : `CupPool`, `CupParticipant.poolId`, `CupRound.kind` /
  `bracketSlot`, `Cup.playoffSize` / `playoffsPublished`. Toutes nullables ou
  à défaut : `prisma/migrations/` est gitignoré (prod = `db push`), aucun
  backfill n'est possible.
- Serveur : `services/cup-pool`, `services/cup-playoffs`,
  `services/bracket-seeding` (extrait), `routes/cup-pools`,
  `routes/cup-playoffs`.
- Web : `CupPoolsManagerPanel`, `CupPlayoffBracketView`, `playoff-bracket`
  (pur), classement par poule sur `cups/[id]`.
- `GET /cup/:id` gagne `participantId` / `poolId` par inscrit,
  `poolStandings`, `playoffSize`, `playoffsPublished`, et `kind` /
  `bracketSlot` par ronde. Ajouts uniquement : un client antérieur les ignore.
