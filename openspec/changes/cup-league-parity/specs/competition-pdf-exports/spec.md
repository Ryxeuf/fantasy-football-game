# competition-pdf-exports

## ADDED Requirements

### Requirement: Coups de pouce sur la page de l'équipe

La page de chaque équipe de la feuille de rencontre imprimable DOIT porter
la liste de ses coups de pouce pour la rencontre — ceux de l'inscription
(coupe en `build`) puis ceux achetés en avant-match —, nom et quantité. Une
équipe sans coup de pouce NE DOIT PAS porter de ligne vide.

#### Scenario: Achats d'avant-match
- WHEN l'équipe extérieure a acheté un Pot-de-vin et une Prière à Nuffle
- THEN sa page DOIT porter « Coups de pouce : Pot-de-vin ×1 · Prière à Nuffle ×1 »

#### Scenario: Coupe en build
- WHEN une équipe est inscrite avec une Mascotte et deux Fûts
- THEN sa page DOIT porter « Coups de pouce : Mascotte d'Équipe ×1 · Fûts de Blitz Premium ×2 »
