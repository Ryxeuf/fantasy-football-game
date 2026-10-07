# league-matchday-calendar

## ADDED Requirements

### Requirement: Carte de rencontre

Chaque rencontre d'une journée DOIT être présentée avec les deux équipes
(logo, nom, coach) autour d'un cartouche central portant le score une fois
validé (vainqueur mis en avant, perdant estompé) ou « VS » avant le match,
puis un badge de statut unique (validation en attente > date prévue >
résultat validé > statut) et les actions (feuille de match, planification).
La rencontre du coach connecté DOIT être signalée « Mon match ».

#### Scenario: Résultat validé
- WHEN la feuille d'une rencontre est validée 3 – 1
- THEN le cartouche DOIT afficher « 3 – 1 » et l'équipe à domicile DOIT être mise en avant

### Requirement: Journée lisible

Chaque journée DOIT afficher son numéro, son statut affiché (dérivé : une
journée entamée mais incomplète est « En cours »), ses dates, son
avancement `joués/total` et l'export ; le calendrier DOIT offrir un filtre
Toutes / À jouer / Jouées dès qu'il y a plus d'une journée, et la poule du
coach connecté DOIT apparaître en premier dans chaque journée et dans les
classements par poule.
