# pro-league-coach-evolution

## Purpose

Le coach d'une équipe Pro League est une PERSONA persistée (`ProCoach` :
nom, philosophie, profil tactique VIVANT, ANCRE, mémoire, expérience) qui
évolue entre deux matchs de façon bornée et expliquée, sans self-play. La
forme des joueurs (`ProTeamRoster.form`) est écrite après chaque match et
relue par le coach, et les profils joués sont figés dans le journal de chaque
replay. Un réglage admin pose l'ancre ; l'évolution se joue après le commit
du match, jamais pour un match de test.

Change d'origine : `pro-league-coach-evolution` (lot 4, #1057, archivé le
2026-10-06). Récit :
`docs/roadmap/sessions/2026-10-05-pro-league-lot4-evolution-persistee.md`.

## Requirements

### Requirement: Un rapport de drives par match

Le full driver DOIT rendre, avec le résultat d'un match, un rapport des
drives de chaque équipe : stratégie dominante, possession, issue
(`td` / `conceded` / `half-end`), turnovers et tours joués. Un touchdown
DOIT clore le drive des deux équipes (le marqueur en `td`, l'autre en
`conceded`) ; la mi-temps et la fin du match DOIVENT clore les drives
ouverts en `half-end`.

#### Scenario: Autant de drives marqués que de touchdowns
- WHEN un match se termine sur un score de 2 à 1
- THEN le rapport DOIT contenir trois drives `td` et trois drives `conceded`

### Requirement: Une adaptation bornée, expliquée, sans self-play

Entre deux matchs, le profil d'un coach DOIT évoluer d'au plus `learningRate`
points par paramètre, dans `ancre ± band`, vers ce que les stratégies
observées au moins `minSamples` fois tirent sur leurs paramètres
d'influence, et revenir vers l'ancre sans signal. Chaque changement DOIT
porter une raison lisible en français. Le système NE DOIT PAS rejouer de
match pour apprendre.

#### Scenario: Borne tenue sur trois saisons
- WHEN cinquante et un matchs aux issues aléatoires sont intégrés d'affilée
- THEN chaque paramètre DOIT rester dans `ancre ± 15`, entier, entre 0 et 100

#### Scenario: Stratégie qui rapporte
- WHEN la stratégie `stall` a une moyenne mobile positive sur cinq drives
- THEN `stallTendency` et `patience` DOIVENT monter, avec une raison citant
  « stall », le nombre de drives et la moyenne

### Requirement: Un coach persisté par équipe, créé à la demande

Chaque ProTeam DOIT avoir au plus un `ProCoach` (nom, philosophie, profil
vivant, ancre, mémoire, expérience), créé depuis le profil de race au
premier besoin. Le simulateur DOIT recevoir le profil VIVANT. Chaque match
intégré DOIT écrire une ligne append-only `ProCoachMemory` (drives,
changements, profil avant/après, résumé).

#### Scenario: Première simulation d'une équipe
- WHEN une équipe sans coach est simulée
- THEN un coach DOIT être créé avec profil = ancre = profil de race, et le
  match DOIT être joué avec ce profil

#### Scenario: Match de test
- WHEN un match `isTest` est simulé
- THEN aucun coach ne DOIT évoluer et aucune forme ne DOIT changer

#### Scenario: Évolution qui échoue
- WHEN l'écriture de l'évolution d'un côté échoue après le commit du match
- THEN le match DOIT rester persisté, l'erreur journalisée, et l'autre côté
  DOIT évoluer

### Requirement: La forme des joueurs est écrite et relue

Après un match, la forme (`ProTeamRoster.form`, 0-100) DOIT monter de 15
pour un momentum `hot`, baisser de 15 pour `cold`, et revenir vers 50 de 5
points sinon. Le coach DOIT la relire : un joueur en méforme voit ses
actions à dés reculer dans l'ordre du tour, un joueur en forme les voit
avancer. Sans forme fournie, un match NE DOIT PAS changer à graine
constante.

#### Scenario: Forme fournie
- WHEN le même match est simulé avec et sans forme à 5 pour tout le roster
- THEN les deux journaux DOIVENT différer, et deux simulations avec la même
  forme DOIVENT être identiques

### Requirement: Le réglage admin pose l'ancre

`PATCH /admin/pro-league/teams/:id/coach` DOIT accepter un profil PARTIEL
validé (entiers 0-100, clés connues, corps non vide), redéfinir l'ancre
avec ces paramètres et y ramener le profil vivant. Le reset DOIT revenir
au profil de race (profil et ancre), vider la mémoire et journaliser une
ligne sans match. Les deux DOIVENT tracer un audit admin.

#### Scenario: Paramètre hors bornes
- WHEN le corps contient `{ profile: { bashIndex: 101 } }`
- THEN la route DOIT répondre 400 sans écrire

### Requirement: Les profils sont figés dans le journal du replay

Le journal d'un match DOIT porter les profils des deux coachs au moment du
match, pour qu'un replay reste lisible après l'évolution du profil vivant.

#### Scenario: Replay après évolution
- WHEN le profil vivant a changé depuis le match
- THEN `journal.profiles` DOIT encore contenir le profil joué

### Requirement: La fiche publique montre le coach

`GET /pro-league/teams/:slug` DOIT exposer `coach` (nom, philosophie,
expérience, profil, trois dernières évolutions) ou `null` avant le premier
match ; une lecture du coach qui échoue NE DOIT PAS bloquer la fiche.

#### Scenario: Équipe sans coach
- WHEN l'équipe n'a jamais été simulée
- THEN la fiche DOIT répondre 200 avec `coach: null`
