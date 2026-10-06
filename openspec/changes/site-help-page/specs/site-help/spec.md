# site-help

## ADDED Requirements

### Requirement: Une page d'aide liste les fonctionnalités par catégorie
Le site DOIT fournir une page d'aide publique présentant ses fonctionnalités
regroupées par catégorie. Chaque fonctionnalité DOIT indiquer ce qu'elle
permet de faire, qui peut s'en servir et un lien vers la page concernée.

#### Scenario: Consultation de l'aide
- WHEN un visiteur ouvre la page d'aide
- THEN il DOIT voir les catégories, un sommaire qui y mène, et pour chaque
  fonctionnalité sa description et son lien

#### Scenario: Accès depuis la navigation
- WHEN un visiteur ouvre le menu Compendium (bureau ou mobile) ou le pied de page
- THEN un lien vers la page d'aide DOIT être proposé

### Requirement: Les fonctionnalités gatées suivent les flags activés pour tous
Une fonctionnalité derrière un ou plusieurs feature flags NE DOIT être listée
que si tous ces flags sont activés globalement. Un override individuel ou le
bypass administrateur NE DOIVENT PAS la faire apparaître.

#### Scenario: Flag ouvert à tous
- WHEN le flag d'une fonctionnalité est activé globalement
- THEN la fonctionnalité DOIT apparaître dans l'aide

#### Scenario: Flag fermé
- WHEN le flag d'une fonctionnalité n'est pas activé globalement
- THEN la fonctionnalité NE DOIT PAS apparaître, et une catégorie devenue vide NE DOIT PAS être affichée

#### Scenario: Flags indisponibles
- WHEN l'état des flags ne peut pas être lu
- THEN seules les fonctionnalités sans flag DOIVENT être listées

### Requirement: L'aide reste exhaustive
Toute page statique du site DOIT figurer dans l'aide ou dans une liste
d'exclusions motivées, et aucun lien de l'aide NE DOIT pointer vers une page
inexistante.

#### Scenario: Nouvelle page sans entrée d'aide
- WHEN une page statique est ajoutée sans entrée d'aide ni exclusion motivée
- THEN la suite de tests DOIT échouer en la nommant
