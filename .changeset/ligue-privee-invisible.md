---
"@bb/server": minor
"@bb/web": patch
---

Une ligue privée est invisible pour qui n'en fait pas partie — plus seulement absente de la liste.

**`isPublic = false` n'était qu'un filtre de listing.** Toute lecture d'une ligue par son id — détail, saison avec appariements et participants, classement, poules, classements individuels, récap, bracket, feuille de match, rosters, documents officiels — servait la ligue à n'importe quel compte connaissant ou devinant l'id, et poules, classements et récap n'exigeaient même pas de compte. Le produit annonçait pourtant « Privée » : le formulaire, le JSON-LD non émis, le listing réservé aux membres, les documents réservés aux inscrits.

**Une seule règle, un seul module.** `services/league-access` tranche qui voit une ligue privée : son commissaire, les administrateurs, les coachs inscrits (une équipe dans une de ses saisons) et les coachs invités (invitation en attente). Toutes les lectures par id de `routes/league.ts` passent par lui, ainsi que les documents officiels et l'inscription à une saison par son id. Pour tout autre lecteur, la réponse est un **404 identique à celui d'une ligue inexistante** — jamais un 403, qui en révélerait l'existence — et rien n'est calculé.

**Les lectures ouvertes restent ouvertes pour une ligue publique.** Poules, classements individuels et récap passent derrière `optionalAuthUser` : toujours lisibles sans compte pour une ligue publique, servis aux seuls membres identifiés par leur jeton pour une ligue privée. Le calendrier public des saisons thématiques ne liste plus que les ligues publiques.

**Documents officiels.** Ceux d'une ligue privée suivent la même règle (les coachs invités y accèdent, un tiers obtient 404). Les coupes privées gardent leur 403 : leur visibilité n'a pas été tranchée.

**Côté formulaire**, un indice sous Publique / Privée explique ce qu'implique le choix. Le commentaire du champ Prisma documente la règle ; aucune colonne ni migration.
