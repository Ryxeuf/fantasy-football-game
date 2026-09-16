# 2026-09-16 — Le rattrapage rejoint enfin les compteurs, et Haine (X) se choisit

> Récit de session. Décision versionnée dans
> `openspec/changes/archive/2026-09-16-casualty-count-and-hate-keyword-choice/`.

## Le point de départ

Trois lignes de retour, dont deux disaient la même chose :

1. seules les éliminations qui donnent des PSP doivent compter dans les
   sorties — pour le bonus et pour la catégorie sorties du classement ;
2. au gain du trait Haine (X), le joueur doit pouvoir CHOISIR parmi les
   mots-clés de l'adversaire qui l'a blessé (un zombi est Humain ET
   Mort-Vivant) ;
3. « une ano que je pensais être corrigée » — sur le premier match de la
   ligue, l'appli compte toujours 5 sorties pour 4 + 1 agression.

Le point 3 est le point 1. Et il avait déjà été corrigé cinq jours plus tôt
(`casualties-are-spp-eliminations`, #1024).

## Ce que l'audit a montré

La règle était bonne. `eliminationEarnsSpp` excluait bien l'agression, la
sortie par le public, l'Action Spéciale et l'auto-élimination ; la feuille se
relisait avec, et annonçait 4.

Le classement, lui, annonçait 5 — parce qu'il ne recalcule rien. La ligue
PERSISTE ses compteurs à la validation d'une feuille : `casualtiesFor` /
`casualtiesAgainst` des participants (colonnes Sor+/Sor-), points bonus du
pairing, `TeamPlayer.totalCasualties`, PSP des joueurs. Corriger le calcul ne
touche aucune de ces valeurs.

Le change précédent l'avait anticipé : `league-sheet-casualty-resync` rejoue
exactement les deltas qui dépendent de la qualification d'une sortie,
idempotent, journalisé dans le journal d'équipe. Mais son seul déclencheur
était un script d'opérateur, consigné au backlog « à faire au déploiement » —
qui n'a jamais tourné. Pour un coach, l'anomalie n'avait donc jamais été
corrigée.

**La leçon, consignée dans CLAUDE.md** : un correctif de CALCUL ne corrige pas
un compteur PERSISTÉ. Un changement de règle qui touche une valeur écrite se
livre avec son déclencheur, pas seulement avec son correctif.

## Ce qui a été fait

### Le rattrapage se déclenche seul

Patron des recomputes paresseux du repo (« l'utilisateur paie le recompute en
ouvrant la page »), mais à fenêtre VERSIONNÉE plutôt que temporelle : la
qualification d'une sortie ne change pas toutes les heures, elle a changé une
fois.

`LeagueMatchSheet.casualtyRuleVersion` (nullable, donc lisible sans backfill —
`prisma/migrations/` est gitignoré) dit sous quelle version de la règle la
feuille a été validée. `CASUALTY_RULE_VERSION` vit dans `league-match-summary`,
à côté de la règle elle-même. `healSeasonCasualties`, appelé par
`computeSeasonStandings` (seul entonnoir des classements), balaie les feuilles
périmées de la saison, les rattrape et les marque.

Trois précautions :

- **marquer aussi les refus définitifs** — saison clôturée, snapshot absent,
  rencontre de coupe — sinon ils sont retentés à chaque consultation sans
  jamais bouger. Mais PAS `sheet-not-validated` : une feuille invalidée peut
  être revalidée, et c'est la validation qui posera le marqueur ;
- **best-effort de bout en bout**, `try/catch` au point d'appel compris : la
  garantie « un classement se sert toujours » vit là, pas dans la discipline
  de l'appelé ;
- après le passage, la lecture ne coûte qu'une requête sans résultat.

### Deux compteurs limitrophes

Le « sac de frappe » (éliminations SUBIES) comptait sur le seul type
d'évènement : une agression saisie sans blessure — un coup de pied qui ne sort
personne — classait quand même sa cible. Il lui manquait la condition de base,
une blessure consignée (`isInjurySeverity`, posé à côté de
`eliminationEarnsSpp`). La catégorie reste volontairement PLUS LARGE que les
sorties infligées : un joueur sorti par une agression l'est bel et bien.

Et le libellé du « Meilleur castagneur » annonçait encore l'ancienne règle
(« sur blocage **et autres** »).

### Haine (X) se choisit

Le trait retenait d'office le premier mot-clé éligible de l'auteur de la
blessure. Or un Zombie est *Humain*, *Mort-Vivant* ET *Zombie*, et haïr l'une
ou l'autre lignée ne recouvre pas les mêmes adversaires au reste de la saison.

Même patron que les journaliers et le mort relevé : **le choix est stocké
(`hateChoices`), le candidat est dérivé**. Corriger l'auteur d'une sortie
change les mots-clés proposés, sans backfill ; un choix devenu ineligible
retombe silencieusement sur le premier, et une feuille sans choix se valide
exactement comme avant.

Deux pièges du câblage :

- **une seule dérivation des blessures** (`buildSheetInjuryInputs`) et un seul
  prédicat de déclenchement (`hateInjuryTriggersRoll`), partagés par la lecture
  (qui propose) et la validation (qui jette) — sinon la feuille proposerait un
  choix à un joueur qui ne jettera jamais ;
- **le PATCH fusionne** (`mergeHateChoices`) : chaque coach ne choisit que pour
  son côté (403 sinon), écraser la colonne effacerait le choix d'en face.

## Livraison

PR [#1028](https://github.com/Ryxeuf/fantasy-football-game/pull/1028), six
commits atomiques, mergée sur CI verte et déployée le jour même (`db push` des
deux colonnes joué par `scripts/deploy.sh`). Vérification post-déploiement : la
route `PATCH /leagues/pairings/:id/sheet/hate-choices` répond 401 en prod (elle
existe), là où une route inexistante répond 404.

Au passage, une hypothèse de travail à corriger : le correctif de calcul
(#1024) ÉTAIT bien déployé depuis le 2026-09-11 — le contournement
`workflow_dispatch` d'`auto-merge.yml` fonctionne, malgré l'absence de commit
`chore(release)` dans l'historique. Ce qui manquait n'était pas le
déploiement, c'était le rattrapage des données.
