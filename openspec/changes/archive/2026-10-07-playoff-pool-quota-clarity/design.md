# Design — quotas de poule

## Context

- `poolQualification` est calculé DEUX fois : dans le handler du bracket de
  ligue (`routes/league.ts`, somme brute) et dans `getCupBracket`
  (`services/cup-playoffs`, somme bornée à 0). Seul le total sort.
- Le moteur de bracket (`services/bracket-seeding`) est déjà PARTAGÉ et pur ;
  `selectSeedsFromPools` y fait la même somme pour refuser un seeding
  incohérent.
- Le quota d'une poule de ligue passe par `updatePool`, qui appelle
  `ensureSeasonEditable` (statut `draft` | `scheduled`) quel que soit le champ
  modifié. `updateCupPool` laisse le quota modifiable tant que la coupe n'est
  ni terminée ni archivée.

## Decisions

### D1 — Le résumé des quotas est une fonction PURE du moteur partagé

`summarizePoolQualification(pools, playoffSize)` rend `{ totalQualified,
playoffSize, consistent, pools }`, poules triées par `order` puis id (l'ordre
du serpentin de `selectSeedsFromPools`), quotas négatifs bornés à 0 comme dans
le seeding. Les deux lectures l'appellent : le panneau ne peut plus annoncer
« cohérent » sur une somme que le seeding calculerait autrement.

Le handler de ligue l'importe depuis `bracket-seeding` et non depuis
`league-playoffs` : ce dernier est mocké en bloc dans les tests de route.

### D2 — Le web formate, sans redéduire

`lib/pool-qualification.formatPoolBreakdown` (pur) rend « Poule A : 4 ·
Poule B : 4 », ou `null` sans détail (API antérieure) — le libellé retombe
alors sur le total seul, toujours annoncé comme un TOTAL. Les poules à 0
restent listées : c'est exactement l'information qui manque quand la somme ne
colle pas.

### D3 — Fenêtre du quota de ligue : jusqu'au bracket, pas jusqu'au démarrage

Un patch qui ne porte QUE `qualifiesForPlayoffs` passe par
`ensureQuotaEditable` : saison existante, non `completed`, sans round
`kind = "playoff"`. Tout autre champ garde `ensureSeasonEditable`.

Pourquoi s'arrêter au bracket, quand la coupe ne s'arrête qu'à la clôture :
une fois le bracket généré, changer un quota ne change plus rien, mais le
badge « N qualifié(s) PO » du classement contredirait le bracket affiché
juste en dessous. Le levier pour corriger un bracket existant est l'éditeur
de participants (`overridePlayoffParticipants`). Le refus porte un code dédié
(`playoffs_started`, 409) et un message qui renvoie vers cet éditeur.

Alternative écartée : rouvrir toute l'édition des poules en cours de saison.
Réaffecter une équipe réécrirait un classement déjà joué (même règle que la
coupe : seule la composition est figée).

### D4 — Le panneau reçoit DEUX drapeaux

`editable` (composition, inchangé) et `quotaEditable` (saison démarrée non
clôturée, aucun round de play-off dans la saison servie au commissaire, qui
voit les rounds non publiés). Le serveur reste l'autorité : un écran périmé
reçoit le 409 et l'affiche, et le champ revient à la valeur du serveur.

Le quota se corrige dans le panneau des poules, mais son total s'affiche dans
le panneau de lancement, qui lit sa propre route : la page lui passe la
signature des quotas (`reloadKey`) pour qu'il se relise quand elle change.

La « fenêtre du bracket » a UNE définition (`bracketRoundsWhere`), partagée
par la garde du quota et celle de la taille du bracket.

## Risks / Trade-offs

- Un commissaire peut modifier un quota pendant la phase de poule et changer
  qui « est qualifié » aux yeux des coachs. C'est déjà le cas de la taille du
  bracket (`PATCH /seasons/:id/config`), ouverte dans la même fenêtre ; les
  deux réglages restent réservés au commissaire.
