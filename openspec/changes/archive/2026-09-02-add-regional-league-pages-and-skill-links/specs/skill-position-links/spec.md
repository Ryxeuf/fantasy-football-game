# skill-position-links (delta)

Capability : enrichissement de la page de détail d'une compétence
(`/skills/[slug]`) avec la liste des positions qui démarrent avec cette
compétence, liées vers les pages position (maillage interne). Surface front
(`apps/web`) réutilisant `GET /api/positions` ; aucun nouvel endpoint.

## ADDED Requirements

### Requirement: Positions démarrant avec une compétence
La page `/skills/[slug]` DOIT (MUST) afficher la liste des positions qui
**démarrent** (au recrutement) avec cette compétence, groupées par roster,
chaque position liée vers sa page `/teams/[slug]/[position]` et chaque
roster lié vers `/teams/[slug]`. La donnée DOIT provenir de
`GET /api/positions` (CSV `skills` de slugs de compétences de départ) ;
aucun nouvel endpoint ni migration n'est requis.

#### Scenario: Compétence portée par des positions
- WHEN un visiteur ouvre `/skills/<slug>` pour une compétence qu'au moins
  une position possède au départ
- THEN la page DOIT afficher un bloc « Positions avec cette compétence »
- AND chaque position DOIT lier vers `/teams/<rosterSlug>/<segment>`

#### Scenario: Compétence sans position de départ
- WHEN aucune position ne démarre avec la compétence
- THEN le bloc « Positions avec cette compétence » NE DOIT PAS être rendu

#### Scenario: Calcul robuste et non bloquant
- WHEN le fetch de `GET /api/positions` échoue
- THEN la page compétence DOIT tout de même s'afficher (bloc omis), sans erreur

### Requirement: Résolution du lien de position
Le lien vers une position DOIT (MUST) utiliser le slug DB **privé de son préfixe
roster** comme segment d'URL (ex : `lineman` pour `skaven_lineman`), et le
nom affiché DOIT être nettoyé du marqueur ` *` (annotation "big guy").

#### Scenario: Segment d'URL sans préfixe
- WHEN une position a le slug `skaven_gutter_runner` dans le roster `skaven`
- THEN son lien DOIT pointer vers `/teams/skaven/gutter_runner`
