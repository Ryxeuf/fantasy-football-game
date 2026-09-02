# team-rename (delta)

Capability : le coach propriétaire d'une équipe PEUT changer son nom après
la création, y compris quand l'équipe est engagée dans un match, une ligue
ou une coupe. Le renommage est cosmétique (aucun effet sur la VE, le
budget ou la composition) et journalisé.

## ADDED Requirements

### Requirement: Renommage par le propriétaire
Le coach propriétaire d'une équipe DOIT pouvoir en changer le nom via
`PATCH /team/:id/name` `{ name }`. Le nom DOIT être trimé, non vide et
d'au plus 100 caractères — les mêmes bornes qu'à la création. La réponse
DOIT rendre l'équipe avec son nouveau nom.

#### Scenario: Renommage valide
- WHEN le propriétaire envoie `{ name: "  Les Crânes Fêlés  " }`
- THEN `Team.name` DOIT valoir `"Les Crânes Fêlés"` (trimé)
- AND la réponse DOIT contenir l'équipe renommée (HTTP 200)

#### Scenario: Nom vide ou trop long
- WHEN le nom est vide (ou blanc) après trim, ou dépasse 100 caractères
- THEN la requête DOIT être refusée (HTTP 400) et le nom NE DOIT PAS
  changer

#### Scenario: Nom identique
- WHEN le nom envoyé est identique au nom courant (après trim)
- THEN la requête DOIT réussir sans écriture ni étape de journal

### Requirement: Renommage autorisé équipe engagée
Le renommage NE DOIT PAS passer par le verrou anti-triche du roster
(`isTeamRosterFrozen`). Une équipe engagée dans un match en cours, une
ligue ou une coupe DOIT rester renommable par son propriétaire. Un match
déjà démarré DOIT conserver le nom figé dans son état de jeu.

#### Scenario: Équipe engagée en ligue
- WHEN le propriétaire renomme une équipe inscrite à une saison de ligue
- THEN le renommage DOIT réussir (HTTP 200)

#### Scenario: Match en cours
- WHEN le propriétaire renomme une équipe engagée dans un match `active`
- THEN le renommage DOIT réussir
- AND l'état de jeu du match en cours DOIT continuer d'afficher le nom
  figé au coup d'envoi

### Requirement: Propriété exclusive
Seul le propriétaire DOIT pouvoir renommer une équipe. Une équipe
inexistante, appartenant à un autre coach, ou déjà supprimée
(`deletedAt` non nul) DOIT être indiscernable : HTTP 404.

#### Scenario: Équipe d'un autre coach
- WHEN un utilisateur renomme une équipe qu'il ne possède pas
- THEN la requête DOIT être refusée (HTTP 404) sans révéler l'existence
  de l'équipe

#### Scenario: Équipe supprimée
- WHEN le propriétaire renomme une équipe soft-deletée
- THEN la requête DOIT être refusée (HTTP 404)

### Requirement: Journalisation du renommage
Tout renommage effectif DOIT écrire une étape `team.rename` dans le
journal d'équipe, avec l'état AVANT capturé pour que le diff porte
`name: { from, to }`. L'échec du journal NE DOIT PAS faire échouer le
renommage déjà committé.

#### Scenario: Étape journalisée
- WHEN un renommage effectif aboutit
- THEN une étape `team.rename` DOIT être enregistrée avec l'ancien et le
  nouveau nom

### Requirement: Édition inline sur la fiche d'équipe
La fiche `/me/teams/[id]` DOIT proposer au propriétaire un contrôle
d'édition du nom à côté du titre, disponible même quand l'édition du
roster est verrouillée. La validation locale DOIT refléter les bornes
serveur (non vide, ≤ 100 caractères) et l'erreur serveur DOIT être
affichée telle quelle.

#### Scenario: Renommage depuis la fiche
- WHEN le coach ouvre le contrôle, saisit un nom valide et valide
- THEN un `PATCH /team/:id/name` DOIT partir et le titre DOIT afficher le
  nouveau nom sans rechargement

#### Scenario: Nom invalide
- WHEN le champ est vide ou dépasse 100 caractères
- THEN le bouton de validation DOIT être désactivé
