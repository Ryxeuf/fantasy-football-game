# site-search (delta)

Capability : recherche plein-texte transversale du contenu public du site
(compendium, compétences, positions, équipes, star players), accessible
sur une page dédiée et depuis les points d'entrée de navigation.

## ADDED Requirements

### Requirement: Recherche transversale du contenu public
Le site DOIT fournir une page de recherche unique interrogeant l'ensemble
du contenu public : règles (compendium), compétences, positions, équipes
et star players. Chaque résultat DOIT renvoyer vers la page publique
correspondante (lien profond).

#### Scenario: Résultats multi-corpus
- WHEN un visiteur saisit un terme présent dans plusieurs corpus
- THEN les résultats DOIVENT inclure les correspondances de chaque corpus, chacune liée à sa page

#### Scenario: Lien profond vers une section de règle
- WHEN un résultat correspond à une section de chapitre du compendium
- THEN son lien DOIT pointer vers le chapitre ET l'ancre de la section (`/compendium/<slug>#<ancre>`)

#### Scenario: Tolérance aux corpus indisponibles
- WHEN une source de données publique est momentanément indisponible
- THEN la recherche DOIT continuer à fonctionner sur les autres corpus

### Requirement: Recherche insensible à la casse et aux accents
La correspondance DOIT être insensible à la casse et aux accents, et
n'inclure un résultat que si TOUS les termes de la requête y figurent.

#### Scenario: Insensibilité aux accents
- WHEN la requête est « blessure » et le contenu contient « Blessûre »
- THEN le contenu DOIT correspondre

#### Scenario: Tous les termes requis
- WHEN la requête contient plusieurs termes
- THEN seuls les enregistrements contenant TOUS les termes DOIVENT être retournés

### Requirement: Classement et extrait
Les résultats DOIVENT être classés par pertinence (correspondance de titre
prioritaire sur le corps) et présenter un extrait du contenu autour de la
première correspondance, avec mise en évidence des termes.

#### Scenario: Titre prioritaire
- WHEN un terme correspond au titre d'un résultat et au corps d'un autre
- THEN le résultat dont le titre correspond DOIT être classé avant

#### Scenario: Extrait et surlignage
- WHEN un résultat est affiché
- THEN un extrait autour de la correspondance DOIT être montré et les termes recherchés DOIVENT être surlignés

### Requirement: Filtrage par type et requête partageable
La page DOIT permettre de filtrer les résultats par type de contenu (avec
le nombre de résultats par type) et refléter la requête dans l'URL pour
qu'elle soit partageable.

#### Scenario: Filtre par type
- WHEN l'utilisateur sélectionne un type
- THEN seuls les résultats de ce type DOIVENT être affichés, sans relancer la recherche

#### Scenario: URL partageable
- WHEN une requête est saisie
- THEN l'URL DOIT refléter la requête (`?q=`) afin d'être partageable et rechargeable

### Requirement: Points d'entrée de recherche
La recherche DOIT être atteignable depuis la navigation : une entrée dédiée
dans le menu (desktop et mobile) et un champ de recherche sur la page
compendium. Le champ du compendium DOIT fonctionner sans JavaScript
(soumission GET vers la page de recherche).

#### Scenario: Accès depuis le menu
- WHEN l'utilisateur ouvre le menu de navigation
- THEN une entrée « Rechercher » DOIT mener à la page de recherche

#### Scenario: Champ compendium sans JS
- WHEN l'utilisateur soumet le champ de recherche du compendium sans JavaScript
- THEN il DOIT arriver sur la page de recherche avec sa requête appliquée
