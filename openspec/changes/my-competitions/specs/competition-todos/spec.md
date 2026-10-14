# competition-todos

## Purpose

Dire à chaque coach ce qui l'attend dans ses ligues et coupes — comme joueur
et comme commissaire — à partir de l'état existant des compétitions, sans
rien stocker, avec un lien vers l'écran où l'action se fait.

## ADDED Requirements

### Requirement: Les « à faire » se dérivent de l'état, ils ne se stockent pas

Chaque « à faire » DOIT être recalculé à chaque lecture à partir de l'état
courant des compétitions (rencontres, feuilles de match, saisons, rondes,
invitations, évolutions, pronostics). Aucun « à faire » NE DOIT être persisté,
ni marqué comme lu : il disparaît dès que l'état qui le justifie change, quel
que soit l'écran où l'action a été faite.

#### Scenario: Action faite ailleurs
- **WHEN** un coach soumet sa feuille depuis la page de la rencontre puis rouvre ses « à faire »
- **THEN** l'« à faire » de cette feuille NE DOIT plus apparaître

#### Scenario: Retour en arrière
- **WHEN** le commissaire invalide une feuille déjà validée
- **THEN** l'« à faire » correspondant DOIT réapparaître pour les deux coachs

### Requirement: Une route sert les « à faire » et les prochains matchs

`GET /competitions/me/todos` DOIT exiger un utilisateur authentifié (`401`
sinon) et servir, sur ses seules compétitions « à moi » encore actives et ses
invitations en attente : la liste de ses « à faire » et la liste de ses
prochains matchs. Chaque « à faire » DOIT porter son type, la compétition
concernée, le lien de l'écran d'action, son échéance éventuelle et si
quelqu'un attend après le lecteur.

#### Scenario: Coach sans rien à faire
- **WHEN** un coach dont aucune compétition n'appelle d'action appelle la route
- **THEN** la réponse DOIT être `200` avec une liste d'« à faire » vide

#### Scenario: Compétition terminée
- **WHEN** une ligue du coach est `completed` ou `archived`, ou une coupe `terminee` ou `archivee`
- **THEN** aucun « à faire » NE DOIT en provenir

### Requirement: Feuille de match côté joueur

Pour chaque rencontre ouverte dont le lecteur possède une équipe, la route
DOIT servir au plus un « à faire » de feuille : `sheet.submit` si l'adversaire
a soumis et pas lui (quelqu'un attend), `sheet.finish` si la feuille est
commencée ou invalidée sans soumission de sa part, `sheet.enter` si la date
prévue est passée sans feuille. Rien quand sa part est soumise, ni avant la
date prévue.

#### Scenario: Adversaire déjà soumis
- **WHEN** la feuille d'une rencontre est `submitted_away` et que le lecteur joue à domicile
- **THEN** un « à faire » `sheet.submit` DOIT être servi, marqué comme attendu par quelqu'un

#### Scenario: Ma part soumise
- **WHEN** la feuille est `submitted_home` et que le lecteur joue à domicile
- **THEN** aucun « à faire » de feuille NE DOIT être servi pour cette rencontre

#### Scenario: Match passé sans feuille
- **WHEN** la date prévue d'une rencontre du lecteur est passée et qu'aucune feuille n'existe
- **THEN** un « à faire » `sheet.enter` DOIT être servi

#### Scenario: Feuille invalidée
- **WHEN** le commissaire a invalidé la feuille d'une rencontre du lecteur
- **THEN** un « à faire » `sheet.finish` DOIT être servi pour les deux coachs

### Requirement: Date du prochain match à fixer

Pour chaque équipe du lecteur engagée dans une compétition active, si sa
PREMIÈRE rencontre ouverte (dans l'ordre des journées, puis de la date) n'a
pas de date prévue, la route DOIT servir un « à faire » `match.schedule`. Les
rencontres suivantes sans date NE DOIVENT PAS en produire.

#### Scenario: Calendrier complet généré d'un coup
- **WHEN** une saison a sept journées générées sans date et que le lecteur n'a encore rien joué
- **THEN** un seul « à faire » `match.schedule` DOIT être servi, pour la journée 1

### Requirement: Prochains matchs

La route DOIT servir, pour chaque équipe du lecteur engagée dans une
compétition active, sa première rencontre ouverte : adversaire, journée ou
ronde, date prévue éventuelle et état de la feuille. Cette information
n'est PAS un « à faire » et DOIT être servie à part.

#### Scenario: Match daté
- **WHEN** la prochaine rencontre d'une équipe du lecteur est prévue samedi
- **THEN** elle DOIT figurer dans les prochains matchs avec sa date et son adversaire

### Requirement: Évolutions à choisir

Pour chaque équipe du lecteur ayant des choix d'évolution en attente après un
match de ligue, la route DOIT servir un « à faire » `advancements.choose`
menant à l'écran d'évolution de l'équipe.

#### Scenario: Après validation
- **WHEN** la feuille validée d'un match ouvre des choix d'évolution pour l'équipe du lecteur
- **THEN** un « à faire » `advancements.choose` DOIT être servi jusqu'à ce que ces choix soient faits

### Requirement: Pronostics ouverts

Pour chaque saison d'une ligue « à moi » dont les pronostics sont activés, la
route DOIT servir un « à faire » `predictions.make` quand au moins une
rencontre reste pronosticable par le lecteur et n'a pas encore son
pronostic, avec le nombre de rencontres concernées et, pour échéance, la
première fermeture connue. Les règles d'éligibilité et de clôture des
pronostics s'appliquent telles quelles.

#### Scenario: Ses propres matchs
- **WHEN** la seule rencontre sans pronostic du lecteur oppose une de ses équipes
- **THEN** aucun « à faire » `predictions.make` NE DOIT être servi

#### Scenario: Pronostics désactivés
- **WHEN** une ligue a ses pronostics à `off`
- **THEN** aucun « à faire » de pronostic NE DOIT en provenir

### Requirement: Invitations à accepter

Chaque invitation de ligue ou de coupe en attente, non expirée et adressée
nommément au lecteur DOIT produire un « à faire » `invitation.answer` menant
à l'écran d'acceptation, avec pour échéance son expiration.

#### Scenario: Invitation de coupe
- **WHEN** un coach a reçu une invitation en attente pour une coupe
- **THEN** un « à faire » `invitation.answer` DOIT être servi avec la date d'expiration

### Requirement: Feuilles à valider par le commissaire

Pour chaque compétition dont le lecteur est le créateur, chaque feuille dont
les deux coachs ont soumis leur part DOIT produire un « à faire »
`sheet.validate`, marqué comme attendu par quelqu'un. Un administrateur qui
n'est pas le créateur NE DOIT PAS le recevoir.

#### Scenario: Deux soumissions
- **WHEN** une feuille d'une coupe créée par le lecteur passe à `both_submitted`
- **THEN** un « à faire » `sheet.validate` DOIT être servi au lecteur

### Requirement: Bracket de play-offs à publier

Pour chaque saison de ligue ou coupe créée par le lecteur dont le bracket a
été généré sans être publié, la route DOIT servir un « à faire »
`playoffs.publish`, marqué comme attendu par quelqu'un.

#### Scenario: Bracket généré automatiquement
- **WHEN** la phase régulière d'une saison se termine et génère un bracket non publié
- **THEN** son commissaire DOIT recevoir un « à faire » `playoffs.publish`

### Requirement: Coupe en attente de sa ronde suivante

Pour chaque coupe créée par le lecteur, en cours, comptant au moins deux
inscrits, dont aucune rencontre de la dernière ronde (ou aucune ronde) n'est
encore ouverte, la route DOIT servir un « à faire » `cup.round.next` (ronde
suivante, play-offs ou fin de coupe : le commissaire choisit), marqué comme
attendu par quelqu'un.

#### Scenario: Ronde close
- **WHEN** toutes les rencontres de la ronde 3 d'une coupe en cours sont jouées
- **THEN** son commissaire DOIT recevoir un « à faire » `cup.round.next`

#### Scenario: Ronde en cours
- **WHEN** une rencontre de la dernière ronde est encore ouverte
- **THEN** aucun « à faire » `cup.round.next` NE DOIT être servi

### Requirement: Saison prête à démarrer ou à clôturer

Pour chaque ligue créée par le lecteur, la route DOIT servir `season.start`
quand une saison a ses inscriptions ouvertes, aucun calendrier et au moins
deux inscrits actifs, et `season.close` quand une saison en cours a toutes ses
journées terminées. Ces suggestions NE DOIVENT PAS être marquées comme
attendues par quelqu'un.

#### Scenario: Dernière journée jouée
- **WHEN** la dernière journée d'une saison en cours passe à `completed`
- **THEN** son commissaire DOIT recevoir un « à faire » `season.close`

#### Scenario: Un seul inscrit
- **WHEN** une saison aux inscriptions ouvertes ne compte qu'une équipe active
- **THEN** aucun « à faire » `season.start` NE DOIT être servi

### Requirement: Inscriptions de coupe à clore

Pour chaque coupe créée par le lecteur, ouverte, non validée et comptant au
moins deux inscrits, la route DOIT servir un « à faire »
`cup.registrations.close`, non marqué comme attendu par quelqu'un.

#### Scenario: Coupe prête
- **WHEN** une coupe ouverte compte quatre équipes inscrites
- **THEN** son commissaire DOIT recevoir un « à faire » `cup.registrations.close`

### Requirement: Journée en retard à relancer

Pour chaque saison en cours d'une ligue créée par le lecteur, la route DOIT
servir un « à faire » `round.remind` par journée dont au moins une rencontre
a dépassé sa date prévue sans feuille soumise, avec le nombre de rencontres
concernées. Une rencontre simplement sans date NE DOIT PAS en produire : c'est
l'« à faire » de ses coachs.

#### Scenario: Feuilles en retard
- **WHEN** deux rencontres de la journée 4 ont dépassé leur date sans feuille soumise
- **THEN** le commissaire DOIT recevoir un « à faire » `round.remind` pour la journée 4 comptant deux rencontres

### Requirement: Rien que le lecteur ne puisse voir

Aucun « à faire » ni prochain match NE DOIT porter sur une rencontre que le
lecteur ne peut pas voir : rencontres d'un bracket non publié pour un coach
qui n'est pas le commissaire, rencontre exempte, rencontre dont un côté
attend encore son qualifié. Une équipe retirée d'une saison NE DOIT plus
produire d'« à faire » de joueur dans cette saison.

#### Scenario: Bracket non publié
- **WHEN** une équipe du lecteur est placée dans un bracket de play-offs non publié
- **THEN** ni « à faire » ni prochain match NE DOIT en être servi au lecteur s'il n'est pas le commissaire

#### Scenario: Retrait
- **WHEN** l'équipe du lecteur s'est retirée d'une saison
- **THEN** aucune de ses rencontres de cette saison NE DOIT produire d'« à faire »

### Requirement: Ordre des « à faire »

Les « à faire » DOIVENT être servis dans un ordre stable : d'abord ceux où
quelqu'un attend après le lecteur, puis par échéance croissante (sans
échéance en dernier), puis par nom de compétition, puis selon un ordre fixe
des types.

#### Scenario: Attente avant échéance
- **WHEN** le lecteur a une feuille à valider sans échéance et une invitation qui expire demain
- **THEN** la feuille à valider DOIT être servie en premier

### Requirement: Les « à faire » s'affichent sur « Mes compétitions »

La page `/me/competitions` DOIT ouvrir sur la liste de tous les « à faire »
du lecteur, dans l'ordre servi, chacun menant à l'écran où l'action se fait,
et chaque carte de compétition DOIT afficher ses propres « à faire » et son
prochain match. Sans « à faire », la page DOIT le dire.

#### Scenario: Feuille à soumettre
- **WHEN** le lecteur a un « à faire » `sheet.submit`
- **THEN** la page DOIT l'afficher en tête avec un lien vers la feuille de la rencontre

#### Scenario: Rien à faire
- **WHEN** la route sert une liste d'« à faire » vide
- **THEN** la page DOIT afficher qu'il n'y a rien à faire
