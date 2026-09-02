# game-help

## Purpose

Aide de jeu publique — le déroulé chronologique d'une partie
de Blood Bowl, consultable sur mobile pendant la partie, avec les tables
de résolution accessibles en panneau sans quitter la page.

## Requirements

### Requirement: Déroulé chronologique d'une partie
Le site DOIT fournir une page d'aide de jeu présentant le déroulé d'une
partie en trois phases ordonnées — avant le match, pendant le match,
après le match — chaque étape étant résumée de façon succincte.

#### Scenario: Les trois phases sont présentes
- WHEN un visiteur ouvre la page d'aide de jeu
- THEN les phases « avant le match », « pendant le match » et « après le match » DOIVENT être présentes et navigables

#### Scenario: Navigation entre phases
- WHEN un visiteur choisit une phase dans la navigation
- THEN la page DOIT afficher les étapes de cette phase sans rechargement

### Requirement: Tables consultables en panneau
Les tables de résolution NE DOIVENT PAS être déroulées dans le flux de la
page. Chaque étape qui en dépend DOIT proposer un déclencheur ouvrant la
table dans un panneau superposé, la page conservant sa position de
lecture.

#### Scenario: Ouverture d'une fiche
- WHEN un visiteur active le déclencheur d'une table depuis une étape
- THEN le panneau DOIT s'ouvrir avec le contenu complet de cette table

#### Scenario: Fermeture rend le contexte
- WHEN le visiteur ferme le panneau
- THEN la page DOIT être affichée à la position de lecture précédente

#### Scenario: Renvoi vers la règle complète
- WHEN une fiche provient d'un chapitre du compendium
- THEN elle DOIT proposer un lien vers ce chapitre

### Requirement: Fiche partageable par URL
Une fiche ouverte DOIT être adressable par URL, afin qu'un lien partagé
ouvre directement la bonne table.

#### Scenario: Ouverture directe par URL
- WHEN la page est ouverte avec le paramètre de fiche d'une table connue
- THEN le panneau de cette table DOIT être ouvert au chargement

#### Scenario: Paramètre inconnu
- WHEN le paramètre désigne une fiche inexistante
- THEN la page DOIT s'afficher normalement, sans panneau ouvert

#### Scenario: Retour navigateur
- WHEN un panneau est ouvert et que le visiteur utilise le retour du navigateur
- THEN le panneau DOIT se fermer sans quitter la page

### Requirement: Contenu des fiches dérivé des sources existantes
Les tables affichées NE DOIVENT PAS être recopiées : elles DOIVENT être
dérivées du compendium publié et des tables du moteur de jeu. Une source
manquante ou renommée DOIT provoquer un échec de test plutôt qu'une fiche
vide.

#### Scenario: Table du compendium introuvable
- WHEN une fiche référence une table absente du compendium
- THEN la construction de cette fiche DOIT échouer explicitement

#### Scenario: Météo et prières
- WHEN un visiteur ouvre la fiche météo ou la fiche des prières à Nuffle
- THEN leur contenu DOIT provenir des tables du moteur de jeu

### Requirement: Checklist de partie persistante
La page DOIT permettre de cocher les étapes d'avant-match et les actions
limitées d'un tour, et conserver ces coches sur l'appareil entre deux
visites, avec une remise à zéro explicite.

#### Scenario: Persistance entre visites
- WHEN un visiteur coche une étape puis revient sur la page
- THEN cette étape DOIT être toujours cochée

#### Scenario: Remise à zéro
- WHEN le visiteur déclenche la remise à zéro d'une liste
- THEN toutes les coches de cette liste DOIVENT être retirées

#### Scenario: Stockage local indisponible
- WHEN le stockage local n'est pas accessible
- THEN la page DOIT rester utilisable, sans coche mémorisée

### Requirement: Utilisable sur mobile pendant la partie
La page DOIT être conçue pour un usage mobile : navigation atteignable au
pouce et cibles tactiles d'au moins 44 pixels sur les commandes
principales.

#### Scenario: Navigation atteignable
- WHEN la page est consultée sur un écran de téléphone
- THEN la navigation entre phases DOIT rester accessible sans remonter en haut de page

### Requirement: Découvrabilité de l'aide de jeu
L'aide de jeu DOIT être atteignable depuis la navigation du site et
référencée pour l'indexation.

#### Scenario: Entrée de navigation
- WHEN un visiteur ouvre le menu du site
- THEN une entrée DOIT mener à l'aide de jeu

#### Scenario: Présence au sitemap
- WHEN le sitemap est généré
- THEN il DOIT contenir l'URL de l'aide de jeu
