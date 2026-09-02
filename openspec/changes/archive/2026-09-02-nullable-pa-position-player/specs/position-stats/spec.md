# position-stats (delta)

Capability : representation de l'absence de caracteristique de Passe (PA) de
bout en bout — colonne DB nullable, saisie admin, validation/API, propagation
Position → TeamPlayer, et affichage `-`. Aligne sur le pattern `StarPlayer`
deja en place (`pa Int?`, saisie optionnelle, rendu `null → "-"`).

## ADDED Requirements

### Requirement: PA absent representable en base
Les modeles `Position` et `TeamPlayer` DOIVENT autoriser une valeur de PA absente
(colonne `pa` nullable). Une valeur `null` DOIT signifier « aucune capacite de
Passe » (affichee `-`), distincte de toute valeur numerique. Les valeurs PA
existantes NE DOIVENT PAS etre alterees par ce changement (migration additive,
sans backfill).

#### Scenario: Position sans PA persistee
- WHEN un administrateur enregistre une position sans valeur de PA
- THEN la colonne `Position.pa` DOIT valoir `null`
- AND la relecture de la position DOIT renvoyer `pa: null` (jamais `0` ni `NaN`)

#### Scenario: Valeurs existantes preservees
- WHEN la migration assouplit la contrainte `NOT NULL`
- THEN toutes les positions et joueurs ayant une PA numerique DOIVENT la conserver

### Requirement: Saisie d'une PA absente depuis l'admin
Le formulaire d'administration d'une position (creation ET edition) DOIT
permettre de laisser le champ PA vide pour signifier « pas de passe ». Le champ
NE DOIT PAS etre obligatoire et DOIT indiquer a l'utilisateur que le vide
correspond a `-` (calque du formulaire StarPlayer existant).

#### Scenario: Champ PA laisse vide
- WHEN l'administrateur vide le champ PA et soumet le formulaire
- THEN la position DOIT etre enregistree avec `pa = null`
- AND l'API NE DOIT PAS rejeter la requete ni convertir le vide en `0`/`NaN`

#### Scenario: Champ PA renseigne
- WHEN l'administrateur saisit une valeur numerique de PA
- THEN cette valeur DOIT etre persistee telle quelle

### Requirement: Propagation de l'absence de PA vers les joueurs
Lorsqu'une equipe est creee ou approvisionnee a partir d'une position, la PA de
la position DOIT etre copiee telle quelle vers le joueur. Si la position a
`pa = null`, le joueur cree DOIT avoir `pa = null` ; aucune etape de copie NE
DOIT re-materialiser une valeur (`0`, `NaN`).

#### Scenario: Recrutement d'une position sans PA
- WHEN un coach recrute un joueur depuis une position de `pa = null`
- THEN l'insertion du joueur DOIT reussir
- AND `TeamPlayer.pa` DOIT valoir `null`

### Requirement: Affichage de l'absence de PA
Partout ou une PA est affichee (catalogue, fiche position, roster d'equipe,
consoles admin, donnees structurees SEO), une PA `null` DOIT etre rendue `-`
(ou le glyphe « — » deja en usage dans le composant), et une PA numerique DOIT
etre rendue `N+`. Aucun rendu NE DOIT produire `null+`, `NaN+`, ni la valeur
brute non gardee.

#### Scenario: Position sans PA affichee
- WHEN une position ou un joueur de `pa = null` est affiche
- THEN la PA rendue DOIT etre `-` (ou `—`)

#### Scenario: Position avec PA affichee
- WHEN une position ou un joueur de `pa = 2` est affiche
- THEN la PA rendue DOIT etre `2+`
