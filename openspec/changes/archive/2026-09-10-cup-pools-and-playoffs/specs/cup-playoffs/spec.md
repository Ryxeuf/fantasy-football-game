# cup-playoffs

## ADDED Requirements

### Requirement: Lancement d'un bracket de coupe

Le commissaire (ou un administrateur) DOIT pouvoir générer le premier tour
d'un bracket d'élimination directe via `POST /cup/:id/playoffs/start`. La
taille se règle par `Cup.playoffSize` (`0`, `2`, `4` ou `8`) sur
`PATCH /cup/:id`, et n'est plus modifiable une fois le bracket généré
(`409`).

Le lancement DOIT être refusé :

- en `400` si la taille vaut `0` ;
- en `409` si un bracket existe déjà ;
- en `409` si une rencontre de classement est encore ouverte, sauf
  `force: true`, qui les annule — mais seulement APRÈS un seeding réussi,
  pour ne jamais annuler des rencontres au profit d'un bracket qui échoue ;
- en `409` si moins d'équipes sont classées que la taille du bracket.

Toute autre personne DOIT être refusée en `403`.

#### Scenario: Taille non réglée
- WHEN le commissaire lance les play-offs d'une coupe à `playoffSize = 0`
- THEN la réponse DOIT être `400`

#### Scenario: Phase de classement encore ouverte
- WHEN une rencontre de classement est encore ouverte et que `force` est absent
- THEN la réponse DOIT être `409`

#### Scenario: Un tour par slot
- WHEN un bracket de 4 est généré
- THEN la coupe DOIT porter 2 rondes `kind = "playoff"`, de slots `sf1` et
  `sf2`, chacune d'une seule rencontre et de système `bracket`

### Requirement: Têtes de série depuis les quotas de poule

Quand la coupe déclare des poules dont les quotas somment à une valeur non
nulle, les têtes de série DOIVENT être prises dans ces quotas, poule par
poule, plutôt que dans le classement général. La somme des quotas DOIT
valoir la taille du bracket, sinon `409`. Une poule comptant moins d'équipes
que son quota DOIT être refusée en `409`.

Sans poule (ou tous quotas à zéro), les têtes DOIVENT être les premières du
classement général.

#### Scenario: Somme des quotas incohérente
- WHEN les quotas somment à 6 pour un bracket de 4
- THEN le lancement DOIT être refusé en `409`

### Requirement: Création paresseuse des tours suivants

`startCupPlayoffs` ne crée que le PREMIER tour. La rencontre du tour suivant
DOIT naître à la clôture de son tour amont, en portant le vainqueur des deux
côtés (`home === away`) tant que le second qualifié manque, puis être
complétée à l'arrivée de celui-ci. Un match nul ne fait avancer personne.

L'avancement est un effet secondaire NON BLOQUANT de la validation d'un
résultat : son échec ne DOIT jamais faire échouer une validation déjà
committée.

#### Scenario: La finale naît de la première demie jouée
- WHEN la première demi-finale est jouée
- THEN une ronde de slot `final` DOIT exister, marquée comme incomplète

### Requirement: Publication explicite du bracket

Un bracket généré DOIT rester invisible des coachs tant que le commissaire ne
l'a pas publié (`PATCH /cup/:id/playoffs/publish`), pour qu'il puisse
d'abord corriger les têtes de série. Le gating DOIT porter sur les DEUX
lectures : `GET /cup/:id/playoffs` (qui sert `rounds: []`) ET les rondes
`kind = "playoff"` du calendrier `GET /cup/:id`.

`Cup.playoffsPublished` est un booléen à TROIS états : `null` = coupe
antérieure à la colonne, donc VISIBLE (aucun backfill n'est possible,
`prisma/migrations/` étant gitignoré) ; `false` = généré non publié ;
`true` = publié.

Le CLASSEMENT DOIT rester calculé sur toutes les rondes : masquer une ronde
ne change pas les points d'un exempt.

#### Scenario: Bracket caché du coach
- WHEN un bracket non publié existe et qu'un inscrit lit la coupe
- THEN aucune ronde `kind = "playoff"` ne DOIT lui être servie, ni dans le
  bracket ni dans le calendrier

#### Scenario: Bracket visible du commissaire
- WHEN un bracket non publié existe et que le commissaire lit la coupe
- THEN les rondes de bracket DOIVENT lui être servies

### Requirement: Correction des têtes de série

Le commissaire DOIT pouvoir réécrire les têtes de série via
`PATCH /cup/:id/playoffs/seeds` tant qu'aucune rencontre du bracket n'est
lancée ou jouée (`409` sinon). La liste DOIT compter exactement
`playoffSize` équipes (`400`), sans doublon (`400`), toutes inscrites à la
coupe (`400`). Le premier tour est régénéré à partir d'elles.

#### Scenario: Doublon refusé
- WHEN la même équipe est proposée deux fois
- THEN la réponse DOIT être `400`

### Requirement: Une rencontre de bracket se joue comme les autres

Une rencontre `kind = "playoff"` DOIT rester une `CupPairing` ordinaire : sa
feuille de match, son match local, sa validation et son invalidation passent
par les mêmes chemins que la phase de classement, et suivent les mêmes
règles de compétition (aucun PSP, aucune blessure conservée, aucun gain).

#### Scenario: Badge distinct au calendrier
- WHEN le calendrier affiche une ronde de système `bracket`
- THEN elle DOIT être annoncée comme un play-off, et non comme une ronde
  suisse
