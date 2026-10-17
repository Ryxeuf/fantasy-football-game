# cup-calendar

## ADDED Requirements

### Requirement: Mes prochains matchs de coupe

La page d'une coupe DOIT présenter au coach connecté ses rencontres encore à
jouer (hors exempts), comme la page d'une ligue.

#### Scenario: Coach inscrit
- WHEN un coach inscrit ouvre la coupe alors que sa rencontre de la ronde courante n'est pas jouée
- THEN la rencontre DOIT figurer dans « Mes prochains matchs »

### Requirement: Relance d'une ronde de coupe

Le commissaire (ou un admin) DOIT pouvoir relancer les coachs des
rencontres non jouées d'une ronde ; chaque coach concerné DOIT recevoir une
notification interne.

#### Scenario: Ronde en retard
- WHEN le commissaire relance une ronde dont une rencontre n'a pas de feuille
- THEN les deux coachs de cette rencontre DOIVENT être notifiés

### Requirement: Date convenue notifiée

Quand un coach pose la date prévue d'une rencontre de coupe, l'autre coach
DOIT être notifié.

#### Scenario: Date posée
- WHEN le coach domicile fixe la date de sa rencontre
- THEN le coach extérieur DOIT recevoir une notification
