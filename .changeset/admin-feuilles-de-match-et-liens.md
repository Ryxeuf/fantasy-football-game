---
"@bb/server": minor
"@bb/web": minor
---

Console admin : feuilles de match et liens croisés entre équipes et compétitions.

**Feuilles de match.** Nouvelle page `/admin/match-sheets` : toutes les feuilles des ligues et des coupes, filtrables par statut, par famille et par recherche (équipe, ligue, coupe), avec des compteurs par statut. Pour chaque feuille : ouverture de l'éditeur standard, validation, invalidation (avec un motif), suppression d'une feuille non validée (remise à zéro de la rencontre), et liens vers les fiches admin des deux équipes et de la compétition. Côté API, `GET /admin/match-sheets` et `DELETE /admin/match-sheets/:id` (409 sur une feuille validée : il faut d'abord l'invalider pour reverser ses effets).

**Droits.** Un administrateur a désormais les droits du commissaire sur toutes les feuilles (saisie, corrections, après-match, validation, invalidation), sauf sur une rencontre où il aligne lui-même une équipe : il n'est pas juge de son propre match. Le rôle est relu en base, comme pour `adminOnly`.

**Liens croisés.** La fiche admin d'une équipe liste ses ligues (une entrée par saison) et ses coupes, chacune liée à sa fiche admin (`competitions` dans `GET /admin/teams/:id`). Les fiches admin d'une ligue (équipes de chaque saison) et d'une coupe (équipes inscrites) renvoient vers la fiche admin de chaque équipe.
