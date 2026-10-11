# competition-pdf-exports

## ADDED Requirements

### Requirement: Coups de pouce d'inscription sur la feuille imprimée

La feuille de rencontre PDF d'une coupe en `build` DOIT imprimer, pour
chaque équipe, les coups de pouce figés à l'inscription (nom et quantité),
dans les deux modes de saisie, et NE DOIT proposer aucune case d'achat de
coup de pouce. Les Star Players du roster d'inscription DOIVENT figurer
dans la page de l'équipe.

#### Scenario: Coupe en build
- **WHEN** une équipe inscrite avec une Mascotte et deux Fûts imprime sa feuille de coupe
- **THEN** la feuille DOIT porter « Mascotte d'Équipe ×1 » et « Fûts de Blitz Premium ×2 » pour cette équipe

#### Scenario: Saisie simplifiée
- **WHEN** la coupe est en saisie simplifiée et en `build`
- **THEN** le rappel des coups de pouce DOIT figurer, sans aucune autre rubrique d'avant-match

#### Scenario: Star Players du roster d'inscription
- **WHEN** une équipe est inscrite avec un Star Player
- **THEN** il DOIT être listé dans la page de l'équipe avec ses cases d'actions
