# cup-match-sheet

## ADDED Requirements

### Requirement: La feuille est le seul chemin de saisie proposé

Une rencontre de coupe NE DOIT proposer aucune création de partie offline, ni
aucun lien vers l'écran d'une partie offline — ni sur la rencontre, ni sur un
tour de bracket, ni en pied de page de la coupe. La feuille de match est la
seule action de saisie offerte, et reste le chemin de relecture une fois le
résultat validé.

Le `LocalMatch` matérialisé par la validation reste la source du classement
dérivé : il est un support de résultat, jamais un écran de saisie proposé au
coach.

#### Scenario: Rencontre à jouer
- WHEN un coach impliqué consulte sa rencontre
- THEN seule la feuille de match DOIT lui être proposée

#### Scenario: Rencontre jouée
- WHEN une rencontre a été validée et matérialisée
- THEN aucun lien vers `/local-matches` NE DOIT être affiché

#### Scenario: Tour de bracket en attente
- WHEN un tour de play-off attend encore un qualifié
- THEN aucune feuille NE DOIT être proposée pour ce tour
