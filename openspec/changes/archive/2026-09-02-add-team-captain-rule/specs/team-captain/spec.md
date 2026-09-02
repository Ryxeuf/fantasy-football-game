# team-captain (delta)

Capability : la règle spéciale d'équipe « Capitaine » (BB Saison 3) —
désignation à la création de la liste, compétence Pro offerte sans hausse
de valeur, effets en match (relance gratuite sur 6, alignement
obligatoire), licenciement restreint, et succession en ligue quand le
capitaine est mort ou licencié.

## ADDED Requirements

### Requirement: Désignation du capitaine à la création
Quand le roster d'une équipe possède la règle spéciale `capitaine`, le
coach DOIT pouvoir désigner n'importe quel joueur actif de sa liste comme
capitaine, à l'exception d'un Gros Bras (joueur avec Solitaire). Le
capitaine DOIT gagner immédiatement la compétence Pro sans que la valeur
d'équipe n'augmente. Il DOIT y avoir au plus un capitaine par équipe.

#### Scenario: Désignation valide
- WHEN le coach désigne un joueur actif non-Gros-Bras d'une équipe au
  roster `capitaine`
- THEN le joueur DOIT porter le flag capitaine et la compétence `pro`
- AND la valeur d'équipe NE DOIT PAS augmenter

#### Scenario: Gros Bras refusé
- WHEN le coach tente de désigner un joueur ayant Solitaire (`loner-*`)
- THEN la désignation DOIT être refusée (`player_big_guy`, HTTP 400)

#### Scenario: Roster sans la règle
- WHEN le coach tente une désignation sur un roster sans `capitaine`
- THEN la désignation DOIT être refusée (`no_captain_rule`, HTTP 400)

### Requirement: Succession en ligue
Quand le capitaine d'une équipe engagée est mort ou licencié, le coach
DOIT pouvoir désigner un nouveau capitaine. Tant qu'un capitaine actif
existe, la re-désignation sur une équipe engagée DOIT être refusée. Une
équipe non engagée (brouillon) PEUT changer librement de capitaine ;
l'ancien capitaine perd alors Pro si elle lui venait de la désignation.

#### Scenario: Capitaine mort → successeur
- WHEN le capitaine est mort et le coach désigne un autre joueur actif
- THEN la désignation DOIT réussir même si l'équipe est engagée
- AND le flag du capitaine précédent DOIT être retiré

#### Scenario: Capitaine actif en ligue → refus
- WHEN un capitaine actif existe et l'équipe est engagée
- THEN toute nouvelle désignation DOIT être refusée
  (`captain_already_active`, HTTP 409)

### Requirement: Licenciement restreint du capitaine
Un capitaine NE DOIT être licenciable que s'il a subi une blessure ayant
réduit une de ses caractéristiques (MA/ST/AG/PA/AV). La saisie de feuille
de match ligue DOIT ignorer (et journaliser) tout licenciement de
capitaine non conforme.

#### Scenario: Capitaine indemne dans firedPlayerIds
- WHEN une feuille de match ligue liste un capitaine sans réduction de
  caractéristique dans les licenciements
- THEN ce licenciement DOIT être ignoré et journalisé
- AND les autres licenciements valides DOIVENT être appliqués

### Requirement: Relance d'équipe gratuite sur 6 naturel
En match, quand une équipe utilise une relance d'équipe alors que son
capitaine est sur le terrain (case valide, ni KO, ni blessé, ni expulsé),
le moteur DOIT jeter un D6 : sur un 6 naturel, la relance NE DOIT PAS être
décomptée. Sans capitaine dans l'état, AUCUN jet supplémentaire NE DOIT
être effectué (déterminisme des replays antérieurs préservé).

#### Scenario: 6 naturel
- WHEN une relance d'équipe est utilisée avec le capitaine sur le terrain
  et que le D6 donne 6
- THEN le compteur de relances NE DOIT PAS être décrémenté

#### Scenario: Capitaine en réserve
- WHEN une relance d'équipe est utilisée avec le capitaine hors terrain
- THEN aucun D6 capitaine NE DOIT être jeté et la relance DOIT être
  décomptée normalement

### Requirement: Alignement obligatoire au placement
Au placement d'un drive, si le capitaine est disponible (état actif), le
placement qui le laisse en réserve DOIT être refusé. L'IA de placement
DOIT aligner le capitaine en priorité.

#### Scenario: Capitaine disponible laissé en réserve
- WHEN un coach valide un placement de 11 joueurs sans son capitaine
  disponible
- THEN la validation DOIT être refusée et journalisée dans le gameLog

#### Scenario: Capitaine KO
- WHEN le capitaine est KO/blessé/expulsé
- THEN le placement DOIT être validable sans lui
