# cup-calendar

## Purpose

Le calendrier d'une coupe pour ses coachs et son commissaire, comme celui
d'une ligue : « Mes prochains matchs », relance des coachs d'une ronde en
retard, et notification de la date convenue d'une rencontre.

Change d'origine : `cup-league-parity` (#1077, archivé le 2026-10-17).

## Requirements

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

Quand la date prévue d'une rencontre de coupe est posée ou retirée — par un
de ses coachs ou par le commissaire —, les coachs de la rencontre autres que
l'auteur DOIVENT être notifiés (notification interne menant à la coupe). Un
exempt ne notifie personne.

#### Scenario: Date posée
- WHEN le coach domicile fixe la date de sa rencontre
- THEN le coach extérieur DOIT recevoir une notification

#### Scenario: Date posée par le commissaire
- WHEN le commissaire, qui ne joue pas la rencontre, en fixe la date
- THEN les deux coachs DOIVENT être notifiés
