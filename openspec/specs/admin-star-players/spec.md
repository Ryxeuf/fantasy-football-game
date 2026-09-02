# admin-star-players

## Purpose

Administration des Star Players — formulaires de création
et d'édition (`/admin/data/star-players/*`) et routes serveur
correspondantes.

## Requirements

### Requirement: Compétences saisies en cases à cocher
Les formulaires de création et d'édition d'un Star Player DOIVENT
présenter les compétences en cases à cocher, groupées par catégorie,
avec un filtre texte portant sur le slug, le nom français et le nom
anglais. Ils NE DOIVENT PLUS proposer de champ texte de slugs séparés
par des virgules.

Le catalogue proposé DOIT être filtré sur le ruleset du Star Player et
dédoublonné par slug.

#### Scenario: Compétences existantes cochées à l'ouverture
- WHEN l'admin ouvre l'édition d'un Star Player ayant les compétences `block` et `loner-4`
- THEN les cases `block` et `loner-4` DOIVENT être cochées
- AND les autres cases du catalogue NE DOIVENT PAS l'être

#### Scenario: Slug hors catalogue conservé
- WHEN un Star Player porte un slug de compétence absent du catalogue de son ruleset
- THEN ce slug DOIT rester affiché, coché, sous la mention « hors catalogue »
- AND un enregistrement sans y toucher NE DOIT PAS le retirer

#### Scenario: Catalogue filtré sur le ruleset
- WHEN l'admin ouvre l'édition d'un Star Player de ruleset `season_3`
- THEN le catalogue DOIT être chargé via `/admin/data/skills?ruleset=season_3`
- AND un slug présent dans les deux rulesets NE DOIT apparaître qu'une fois

### Requirement: Règles de recrutement saisies en cases à cocher
Le champ « Recrutable par » DOIT être saisi en cases à cocher sur deux
listes distinctes : les règles globales (`all`, ligues régionales,
alignements « Favori de… ») et les rosters explicitement ciblés.

Le catalogue des règles DOIT couvrir `all`, l'intégralité de
`REGIONAL_LEAGUES` et toute règle régionale portée par un roster dans
`TEAM_REGIONAL_RULES_BY_RULESET`, sans doublon.

#### Scenario: Règle globale et roster ciblé cochés séparément
- WHEN un Star Player est recrutable par `old_world_classic` et par le roster `skaven`
- THEN la case de règle `old_world_classic` DOIT être cochée
- AND la case du roster `skaven` DOIT être cochée dans la liste des rosters

#### Scenario: Alignements « Favori de… » proposés
- WHEN l'admin ouvre le sélecteur de règles
- THEN `favoured_of_khorne`, `favoured_of_nurgle` et `favoured_of_hashut` DOIVENT y figurer

### Requirement: Lien vers un roster préservé à l'enregistrement
Un roster coché DOIT être envoyé à l'API sous la forme
`{ rule: <slug du roster>, rosterId: <id du roster> }`. Une règle
globale DOIT être envoyée sous forme de chaîne. L'enregistrement NE
DOIT PAS transformer une entrée liée à un roster en entrée sans roster.

#### Scenario: Aller-retour sans perte
- WHEN l'admin enregistre sans modifier un Star Player recrutable par le roster `skaven`
- THEN l'entrée `StarPlayerHirableBy` correspondante DOIT conserver son `rosterId`

#### Scenario: Roster absent du catalogue ignoré
- WHEN la sélection référence un id de roster absent du catalogue chargé
- THEN cet id NE DOIT PAS être envoyé à l'API

### Requirement: Résolution des compétences d'un Star Player
La création et la mise à jour d'un Star Player DOIVENT résoudre les
slugs de compétences en identifiants `Skill` dans le ruleset du Star
Player, puis connecter la relation par `id`. Un `connect` par `slug`
seul est interdit : `Skill` est unique par `[slug, ruleset]`.

La résolution DOIT avoir lieu **avant** toute suppression des relations
existantes. Si au moins un slug est introuvable, l'API DOIT répondre
`400` avec la liste des slugs manquants et NE DOIT rien modifier.

La création DOIT accepter un `ruleset` optionnel, résolu par
`resolveRuleset` (donc `DEFAULT_RULESET` en son absence), comme le fait
déjà `POST /admin/data/skills`. Le ruleset résolu DOIT être celui
persisté ET celui utilisé pour résoudre les slugs, sans quoi les deux
divergeraient.

#### Scenario: Connexion par identifiant
- WHEN l'admin enregistre un Star Player `season_3` avec les compétences `block` et `dodge`
- THEN la relation DOIT être créée en connectant les `Skill` par `id` dans le ruleset `season_3`

#### Scenario: Slug introuvable, aucune relation détruite
- WHEN l'admin enregistre un Star Player avec un slug de compétence inexistant
- THEN l'API DOIT répondre `400` en nommant le slug manquant
- AND les `StarPlayerSkill` et `StarPlayerHirableBy` existants NE DOIVENT PAS être supprimés

#### Scenario: Star Player inconnu
- WHEN la mise à jour cible un id de Star Player inexistant
- THEN l'API DOIT répondre `404` sans supprimer aucune relation
