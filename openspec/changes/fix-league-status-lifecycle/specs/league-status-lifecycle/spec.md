# league-status-lifecycle (delta)

Capability : l'invariant entre `League.status` et l'etat de ses
`LeagueSeason`. Surface serveur (`apps/server`) ; `League.status` reste un
champ derive de l'activite des saisons pour l'echelle « avant »
(`draft`→`open`→`in_progress`), les etats terminaux restant a la main de l'admin.

## ADDED Requirements

### Requirement: Avancement automatique de `League.status`
`League.status` DOIT progresser automatiquement en reaction aux actions de
cycle de vie de ses saisons, selon l'echelle ordonnee
`draft < open < in_progress` :

- l'ouverture des inscriptions d'une saison (`openSeasonForRegistration`) DOIT
  faire passer la ligue a au moins `open` ;
- le demarrage d'une saison (`startSeason`) DOIT faire passer la ligue a au
  moins `in_progress`.

L'avancement DOIT etre *forward-only* : il ne DOIT jamais retrograder une ligue
vers un statut de rang inferieur.

#### Scenario: Ouverture des inscriptions
- WHEN le createur ouvre les inscriptions d'une saison d'une ligue en `draft`
- THEN `League.status` DOIT devenir `open`

#### Scenario: Demarrage d'une saison
- WHEN le createur demarre une saison d'une ligue en `draft` ou `open`
- THEN `League.status` DOIT devenir `in_progress`

#### Scenario: Pas de retrogradation
- WHEN une saison est ouverte ou demarree sur une ligue deja a un rang superieur
  ou egal a la cible
- THEN `League.status` NE DOIT PAS changer

### Requirement: Etats terminaux pilotes par l'admin
Les statuts `completed` et `archived` sont hors de l'echelle d'avancement
automatique. L'avancement automatique NE DOIT PAS ecraser ni retrograder une
ligue dont le statut est `completed` ou `archived` ; seuls les chemins admin
(`PATCH /admin/leagues/:id/status`, archivage) DOIVENT pouvoir les fixer.

#### Scenario: Ligue completed preservee
- WHEN une saison est demarree sur une ligue en `completed`
- THEN `League.status` DOIT rester `completed`

### Requirement: Idempotence de l'avancement
L'avancement DOIT etre idempotent : si la ligue est deja au statut cible ou a un
rang superieur, aucune ecriture en base NE DOIT etre effectuee.

#### Scenario: Cible deja atteinte
- WHEN l'ouverture des inscriptions vise `open` sur une ligue deja `in_progress`
- THEN aucune mise a jour de `League.status` NE DOIT etre emise

### Requirement: Backfill de l'existant
Un backfill ponctuel DOIT permettre de recaler les ligues existantes bloquees en
`draft`/`open` sur l'etat reel de leurs saisons (une saison `in_progress` →
`in_progress` ; sinon une saison `scheduled` → `open`), de maniere *forward-only*
et idempotente, sans toucher les ligues `completed`/`archived`.

#### Scenario: Recalage d'une ligue active bloquee en draft
- WHEN une ligue en `draft` possede une saison `in_progress`
- THEN le backfill DOIT porter `League.status` a `in_progress`
- AND une seconde execution NE DOIT produire aucun changement
