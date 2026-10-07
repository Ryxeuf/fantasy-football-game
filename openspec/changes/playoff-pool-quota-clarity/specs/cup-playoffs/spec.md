# cup-playoffs

## ADDED Requirements

### Requirement: Restitution détaillée des quotas de poule

Le bracket d'une coupe DOIT servir, en plus du total des qualifiés et de sa
cohérence avec la taille du bracket, le quota de chaque poule (nom et nombre
de qualifiés, dans l'ordre des poules). Le panneau de lancement DOIT présenter
le total comme un TOTAL, détaillé par poule, et le menu de taille DOIT
annoncer le nombre d'équipes engagées.

#### Scenario: Deux poules à 4 pour un bracket de 8
- WHEN une coupe a 2 poules qualifiant chacune 4 équipes et `playoffSize = 8`
- THEN `poolQualification` DOIT valoir 8 au total, cohérent
- AND DOIT lister les deux poules avec 4 qualifiés chacune
