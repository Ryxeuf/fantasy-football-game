# cup-predictions

## ADDED Requirements

### Requirement: Une portée de pronostics par coupe

Une coupe DOIT porter une portée parmi `off`, `members` et `open`. Une coupe
créée sans préciser de portée DOIT avoir `members` ; une coupe antérieure
(portée absente) DOIT être traitée comme `off`, sans backfill. La portée DOIT
se choisir à la création et se modifier à tout moment par le commissaire ou
un administrateur (`PATCH /cup/:id/predictions-scope`).

#### Scenario: Coupe antérieure
- WHEN une coupe existait avant la fonctionnalité
- THEN ses pronostics DOIVENT être désactivés

### Requirement: Pronostiquer une rencontre de coupe

Les règles de la ligue s'appliquent à l'identique : choix domicile / nul /
extérieur, score optionnel cohérent, pas de pronostic sur sa propre
rencontre, réservé aux membres (commissaire, coachs inscrits) en `members`,
ouvert à tout compte en `open`. Une rencontre DOIT être fermée dès son
premier évènement, sa première soumission, son résultat, sa date prévue
passée ou une clôture manuelle (coach de la rencontre, commissaire). Un
exempt NE DOIT PAS être proposé ; un placeholder de bracket NE DOIT PAS être
pronosticable ; une ronde de play-off non publiée NE DOIT apparaître qu'au
commissaire.

#### Scenario: Sa propre rencontre
- WHEN un coach tente de pronostiquer la rencontre de son équipe
- THEN le serveur DOIT refuser (`own_match`)

#### Scenario: Rien avant la clôture
- WHEN un lecteur consulte une rencontre ouverte
- THEN la réponse NE DOIT contenir ni les pronostics des autres, ni leur nombre, ni leur répartition

### Requirement: Règlement et classement

La validation d'une feuille de coupe DOIT copier l'issue et le score réel
sur chaque pronostic de la rencontre (forfait ⇒ `void`) ; son invalidation
DOIT les remettre en attente sans rouvrir la rencontre. Le classement DOIT
être dérivé à la lecture, en deux groupes (Coachs, Tribunes), avec le barème
de la ligue. Quand une ronde se complète, chaque pronostiqueur DOIT recevoir
UNE notification de bilan.

#### Scenario: Validation puis invalidation
- WHEN une feuille réglée est invalidée
- THEN ses pronostics DOIVENT redevenir en attente et le classement les ignorer
