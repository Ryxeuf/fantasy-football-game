# Suppression d'équipes/joueurs par le commissaire avant le démarrage

## Why

Un commissaire de ligue n'avait aucun moyen de **corriger une erreur
d'inscription** avant le coup d'envoi : mauvaise équipe inscrite sur une
saison, doublon, ou joueur en trop sur un roster saisi à la main. Les seuls
leviers existants étaient :

- le **retrait** d'équipe côté coach (`withdrawParticipant`,
  [`services/league.ts:1092`](../../../apps/server/src/services/league.ts#L1092)) :
  réservé au propriétaire de l'équipe, et c'est un *soft* withdraw
  (`status = "withdrawn"`) qui laisse le participant en base — pas une
  suppression ;
- l'**édition ex-post** du commissaire (`commissioner-team-edit`, FR12) :
  ajuste SPP / compétences / caractéristiques / trésorerie, mais ne sait pas
  retirer une équipe ni un joueur.

Résultat : pour défaire une inscription erronée en pré-saison, le commissaire
devait passer par l'admin global ou bricoler. Le besoin métier est simple :
**pouvoir supprimer une équipe ou un joueur tant que rien n'a été joué.**

## What Changes

- **Suppression d'équipe (commissaire).** Nouvelle action qui retire
  *définitivement* le `LeagueParticipant` d'une saison (hard delete, pas un
  withdraw). Autorisée uniquement quand la saison est `draft`/`scheduled` (avant
  démarrage) **et** que l'équipe n'a participé à aucun match. Une fois la saison
  lancée, on renvoie vers la procédure de forfait (`league-forfeit`) qui préserve
  l'historique des pairings.
- **Suppression de joueur (commissaire).** Retire *définitivement* un
  `TeamPlayer` du roster, à la condition que l'équipe n'ait participé à aucun
  match dans la ligue. Aucune FK entrante ne référence `TeamPlayer`, et la garde
  « aucun match joué » garantit l'absence de stats à préserver.
- **Garde « a participé à un match ».** Un participant est considéré comme ayant
  joué dès qu'un pairing le concernant est *engagé* : `in_progress`, `played`,
  `forfeit_home` ou `forfeit_away` (un pairing `scheduled`/`cancelled` ne compte
  pas). La garde est scopée à la ligue.
- **Autorisation + audit.** Réservé au commissaire de la ligue
  (`ensureLeagueCommissioner`). Chaque suppression est journalisée dans
  `AuditLog` (réutilise `appendAudit` de `commissioner-team-edit`).
- **UI commissaire.** Bouton « Supprimer » (confirmation inline) sur chaque
  équipe de la liste des participants, visible seulement avant le démarrage ;
  bouton « Supprimer » par joueur dans l'éditeur d'équipe, sous la même garde
  pré-saison.

Hors périmètre (volontaire) : pas de suppression après démarrage (forfait
dédié) ; pas de garde de roster minimal lors de la suppression d'un joueur (le
commissaire est de confiance et corrige sciemment) ; aucun changement de schéma
Prisma.

## Impact

- **Capability** : `commissioner-team-removal` (nouvelle — formalise les gardes
  pré-saison de suppression d'équipe/joueur par le commissaire).
- **Code serveur** : nouveau `services/commissioner-team-removal.ts` ;
  `commissioner-team-edit.ts` (export de `appendAudit`) ;
  `schemas/commissioner-team-edit.schemas.ts` (schéma motif) ;
  `routes/league.ts` (2 routes `DELETE`, handlers, mapping d'erreur).
- **Code web** : `SeasonParticipants.tsx`, `CommissionerTeamEditor.tsx`,
  `leagues/[id]/page.tsx`.
- **Tests** : `commissioner-team-removal.test.ts` (13) ;
  `SeasonParticipants.test.tsx` (5).
- **Données** : aucune migration. Hard delete d'un participant non engagé et
  d'un joueur pré-saison — pas d'historique impacté.
