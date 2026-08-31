# roster-share-preview (delta)

Capability : quand un coach partage le lien d'une de ses équipes, l'aperçu
généré par les réseaux (Discord, Slack, X…) identifie l'équipe — logo non
déformé, titre portant le nom de l'équipe ET celui du site, texte
personnalisable par le coach.

## ADDED Requirements

### Requirement: Description d'équipe éditable
Le coach propriétaire d'une équipe DOIT pouvoir saisir une description
libre (fluff) via `PATCH /team/:id/description` `{ description }`. La
description DOIT être trimée, limitée à 1000 caractères, et une chaîne
vide (ou blanche) DOIT être stockée comme `null` — « pas de description »
et « description vide » ne sont pas deux états distincts.

#### Scenario: Saisie d'une description
- WHEN le propriétaire envoie `{ description: "  Bande de rats  " }`
- THEN `Team.description` DOIT valoir `"Bande de rats"` (trimé)
- AND la réponse DOIT rendre l'équipe avec sa description (HTTP 200)

#### Scenario: Effacement
- WHEN le propriétaire envoie `{ description: "   " }` ou `{ description: null }`
- THEN `Team.description` DOIT valoir `null`

#### Scenario: Description trop longue
- WHEN la description dépasse 1000 caractères après trim
- THEN la requête DOIT être refusée (HTTP 400) et la description NE DOIT
  PAS changer

#### Scenario: Équipe engagée
- WHEN le propriétaire décrit une équipe engagée dans un match, une ligue
  ou une coupe
- THEN la requête DOIT réussir : la description est cosmétique et NE DOIT
  PAS passer par le verrou anti-triche du roster

#### Scenario: Équipe d'un autre coach
- WHEN un utilisateur décrit une équipe qu'il ne possède pas, ou déjà
  soft-deletée
- THEN la requête DOIT être refusée (HTTP 404), sans distinguer les cas

#### Scenario: Journalisation
- WHEN une description est effectivement modifiée
- THEN une étape `team.description.update` DOIT être écrite au journal
  d'équipe avec l'ancienne et la nouvelle valeur
- AND une écriture à valeur identique NE DOIT écrire aucune étape

### Requirement: Aperçu public d'une équipe partagée
`GET /api/public/teams/by-id/:id` DOIT rendre un aperçu minimal d'une
équipe — nom, race, règles, valeur d'équipe, effectif, logo, description,
token de partage — et UNIQUEMENT si l'équipe est publique.

#### Scenario: Équipe publique
- WHEN l'équipe `:id` a `isPublic = true`
- THEN la réponse DOIT contenir l'aperçu (HTTP 200)
- AND elle NE DOIT PAS contenir la trésorerie ni le détail des joueurs

#### Scenario: Équipe privée ou inexistante
- WHEN l'équipe n'existe pas, ou n'a pas activé le partage
- THEN la réponse DOIT être un 404, indiscernable entre les deux cas

### Requirement: Image de partage sans déformation
Toute image Open Graph du site DOIT être générée aux dimensions qu'elle
déclare (1200 × 630). Un logo intégré à une image OG DOIT être rendu dans
une boîte carrée fixe en `objectFit: contain` : ses proportions d'origine
DOIVENT être préservées quelles qu'elles soient.

#### Scenario: Logo carré
- WHEN le logo source est carré (ex. `logo.png`, 1024 × 1024)
- THEN il DOIT apparaître carré dans la carte 1200 × 630, sans étirement

#### Scenario: Logo non carré
- WHEN le logo uploadé par un coach est panoramique ou en portrait
- THEN il DOIT être contenu dans la boîte sans être ni étiré ni rogné

#### Scenario: Page sans image dédiée
- WHEN une page ne déclare pas sa propre image OG (accueil, `/me/*`)
- THEN elle DOIT hériter de l'image par défaut du site, générée en
  1200 × 630

### Requirement: Aperçu de partage d'un roster
L'aperçu d'un roster partagé DOIT porter le logo de l'équipe, un titre
composé du nom de l'équipe ET du nom du site, et la description du coach
quand elle existe.

#### Scenario: Logo de l'équipe
- WHEN l'équipe a un logo uploadé (`logoUrl`)
- THEN l'image OG DOIT afficher ce logo

#### Scenario: Repli sur l'emblème du roster
- WHEN l'équipe n'a pas de logo uploadé
- THEN l'image OG DOIT afficher l'emblème programmatique de son roster
  (mêmes couleurs canoniques que `<TeamLogo>`)

#### Scenario: Titre
- WHEN un roster est partagé
- THEN le titre de l'aperçu DOIT contenir le nom de l'équipe ET
  « Nuffle Arena »

#### Scenario: Description du coach
- WHEN l'équipe a une description
- THEN le texte de l'aperçu DOIT être cette description (tronquée sur une
  frontière de mot si elle est trop longue) au lieu du texte générique du
  site

#### Scenario: Sans description
- WHEN l'équipe n'a pas de description
- THEN le texte de l'aperçu DOIT rester la description générée
  (race, effectif, valeur d'équipe)

### Requirement: Le lien de fiche privée résout vers la page publique
Une requête de LECTURE non authentifiée sur la fiche `/me/teams/:id` (sans
query string) DOIT être résolue par `/r/by-id/:id` : vers `/r/:token` quand
l'équipe est publique, vers le parcours de connexion habituel sinon. Sans
cela, le garde `/me/*` redirige avant tout rendu et aucune metadata de la
fiche n'est jamais lue.

#### Scenario: Lien d'une équipe partagée collé dans un salon
- WHEN un scraper suit `/me/teams/:id` d'une équipe publique
- THEN il DOIT aboutir sur `/r/:token`
- AND l'aperçu obtenu DOIT être celui du roster (logo, nom, description)

#### Scenario: Lien d'une équipe privée
- WHEN la requête vise une équipe non partagée, inexistante, ou que l'API
  d'aperçu est injoignable
- THEN elle DOIT aboutir sur le parcours de connexion habituel, avec
  `?redirect=/me/teams/:id` intact

#### Scenario: Périmètre du détournement
- WHEN la requête vise `/me/teams`, `/me/teams/new`, une sous-page
  (`/edit`, `/journal`…), porte une query string, ou n'est pas une lecture
- THEN elle NE DOIT PAS être détournée

#### Scenario: Pas de redirection ouverte
- WHEN un appelant ajoute au résolveur un paramètre pointant vers un
  domaine tiers
- THEN la redirection DOIT rester interne, reconstruite depuis l'id de
  route

#### Scenario: Session valide
- WHEN la requête porte une session valide
- THEN la fiche DOIT s'afficher normalement, sans détour

### Requirement: Aperçu de la fiche privée gaté par le partage
La fiche `/me/teams/[id]` DOIT être `noindex`. Son aperçu NE DOIT être
enrichi (nom, logo, description) QUE si l'équipe a activé le partage
public ; sinon il DOIT rester l'aperçu générique du site.

#### Scenario: Équipe partagée
- WHEN l'équipe a activé le partage public
- THEN l'aperçu de `/me/teams/[id]` DOIT porter son nom, son logo et sa
  description
- AND `og:url` DOIT pointer vers la page publique `/r/:token`

#### Scenario: Équipe privée
- WHEN l'équipe n'a pas activé le partage public
- THEN l'aperçu NE DOIT révéler ni le nom, ni le logo, ni la description
  de l'équipe
