# roster-share-preview (delta)

Capability : la page publique d'une équipe partagée (`/r/:token`) montre
l'équipe telle que son coach la voit — identité (logo, fluff), effectif
lisible (compétences nommées, base vs acquise, valeur du joueur) et staff
chiffré — sans jamais exiger de compte ni exposer autre chose que ce que
le partage opt-in autorise.

## ADDED Requirements

### Requirement: Chiffres calculés par le serveur
`GET /api/public/teams/:token` DOIT servir, en plus du roster, la valeur
de chaque joueur (`playerValues`), les coûts unitaires du staff
(`staffConfig`) et les postes de dépense avec VE/VEA (`budgetSummary`).
Ces valeurs DOIVENT provenir de la MÊME résolution que la valeur d'équipe
(coûts de poste en base, barème de l'édition, surcoût Élite) : la page
publique NE DOIT PAS re-dériver un chiffre que la fiche du coach
contredirait.

#### Scenario: Équipe partagée
- WHEN un visiteur anonyme lit `/api/public/teams/:token` d'une équipe
  publique
- THEN la réponse DOIT porter `playerValues` indexé par identifiant de
  joueur, `staffConfig` et `budgetSummary`
- AND la valeur d'équipe rendue DOIT être celle du résumé fraîchement
  calculé plutôt que la colonne stockée

#### Scenario: Enrichissement indisponible
- WHEN le calcul d'un de ces trois enrichissements échoue
- THEN la réponse DOIT rester un 200 portant l'équipe et son effectif
- AND le champ concerné DOIT être absent, à charge de l'affichage de
  replier sur ses défauts

#### Scenario: Lecture sans écriture
- WHEN la valeur d'équipe fraîchement calculée diffère de la colonne
  stockée
- THEN la lecture publique NE DOIT rien persister : elle est anonyme

### Requirement: Réponse publique explicite
La réponse de `GET /api/public/teams/:token` DOIT être une vue explicite
et non la ligne `Team` brute : une colonne ajoutée au modèle NE DOIT PAS
devenir publique par le seul fait d'exister.

#### Scenario: Champs internes
- WHEN un visiteur lit une équipe partagée
- THEN la réponse NE DOIT contenir ni `ownerId`, ni `shareToken`, ni
  `isPublic`

### Requirement: Effectif lisible sur la page publique
`/r/:token` DOIT afficher les compétences des joueurs comme la fiche du
coach : libellés localisés (jamais les slugs du moteur), distinction
visuelle entre compétence de BASE de la position et compétence ACQUISE,
accès primaire/secondaire du poste, et description au survol. Le libellé
de poste servi DOIT être celui de la base.

#### Scenario: Compétences nommées
- WHEN un joueur porte `block,dodge` et que le catalogue est résolu
- THEN la page DOIT afficher « Blocage » et « Esquive », et non les slugs
- AND la compétence absente des compétences par défaut du poste DOIT être
  distinguée visuellement

#### Scenario: Catalogue ou détail roster indisponible
- WHEN le catalogue de compétences ou le détail du roster n'a pas pu être
  chargé
- THEN l'effectif DOIT rester affiché, avec un libellé de poste lisible
  (jamais un slug brut)

### Requirement: Coût de chaque joueur
`/r/:token` DOIT afficher la VALEUR de chaque joueur (embauche + surcoûts
d'avancement), et non son tarif de recrue.

#### Scenario: Joueur amélioré
- WHEN l'API sert la valeur du joueur
- THEN la page DOIT afficher cette valeur

#### Scenario: Valeurs non servies
- WHEN l'API ne sert pas `playerValues`
- THEN la page DOIT replier sur le tarif d'embauche du poste servi par le
  détail du roster, puis sur le catalogue compilé

### Requirement: Staff chiffré et identité de l'équipe
`/r/:token` DOIT afficher les cinq postes de staff (relances,
cheerleaders, assistants, apothicaire, fans dévoués) avec leur COÛT, la
trésorerie, la valeur d'équipe et la valeur d'équipe actuelle, ainsi que
le logo de l'équipe et le fluff du coach.

#### Scenario: Poste acheté
- WHEN l'équipe a acheté 2 relances à 60 000 po
- THEN la page DOIT afficher l'effectif « 2 » ET le coût « 120K po »

#### Scenario: Poste non acheté
- WHEN un poste n'a rien coûté (0 assistant, apothicaire absent, un seul
  fan dévoué — le premier est offert)
- THEN aucun coût NE DOIT être affiché pour ce poste

#### Scenario: Logo
- WHEN le coach a uploadé un logo
- THEN la page DOIT l'afficher
- WHEN il n'en a pas
- THEN la page DOIT afficher l'emblème programmatique du roster
