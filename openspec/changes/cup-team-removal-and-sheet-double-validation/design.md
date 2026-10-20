# Design — retrait d'équipe et double validation (coupes)

## 1. Retrait d'une équipe

### Suppression de l'inscription, pas un statut « retiré »

La ligue retire en douceur (`LeagueParticipant.status = "withdrawn"`). Une
coupe n'a pas de statut d'inscription : ajouter `CupParticipant.withdrawnAt`
obligerait à filtrer la quinzaine de lectures de `cupParticipant` (rondes,
poules, bracket, pronostics, verrou d'équipe, « mes compétitions », rosters,
documents, cycle de vie…) — exactement le piège « gater un contenu, c'est
gater toutes ses lectures ». Le retrait SUPPRIME donc la ligne
`CupParticipant`, comme le faisait déjà `unregister`.

Ce qui rend la suppression sûre en cours de coupe :

- les rencontres référencent l'ÉQUIPE (`CupPairing.homeTeamId`), pas
  l'inscription : l'historique des rondes et l'anti-rematch suisse restent
  intacts ;
- le classement est DÉRIVÉ des `LocalMatch` : `computeCupStandings` crée une
  ligne pour toute équipe d'un match joué, inscrite ou non. Les points de
  l'adversaire sont donc conservés, et l'équipe retirée reste au classement
  avec ses résultats ;
- les générateurs de ronde (suisse, tirage, manuel) partent de la liste des
  INSCRITS : l'équipe n'est plus appariée.

Deux lectures devaient apprendre la différence « au classement » ≠ « inscrite » :

- le **seeding du bracket** sans poules prenait tout le classement — une
  équipe retirée aurait pu être qualifiée. Il est filtré sur les inscrits
  (avec poules, une équipe sans poule tombait déjà hors quota) ;
- l'**écran** : la ligne de classement d'une équipe non inscrite est servie
  `withdrawn: true` (badge « retirée », pas de lien de roster — la fiche
  d'inscription n'existe plus) et sortie des classements par poule (elle n'a
  plus de poule).

### Garde « rencontre ouverte » plutôt qu'un règlement automatique

Retirer une équipe dont la rencontre de la ronde courante est planifiée
laisserait une ronde impossible à terminer. Deux règlements automatiques
étaient possibles — annuler (l'adversaire ne marque rien) ou forfait
(l'adversaire gagne) — et ce choix revient au commissaire, pas au code. Les
deux outils existent déjà (forfait sur la feuille, `POST
/cup/pairings/:id/cancel`) : le retrait est refusé (`409
team_has_open_pairing`) avec un message qui les nomme. Un exempt n'est pas
une rencontre ouverte.

### Qui retire quoi, quand

| Acteur | Coupe ouverte | Inscriptions closes / en cours | Terminée / archivée |
|---|---|---|---|
| Propriétaire | ✅ | ❌ `registrations_closed` (400) | ❌ |
| Commissaire / admin | ✅ | ✅ (hors rencontre ouverte) | ❌ `cup_closed` (409) |
| Admin + `force` | ✅ | ✅ | ✅ (hors rencontre ouverte) |

Un propriétaire qui est aussi le commissaire a les droits du commissaire.
La décision est une fonction PURE (`decideCupTeamRemoval`), testée sans
Prisma ; le service ne fait que réunir les faits et appliquer.

## 2. Double validation des feuilles

### Colonne booléenne avec `@default(false)`

Le piège du dépôt (« un réglage au défaut DIFFÉRENT pour l'existant et le
neuf : jamais de `@default` ») ne s'applique pas : existant et neuf sont
décochés. `db push` pose `false` partout, aucun comportement ne change.

### La règle vit dans le jeu de règles de la compétition

`CompetitionSheetRules` est déjà le seul endroit qui distingue une coupe
d'une ligue, et il est SERVI à l'UI (`competitionRules`). Y ajouter
`doubleValidation` (toujours `false` en ligue) donne à la validation ET à
l'écran la même source, sans relire la coupe.

### Exception forfait

Un forfait se déclare souvent parce qu'un coach ne s'est pas présenté : exiger
sa soumission bloquerait la ronde. Sur un forfait déclaré, seule la
soumission de l'équipe NON forfaitaire est attendue. Le prédicat
(`missingCoachSubmissions`) est pur et partagé dans sa forme par le serveur
(garde) et le web (bouton désactivé, libellé du manque).

### Commissaire qui joue

`viewerRole` vaut `commissioner` pour le créateur même quand il joue la
rencontre, et l'écran masquait alors « Valider ma saisie ». Sous double
validation, son côté ne pourrait jamais être soumis. Les boutons de
soumission suivent désormais le CÔTÉ du viewer (`viewerTeamId`), pas son
rôle — le serveur, lui, acceptait déjà sa soumission.

### Admin

Un admin valide avec les droits du commissaire : la règle de la coupe
s'applique à lui aussi. Le levier en cas de blocage est le réglage lui-même
(modifiable à tout moment) ou le forfait.
