# cup-match-sheet

## ADDED Requirements

### Requirement: Les Star Players du roster d'inscription jouent la rencontre

Les Star Players figés dans le roster d'inscription d'une équipe DOIVENT
figurer sur chaque feuille de la coupe comme joueurs de la rencontre :
proposés comme acteurs et cibles d'évènement, Joueur du Match possible,
listés sur la feuille imprimée. Ils DOIVENT l'être dans les deux modes de
saisie, et rester exclus de toute persistance d'après-match.

#### Scenario: Touchdown d'un Star Player du build
- **WHEN** une équipe inscrite avec Morg 'n' Thorg ouvre sa feuille de coupe
- **THEN** Morg 'n' Thorg DOIT être proposé comme acteur d'un touchdown

#### Scenario: Saisie simplifiée
- **WHEN** la coupe est en saisie simplifiée
- **THEN** les Star Players du roster d'inscription DOIVENT être proposés comme acteurs et victimes

#### Scenario: Pas de double engagement
- **WHEN** un Star Player du roster d'inscription est aussi sélectionné en coup de pouce d'avant-match
- **THEN** la sélection DOIT être refusée (400) : un Star Player ne joue qu'une fois par équipe

### Requirement: Budget de coups de pouce d'une coupe sans trésorerie

Le budget de coups de pouce d'avant-match d'une coupe (mode `match`) DOIT se
limiter à la petite monnaie : l'écart de VEA pour l'équipe la moins chère,
rien pour l'autre. La trésorerie, jamais débitée en coupe, NE DOIT entrer
ni dans le budget affiché ni dans le contrôle serveur.

#### Scenario: Favori avec trésorerie
- **WHEN** l'équipe à la VEA la plus haute dispose de 300 000 po de trésorerie figée
- **THEN** son budget de coups de pouce DOIT être 0 et toute sélection DOIT être refusée (`inducement_over_budget`)

#### Scenario: Outsider
- **WHEN** l'écart de VEA est de 80 000 po
- **THEN** le budget de l'outsider DOIT être 80 000 po, sans complément de trésorerie
