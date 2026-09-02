# regional-league-pages (delta)

Capability : pages publiques décrivant les Ligues régionales Blood Bowl et
listant les équipes éligibles (`/ligues`, `/ligues/[slug]`), plus l'index
inverse Ligue→rosters dont elles dépendent. Surface front (`apps/web`) +
helper pur game-engine. Réutilise `GET /api/rosters` ; aucun nouvel
endpoint ni migration.

## ADDED Requirements

### Requirement: Index inverse Ligue régionale → rosters
Le game-engine DOIT (MUST) exposer une fonction pure retournant, pour un slug de
Ligue régionale, l'ensemble des rosters qui s'y rattachent, dérivé de
`TEAM_REGIONAL_RULES`. Le résultat DOIT être déterministe (trié) et
cohérent avec la table source. Une fonction d'agrégat DOIT retourner les
Ligues accompagnées de leurs rosters, en excluant les Ligues sans aucun
roster.

#### Scenario: Rosters d'une Ligue
- WHEN on demande les rosters de `elven_kingdoms_league`
- THEN la fonction DOIT retourner exactement les rosters dont
  `TEAM_REGIONAL_RULES` contient `elven_kingdoms_league`, triés par slug

#### Scenario: Roster multi-Ligues
- WHEN un roster appartient à plusieurs Ligues
- THEN il DOIT apparaître dans la liste de chacune de ces Ligues

#### Scenario: Ligue sans roster exclue
- WHEN une Ligue régionale n'a aucun roster rattaché
- THEN l'agrégat des Ligues-avec-rosters NE DOIT PAS la contenir

### Requirement: Page index des Ligues
La page `/ligues` DOIT (MUST) lister les Ligues régionales (nom FR/EN,
description, nombre d'équipes, aperçu des équipes) sous forme de cartes
liées vers `/ligues/[slug]`. Elle DOIT être rendue côté serveur et cachée
(ISR), porter des métadonnées (titre, description, canonical) et un JSON-LD
`CollectionPage` + `ItemList` + `BreadcrumbList`.

#### Scenario: Liste des Ligues
- WHEN un visiteur ouvre `/ligues`
- THEN la page DOIT afficher une carte par Ligue régulière (≥1 équipe)
- AND chaque carte DOIT lier vers `/ligues/<slug>`

### Requirement: Page de détail d'une Ligue
La page `/ligues/[slug]` DOIT (MUST) afficher la description officielle de la
Ligue et la liste des équipes qui peuvent y participer, chaque équipe liée
vers sa fiche `/teams/[slug]`. Les noms d'équipes DOIVENT provenir de
`GET /api/rosters` (cohérence + localisation), avec un repli sur un nom
dérivé du slug si une équipe est absente de l'API.

#### Scenario: Ligue existante
- WHEN un visiteur ouvre `/ligues/<slug>` pour une Ligue connue
- THEN la page DOIT afficher sa description et la liste des équipes éligibles
- AND chaque équipe DOIT lier vers `/teams/<rosterSlug>`

#### Scenario: Ligue inexistante
- WHEN le slug ne correspond à aucune Ligue régionale
- THEN la page DOIT répondre `notFound()` (404)
- AND ses métadonnées DOIVENT porter `robots: { index: false }`

#### Scenario: Équipe absente de l'API
- WHEN un slug de roster de la Ligue n'est pas retourné par `GET /api/rosters`
- THEN la page DOIT afficher un nom dérivé du slug plutôt que d'échouer

### Requirement: Maillage retour & navigation
Les pastilles de Ligues régionales DOIVENT (MUST) être des liens vers
`/ligues/[slug]` depuis la fiche d'équipe `/teams/[slug]`. Le menu de
navigation (desktop et mobile) DOIT proposer une entrée vers `/ligues`.

#### Scenario: Lien depuis la fiche d'équipe
- WHEN un visiteur consulte la fiche d'une équipe rattachée à une Ligue
- THEN la pastille de Ligue DOIT être cliquable et mener à `/ligues/<slug>`
