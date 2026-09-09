# skill-category-colors

## Purpose

Code couleur officiel des catégories de compétences Blood Bowl, servi par
une source unique à toutes les surfaces qui affichent une catégorie ou un
accès de poste, avec les contraintes de lisibilité que la palette impose.

## Requirements

### Requirement: Code couleur officiel des catégories de compétences

Toute surface affichant une catégorie de compétence DOIT utiliser le code
couleur officiel : Générale bleu, Agilité jaune, Force rouge, Mutation vert,
Passe blanc, Scélérate violet. Les six teintes DOIVENT être distinctes.
Une seule source (`lib/skill-category-colors`) DOIT les servir, indexée par
catégorie ET par code d'accès de poste (`G/A/S/F/P/M/K`, `F` étant l'alias
français de la Force), pour que la lettre d'un poste et le badge d'une
compétence ne puissent pas diverger.

Les catégories hors code couleur (Traits, Règles de Star Player, catégorie
inconnue) DOIVENT retomber sur un gris neutre.

#### Scenario: Lettres d'accès d'un poste
- WHEN un poste déclare un accès primaire `G,A,S`
- THEN chaque lettre DOIT porter la teinte de SA catégorie
- AND le rôle (primaire / secondaire) DOIT se lire à la bordure, pas à la
  couleur

### Requirement: Lisibilité du blanc et du jaune

La palette nomme des teintes, pas des couleurs de texte. Deux d'entre elles
DOIVENT recevoir un traitement explicite :

- la **Passe** étant blanche, son badge DOIT porter une bordure grise
  franche et un texte anthracite — sans quoi il disparaît sur les cartes
  blanches du site ;
- l'**Agilité** étant jaune, elle NE DOIT JAMAIS porter de texte blanc.

Toute variante douce DOIT porter un texte foncé, toute variante pleine un
texte blanc OU très foncé.

#### Scenario: Chip de catégorie sélectionnée
- WHEN une chip de catégorie est active
- THEN elle DOIT prendre la variante pleine de SA teinte, pas un bleu unique
