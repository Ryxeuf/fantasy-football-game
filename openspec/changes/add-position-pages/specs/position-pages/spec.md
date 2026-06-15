# position-pages (delta)

Capability : pages publiques de detail par position de roster
(`/teams/[slug]/[position]`) + leur indexation SEO + l'invariant de slug
dont depend la resolution d'URL. Surface front (`apps/web`) reutilisant
l'endpoint existant `GET /api/rosters/:slug` (aucun nouvel endpoint).

## ADDED Requirements

### Requirement: Page de detail par position
Chaque position d'un roster DOIT etre accessible sur une page dediee
`/teams/[slug]/[position]`, calquee sur `/skills/[slug]`. La page DOIT
afficher le nom de la position, ses caracteristiques (MA, ST, AG, PA, AV),
son cout, ses bornes `min`/`max`, ses competences de base et ses categories
d'acces aux competences. La donnee DOIT provenir de `GET /api/rosters/:slug`
(positions deja servies inline) ; aucun nouvel endpoint serveur ni
migration n'est requis.

#### Scenario: Position existante affichee
- WHEN un visiteur ouvre `/teams/<roster>/<position>` pour une position du roster
- THEN la page DOIT afficher le nom, les stats (MA/ST/AG/PA/AV), le cout et les bornes min/max
- AND la page DOIT etre rendue cote serveur et cachee (ISR), sans dependre du backend au build

#### Scenario: Position inexistante
- WHEN le segment de position ne correspond a aucune position du roster
- THEN la page DOIT repondre `notFound()` (404)
- AND ses metadonnees DOIVENT porter `robots: { index: false }`

### Requirement: Resolution du slug de position depuis l'URL
Le segment d'URL de position DOIT etre le slug DB **prive de son prefixe
roster** (ex : `lineman` pour le slug `skaven_lineman`). La page DOIT
resoudre la position en reconstruisant `${rosterSlug}_${segment}`, avec un
repli "correspondance par suffixe" si la reconstruction echoue.

#### Scenario: Reconstruction nominale
- WHEN l'URL est `/teams/skaven/lineman`
- THEN la resolution DOIT chercher la position de slug `skaven_lineman` dans le roster `skaven`
- AND la trouver sans transformation supplementaire

#### Scenario: Repli par suffixe
- WHEN la reconstruction `${rosterSlug}_${segment}` ne correspond a aucune position
- THEN la resolution DOIT tenter une correspondance par suffixe de slug
- AND ne retourner aucune position (404) si aucune ne correspond

### Requirement: Invariant de prefixe de slug
Pour tout roster season_3, le slug de chacune de ses positions DOIT
commencer par `${roster.slug}_`. Cet invariant — dont depend la
reconstruction d'URL — DOIT etre verifie par un test automatise.

#### Scenario: Roster non conforme detecte
- WHEN une position d'un roster season_3 a un slug ne commencant pas par `${roster.slug}_`
- THEN le test d'invariant DOIT echouer en CI

### Requirement: Nettoyage du nom d'affichage
Le nom de position affiche (titre, `<h1>`, alt-text) NE DOIT PAS contenir
le marqueur ` *` (annotation "big guy") present dans certaines donnees. Le
slug d'URL, qui n'en contient pas, ne DOIT pas etre affecte.

#### Scenario: Marqueur retire de l'affichage
- WHEN une position se nomme `Homme-arbre *`
- THEN la page DOIT afficher `Homme-arbre` (sans ` *`)
- AND PEUT signaler l'etat "big guy" via un badge

### Requirement: Maillage interne vers competences et roster
La page de detail d'une position DOIT lier ses competences de base vers les
pages `/skills/[slug]` correspondantes, ses categories d'acces vers
`/skills` filtre par categorie, ses positions liees (meme roster) vers leur
page de detail, et exposer un fil d'Ariane remontant a `/teams/[slug]`.

#### Scenario: Liens vers les competences
- WHEN une position a des competences de base (ex : `dodge`, `animosity`)
- THEN chacune DOIT etre rendue en lien vers `/skills/dodge`, `/skills/animosity`

#### Scenario: Positions liees du meme roster
- WHEN la page d'une position est affichee
- THEN elle DOIT lister les autres positions du meme roster avec un lien vers chaque page de detail

### Requirement: Indexation SEO des positions season_3
Les URLs de position des rosters season_3 DOIVENT etre ajoutees au sitemap
(`apps/web/app/sitemap.ts`) avec leurs alternates hreflang, sans doublon.
Les positions season_2 NE DOIVENT PAS etre enumerees (edition legacy), et
l'URL canonique d'une position DOIT etre la variante season_3 sans
parametre de ruleset.

#### Scenario: Positions season_3 dans le sitemap
- WHEN le sitemap est genere
- THEN il DOIT contenir une entree `/teams/<roster>/<position>` pour chaque position des rosters season_3
- AND ne DOIT pas contenir de doublon

#### Scenario: Positions season_2 exclues
- WHEN un roster n'existe qu'en season_2 (ou pour ses positions specifiques season_2)
- THEN ces URLs de position NE DOIVENT PAS apparaitre dans le sitemap
