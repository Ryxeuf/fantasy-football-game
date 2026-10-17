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
dérivé — n'ait pas à changer d'une ligne. Ce match local est un SUPPORT de
résultat, jamais un second écran de saisie : la feuille est le seul chemin
proposé au coach.

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

### Requirement: La feuille est le seul chemin de saisie proposé

Une rencontre de coupe NE DOIT proposer aucune création de partie offline, ni
aucun lien vers l'écran d'une partie offline — ni sur la rencontre, ni sur un
tour de bracket, ni en pied de page de la coupe. La feuille de match est la
seule action de saisie offerte, et reste le chemin de relecture une fois le
résultat validé.

Le match local matérialisé par la validation reste la source du classement
dérivé : il est un support de résultat, jamais un écran de saisie proposé au
coach.

#### Scenario: Rencontre à jouer
- WHEN un coach impliqué consulte sa rencontre
- THEN seule la feuille de match DOIT lui être proposée

#### Scenario: Rencontre jouée
- WHEN une rencontre a été validée et matérialisée
- THEN aucun lien vers `/local-matches` NE DOIT être affiché

#### Scenario: Tour de bracket en attente
- WHEN un tour de play-off attend encore un qualifié
- THEN aucune feuille NE DOIT être proposée pour ce tour

### Requirement: Roster de la « version du match » en coupe

Le gel d'une feuille de coupe DOIT partir du roster D'INSCRIPTION de chaque
équipe (`CupParticipant.rosterSnapshot`), pas de son état courant. En
l'absence de snapshot, le gel DOIT retomber sur l'état courant plutôt que
d'empêcher l'ouverture de la feuille.

### Requirement: Boîte de validation unique pour le commissaire

`GET /leagues/me/pending-validations` DOIT lister les feuilles en attente des
DEUX compétitions, chaque entrée portant sa compétition d'origine.

### Requirement: L'état de la feuille se lit sur la carte de la rencontre

Une carte de ronde de coupe DOIT annoncer une feuille soumise par un seul
coach (« En attente validation (1/2) ») ou par les deux (« En attente
validation »), comme le calendrier d'une ligue. `GET /cup/:id/rounds` (et les
rondes de `GET /cup/:id`) DOIVENT servir le statut de la feuille de chaque
rencontre.

#### Scenario: Les deux coachs ont soumis
- WHEN les deux coachs d'une rencontre de coupe ont soumis leur feuille
- THEN la carte DOIT afficher « En attente validation »

### Requirement: Matchs à valider d'une coupe

Quand les deux coachs d'une rencontre de coupe ont soumis la feuille, la
notification du commissaire DOIT nommer les deux équipes et pointer
`/cups/:id/pending-validations`. Cette page DOIT lister les feuilles de la
coupe en attente (« Ronde N »), avec un retour vers la coupe et un lien vers
chaque feuille de coupe.

#### Scenario: Notification d'une coupe
- WHEN la seconde soumission d'une feuille de coupe est enregistrée
- THEN le commissaire DOIT recevoir « Match à valider : <domicile> vs <extérieur> » menant à `/cups/:id/pending-validations`
