# pro-league-replay-journal

## ADDED Requirements

### Requirement: Un flux de dés par coup

Dans le full driver, chaque coup `n` DOIT consommer un flux de dés dérivé de
la graine du match et de l'index du coup, indépendant des tirages de l'IA et
des coups précédents. Une remise en jeu headless DOIT avoir son propre flux.

#### Scenario: Coup refusé puis remplacé
- WHEN le moteur refuse le coup proposé par l'IA au pas `n`
- THEN le coup de repli DOIT être appliqué avec un flux neuf de la même clé
- AND le rejeu du journal DOIT produire le même état

### Requirement: Journal rejouable

Un replay v2 DOIT contenir l'état initial sans journal de log, la liste
ordonnée des coups et les dés consommés par chacun. `replayJournal` DOIT
re-dériver tous les états bit à bit, journal de log compris. Un payload v1
DOIT rester décodable.

#### Scenario: Rejeu bit à bit
- WHEN un match est simulé puis son journal rejoué
- THEN chaque état rejoué DOIT être égal à l'état produit par le driver

#### Scenario: Taille
- WHEN un match de ~550 coups est compressé en v2
- THEN le payload DOIT peser moins de 20 Ko

### Requirement: Contrat de lecture conservé

`GET /pro-league/matches/:id/full-replay` DOIT continuer de servir
`{ initialState, moves, states }`, dérivés du journal quand le payload est v2,
et exposer le journal.

#### Scenario: Replay v1 archivé
- WHEN le payload stocké est un v1 à snapshots
- THEN la réponse DOIT être identique à avant ce change

### Requirement: Feuille de match papier

Une feuille de match texte DOIT être rendue à partir du journal : une ligne
par activation avec le joueur, le chemin case par case, l'action et les dés,
groupée par mi-temps, tour et équipe, avec touchdowns, turnovers et remises
en jeu, sur les coordonnées du plateau 26×15.

#### Scenario: Export admin
- WHEN un admin demande `?format=sheet` sur la narration d'un match au journal v2
- THEN la réponse DOIT être la feuille en texte brut

### Requirement: Un touchdown par poussée clôt le drive

Quand un joueur porteur est repoussé dans l'en-but adverse, le touchdown DOIT
être attribué et aucun choix de poussée ou de suivi NE DOIT rester en attente.

#### Scenario: Porteur repoussé dans l'en-but
- WHEN un blocage repousse le porteur dans l'en-but adverse avec un choix de suivi ouvert
- THEN l'état DOIT être `post-td` sans choix en attente

### Requirement: Navigation par activation dans le viewer

Le viewer terrain DOIT proposer un pas par activation (suite contiguë des
coups d'un joueur, choix compris) en plus du pas par coup.

#### Scenario: Activation suivante
- WHEN le spectateur est au milieu d'une activation et demande la suivante
- THEN le viewer DOIT se placer sur le premier coup de l'activation suivante
