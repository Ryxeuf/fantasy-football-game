# cup-match-sheet

## Purpose

La saisie d'une rencontre de COUPE : exactement la feuille de match des
ligues — ouverture, avant-match, journal d'évènements, soumission des deux
coachs, validation du commissaire, invalidation — servie par les mêmes
routes et la même page.

Ce que la compétition change tient dans un jeu de règles, et rien d'autre :
une coupe se joue en résurrection et n'écrit RIEN sur les équipes (ni PSP,
ni blessure, ni mort, ni or, ni fans, ni évolution, ni achat, ni
licenciement), chaque rencontre repartant du roster d'inscription. Son
résultat est matérialisé en match local pour que le classement — entièrement
dérivé — n'ait pas à changer d'une ligne.

## Requirements

### Requirement: Une rencontre de coupe se saisit sur une feuille de match

Une rencontre de coupe (hors exempt) DOIT disposer de la MÊME feuille de
match qu'une rencontre de ligue, servie sous `/cup/pairings/:id/sheet` :
ouverture, avant-match, journal d'évènements, soumission par chacun des deux
coachs, validation par le commissaire, invalidation. Les autorisations sont
celles de la ligue : les deux coachs et le commissaire ouvrent et saisissent,
seul le commissaire valide et invalide.

La lecture DOIT indiquer la compétition d'origine (`competitionKind`) et le
jeu de règles appliqué (`competitionRules`).

#### Scenario: Ouverture par un coach
- WHEN un coach de la rencontre appelle `POST /cup/pairings/<id>/sheet`
- THEN la feuille DOIT être créée en `draft`
- AND `GET` DOIT servir `competitionKind = "cup"` et l'id de la coupe

#### Scenario: Validation réservée au commissaire
- WHEN un coach tiers appelle `POST /cup/pairings/<id>/sheet/validate`
- THEN la réponse DOIT être `403`

#### Scenario: Rencontre inconnue
- WHEN l'id ne correspond à aucune rencontre (ni ligue, ni coupe)
- THEN la réponse DOIT être `404`

#### Scenario: Exempt
- WHEN la rencontre est un exempt (`awayTeamId` absent)
- THEN aucune feuille NE DOIT pouvoir être ouverte

### Requirement: La validation d'une feuille de coupe n'écrit rien sur les équipes

Valider une feuille de coupe NE DOIT modifier aucune équipe : ni PSP, ni
blessure, ni mort, ni « manque le prochain match », ni trésorerie, ni fans
dévoués, ni évolution, ni achat, ni licenciement. Seuls le score de la
feuille, la rencontre et le classement de la coupe changent.

#### Scenario: Après validation
- WHEN une feuille de coupe portant deux touchdowns et une élimination est validée
- THEN la trésorerie, les fans et les PSP des deux équipes DOIVENT être inchangés
- AND aucun joueur NE DOIT être mort ni absent
- AND le classement de la coupe DOIT compter une victoire et deux TD pour l'équipe à domicile

### Requirement: Le résultat validé est matérialisé pour le classement

Le classement d'une coupe, ses podiums par action et ses classements
individuels étant DÉRIVÉS de ses matchs, la validation DOIT matérialiser la
rencontre en match local complété et rejouer le journal en actions
(touchdown, sortie au contact, sortie à l'agression, passe, interception).
L'opération DOIT être idempotente : revalider réécrit le même match.

#### Scenario: Revalidation
- WHEN une feuille déjà matérialisée est validée à nouveau
- THEN le même match local DOIT être mis à jour, jamais un second créé

### Requirement: Invalidation d'une feuille de coupe

Le commissaire DOIT pouvoir invalider une feuille validée tant que la coupe
n'est ni terminée ni archivée. L'invalidation DOIT retirer le match
matérialisé, remettre la rencontre à `scheduled` et rouvrir la ronde.

#### Scenario: Invalidation
- WHEN le commissaire invalide une feuille de coupe validée
- THEN le classement DOIT revenir à zéro match joué pour les deux équipes
- AND la rencontre DOIT être `scheduled` sans match local

#### Scenario: Coupe terminée
- WHEN la coupe est `terminee` ou `archivee`
- THEN `can-invalidate` DOIT répondre `ok: false` avec `cup-completed`

### Requirement: Roster de la « version du match » en coupe

Le gel d'une feuille de coupe DOIT partir du roster D'INSCRIPTION de chaque
équipe (`CupParticipant.rosterSnapshot`), pas de son état courant. En
l'absence de snapshot, le gel DOIT retomber sur l'état courant plutôt que
d'empêcher l'ouverture de la feuille.

### Requirement: Boîte de validation unique pour le commissaire

`GET /leagues/me/pending-validations` DOIT lister les feuilles en attente des
DEUX compétitions, chaque entrée portant sa compétition d'origine.
