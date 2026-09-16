# league-standings

## ADDED Requirements

### Requirement: Les sorties persistées se rattrapent d'elles-mêmes

Une feuille de match de LIGUE validée avant la règle « une sortie est une
élimination qui rapporte des PSP » a persisté des compteurs faux. La lecture
du classement d'une saison DOIT rattraper ces feuilles, sans intervention
d'opérateur, par la resynchronisation existante (compteurs des deux
participants, `TeamPlayer.totalCasualties` et PSP, points bonus du pairing,
snapshot du match) — idempotente et journalisée.

Chaque feuille rattrapée, ou dont la resynchronisation est refusée par
conception (saison clôturée, snapshot absent, rencontre de coupe), DOIT être
marquée pour ne plus être revisitée. Une feuille validée sous la règle
courante DOIT porter le marqueur dès sa validation.

Le rattrapage est BEST-EFFORT : son échec NE DOIT PAS empêcher de servir le
classement.

#### Scenario: Classement d'une saison portant une feuille antérieure
- WHEN le classement d'une saison est lu et qu'une de ses feuilles validées ne porte pas le marqueur
- THEN ses sorties DOIVENT être resynchronisées avant le calcul du classement, et la feuille marquée

#### Scenario: Deuxième lecture
- WHEN le même classement est lu à nouveau
- THEN aucune resynchronisation NE DOIT être tentée

#### Scenario: Rattrapage en échec
- WHEN la resynchronisation lève
- THEN le classement DOIT être servi malgré tout

## MODIFIED Requirements

### Requirement: Classements individuels — éliminations subies et infligées

Le classement « Sac de frappe » compte les éliminations SUBIES par un joueur.
Il DOIT ne compter qu'un évènement portant une blessure effective : une
agression ou un blocage sans blessure consignée n'élimine personne. Un
atterrissage de coéquipier sur un adversaire (Lancer de Coéquipier) qui le
blesse DOIT y compter.

Le classement « Meilleur castagneur » ne compte que les éliminations qui
RAPPORTENT DES PSP ; son libellé DOIT décrire cette règle.

#### Scenario: Agression sans blessure
- WHEN une agression est consignée sans blessure
- THEN sa cible NE DOIT PAS gagner une élimination subie

#### Scenario: Atterrissage blessant
- WHEN un joueur lancé atterrit sur un adversaire et le blesse
- THEN l'adversaire DOIT gagner une élimination subie
