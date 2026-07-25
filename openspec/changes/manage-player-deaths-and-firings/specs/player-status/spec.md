# Spec — Statut de présence d'un joueur (mort / licenciement)

## ADDED Requirements

### Requirement: Statut de présence tracé

Un `TeamPlayer` porte un statut de présence au roster actif :
`active` | `dead` | `fired`. Le joueur n'est JAMAIS supprimé de la base :
son historique de carrière et les événements de match qui le référencent
restent intacts.

Quand un statut inactif (`dead` ou `fired`) est posé, la **source** est
enregistrée : type de source (`match_sheet`, `online_match`,
`commissioner`, `admin`, `legacy`) et identifiant de l'entité source
(id du match, le cas échéant).

#### Scenario: Mort en match de ligue
- **GIVEN** un joueur actif d'une équipe engagée en ligue
- **WHEN** le commissaire valide une feuille de match qui le déclare mort
- **THEN** le joueur passe `status = "dead"` avec
  `statusSource = "match_sheet"` et `statusSourceId = <matchId>`
- **AND** un événement de statut `kind = "death"` non reverté est créé

#### Scenario: Licenciement de fin de match
- **GIVEN** un joueur actif figurant dans les licenciements de la feuille
- **WHEN** la feuille est validée
- **THEN** le joueur passe `status = "fired"` (`firedAt` posé) avec la
  même provenance, et quitte le roster actif (valeur d'équipe recalculée)

#### Scenario: Joueur déjà inactif
- **GIVEN** un joueur déjà mort
- **WHEN** une nouvelle application de statut le vise
- **THEN** l'application est ignorée (`already-inactive`) et aucun
  deuxième événement actif n'est créé

### Requirement: Reversion vérifiée

L'annulation d'un match DOIT rétablir les joueurs que ce match a tués ou
licenciés, et UNIQUEMENT ceux-là. La reversion vérifie que le statut
courant du joueur provient bien de la source annulée avant de le lever.

#### Scenario: Invalidation d'une feuille de match
- **GIVEN** un joueur mort et un joueur licencié par la feuille du match M
- **WHEN** le commissaire invalide la feuille de M
- **THEN** les deux joueurs redeviennent `active`, leurs événements de
  statut sont marqués revertés, et la valeur d'équipe est recalculée

#### Scenario: Statut re-posé par une autre source
- **GIVEN** un joueur tué par le match M, puis dont la mort a été re-posée
  par une autre source après coup
- **WHEN** le match M est annulé
- **THEN** le joueur RESTE mort et la reversion est ignorée avec la raison
  `status-superseded`

#### Scenario: Double invalidation
- **GIVEN** un match déjà invalidé
- **WHEN** la reversion est rejouée
- **THEN** elle est ignorée (`no-status-to-revert`) sans effet de bord

#### Scenario: Annulation d'un match en ligne
- **GIVEN** un match en ligne terminé ayant tué des joueurs
- **WHEN** un administrateur annule ou supprime ce match
- **THEN** les joueurs tués par ce match sont ressuscités

#### Scenario: Données antérieures au suivi de provenance
- **GIVEN** un joueur mort avant l'introduction du suivi de provenance
  (événement `legacy`)
- **WHEN** le match qui l'a tué est invalidé, le caller disposant de sa
  propre preuve (snapshot du match)
- **THEN** la reversion aboutit

### Requirement: Filtre unique du roster actif

Tout code qui liste les joueurs disponibles d'une équipe (composition,
inscription en coupe, progression, valeur d'équipe, statistiques du
roster courant) DOIT exclure à la fois les morts et les licenciés via le
filtre canonique partagé. Les usages qui doivent volontairement inclure
les joueurs inactifs (historique de carrière, palmarès) sont explicitement
déclarés.

#### Scenario: Licencié exclu de la progression
- **GIVEN** un joueur licencié à la fin d'un match
- **WHEN** la séquence post-match calcule les joueurs éligibles à un
  level-up
- **THEN** le licencié n'est pas proposé

#### Scenario: Mort exclu de l'inscription en coupe
- **GIVEN** un joueur mort
- **WHEN** son équipe s'inscrit à une coupe
- **THEN** il ne fait pas partie du roster inscrit
