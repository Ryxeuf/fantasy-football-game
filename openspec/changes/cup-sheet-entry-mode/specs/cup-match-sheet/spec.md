# cup-match-sheet

## ADDED Requirements

### Requirement: Mode de saisie de la feuille choisi par la coupe

Chaque coupe DOIT porter un mode de saisie de la feuille de match :
`complète` ou `simplifiée`. Une coupe créée avant ce réglage DOIT se lire en
saisie complète, sans reprise de données. Une coupe créée sans choix
explicite DOIT être enregistrée en saisie simplifiée. La lecture d'une
feuille de coupe DOIT servir le mode de sa coupe avec le jeu de règles ; une
feuille de ligue DOIT toujours être servie en saisie complète.

#### Scenario: Coupe antérieure au réglage
- WHEN une coupe existait avant l'introduction du mode de saisie
- THEN ses feuilles DOIVENT être servies en saisie complète

#### Scenario: Nouvelle coupe sans choix
- WHEN un commissaire crée une coupe sans préciser le mode de saisie
- THEN la coupe DOIT être enregistrée en saisie simplifiée

#### Scenario: Nouvelle coupe en saisie complète
- WHEN un commissaire crée une coupe en choisissant la saisie complète
- THEN ses feuilles DOIVENT être servies en saisie complète

#### Scenario: Feuille de ligue
- WHEN une feuille de ligue est lue
- THEN elle DOIT être servie en saisie complète

### Requirement: La saisie simplifiée ne demande que ce que la coupe compte

En saisie simplifiée, la feuille DOIT ne proposer à la saisie que le forfait
et cinq types d'évènements : touchdown, sortie sur blocage, sortie sur
agression, passe réussie et interception, chacun avec son joueur acteur, et
la victime pour les deux sorties. Elle NE DOIT demander ni mi-temps, ni tour,
ni gravité, ni réceptionneur, ni météo, pile ou face, popularité, coups de
pouce, prières, poste des journaliers ou joueur relevé.

#### Scenario: Types proposés
- WHEN un coach ajoute un évènement sur une feuille de coupe en saisie simplifiée
- THEN seuls touchdown, sortie sur blocage, sortie sur agression, passe réussie et interception DOIVENT lui être proposés

#### Scenario: Avant-match réduit
- WHEN un coach ouvre l'avant-match d'une feuille de coupe en saisie simplifiée
- THEN seul le forfait DOIT être saisissable

#### Scenario: Journaliers sans choix de poste
- WHEN une équipe joue avec des journaliers sur une feuille en saisie simplifiée
- THEN ils DOIVENT rester proposés comme acteurs et victimes, à leur poste par défaut

#### Scenario: Saisie complète inchangée
- WHEN la coupe est en saisie complète
- THEN la feuille DOIT proposer exactement la saisie d'avant ce réglage

### Requirement: Le mode de saisie ne change ni la validation ni la lecture

Le mode de saisie DOIT ne gouverner que le formulaire. Le serveur DOIT
accepter tout évènement valide quel que soit le mode, la timeline DOIT
afficher tous les évènements déjà saisis, et soumissions, validation,
invalidation, classement et tops DOIVENT être identiques dans les deux modes
pour un même journal.

#### Scenario: Changement de mode en cours de coupe
- WHEN le commissaire passe une coupe de la saisie complète à la saisie simplifiée alors que des feuilles portent des coups d'envoi et des blessures
- THEN ces évènements DOIVENT rester affichés dans la timeline
- AND le classement et les tops de la coupe NE DOIVENT PAS changer

#### Scenario: Même journal, deux modes
- WHEN un même journal (touchdowns, sorties sur blocage, passes) est validé dans une coupe en saisie complète puis dans une coupe en saisie simplifiée
- THEN le classement, les podiums par action et les classements individuels DOIVENT être identiques

### Requirement: Une sortie sur agression se saisit sans gravité

En saisie simplifiée, une sortie sur agression DOIT être enregistrée comme
une agression marquée « cible sortie », sans gravité de blessure. La
validation d'une feuille de coupe DOIT compter une agression comme sortie dès
qu'elle porte une gravité OU cette marque : points de sortie sur agression,
top des agresseurs et top des victimes. Aucune gravité NE DOIT être inventée.

#### Scenario: Sortie sur agression validée
- WHEN une feuille de coupe en saisie simplifiée porte une sortie sur agression de l'équipe à domicile, avec sa victime, et est validée
- THEN l'équipe à domicile DOIT recevoir les points d'une sortie sur agression
- AND l'agresseur DOIT figurer au top des agresseurs, la victime au top des victimes

#### Scenario: Aucune gravité inventée
- WHEN une sortie sur agression saisie en mode simplifié est relue en saisie complète
- THEN elle DOIT être affichée comme une sortie sans gravité précisée, jamais avec une gravité qui n'a pas été saisie

#### Scenario: Agression sans sortie
- WHEN une agression ne porte ni gravité ni marque de sortie
- THEN elle NE DOIT rapporter aucun point de sortie
