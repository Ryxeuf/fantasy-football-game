# Édition d'équipe : verrouiller les équipes engagées, libérer l'édition des brouillons

## Why

La page d'édition d'équipe (`me/teams/[id]/edit`) appliquait les contraintes
Blood Bowl (minimum 11 joueurs, budget) à **chaque** mutation, en permanence et
quel que soit l'état de l'équipe. Deux problèmes en découlaient :

1. **Deadlock d'édition sur un brouillon.** Une équipe à 11 joueurs pile et sans
   budget restant ne pouvait ni ajouter (budget) ni retirer (plancher de 11) un
   joueur : impossible de faire un simple échange. Éditer une équipe fraîche
   était très pénible.
2. **Pas d'anti-triche sur une équipe engagée.** À l'inverse, une équipe déjà
   engagée dans une compétition (match, ligue, coupe) restait modifiable
   librement (seul un match *en cours* bloquait). Modifier la composition ou le
   budget d'une équipe engagée revient à de la triche.

Il n'existait aucune notion de « équipe engagée vs brouillon » : `Team` n'a ni
statut ni verrou.

## What Changes

- **Notion d'« équipe engagée » dérivée** (sans migration) : une équipe est
  engagée dès qu'il existe pour elle une `TeamSelection`, un `LocalMatch` non
  annulé, une `LeagueParticipant` ou une `CupParticipant`.
  (`services/team-lock-status.ts` → `isTeamRosterFrozen`).
- **Équipe engagée = verrouillée (anti-triche).** Les endpoints propriétaire qui
  changent la composition/budget renvoient `403` : ajout/suppression de joueur,
  staff (`PUT /:id/info`), renommage (`PUT /:id`), et la sauvegarde batch
  (`PUT /:id/roster`). La page d'édition **redirige** vers la fiche si l'équipe
  est engagée.
- **Équipe brouillon = édition libre, validée à la sauvegarde.** Sur la page
  d'édition, ajouts/suppressions de joueurs se font **en local** (on peut
  descendre transitoirement sous 11). La validation « comme à la création »
  (bornes de format 11-16 / 7-11, min/max par poste, budget joueurs + staff +
  Star Players ≤ budget initial) est faite **uniquement à l'enregistrement** via
  le nouvel endpoint `PUT /team/:id/roster` (application transactionnelle du
  diff : suppression / mise à jour / création).
- **La progression légitime reste possible pour une équipe engagée** : la
  dépense de trésorerie (achats post-match) est déplacée sur une page dédiée
  `me/teams/[id]/treasury` (le panneau ne vivait que sur la page d'édition), et
  la montée de niveau (PSP) conserve sa page `me/teams/[id]/level-up`. Les
  endpoints `POST /:id/purchase` et l'avancement PSP ne sont **pas** verrouillés.

## Impact

- Specs : nouvelle capability `team-editing`.
- Serveur (`apps/server`) : `services/team-lock-status.ts` (nouveau),
  `routes/team-roster-save-handler.ts` (nouveau, `PUT /:id/roster`),
  `schemas/team.schemas.ts` (`saveRosterSchema`), gardes 403 dans
  `team-player-handlers.ts` et `team-mutation-handlers.ts`, câblage `team.ts`.
- Web (`apps/web`) : refonte `me/teams/[id]/edit/page.tsx` (redirection +
  édition locale + sauvegarde batch + retrait du panneau trésorerie), nouvelle
  page `me/teams/[id]/treasury/page.tsx`, lien depuis la fiche
  `me/teams/[id]/page.tsx`, i18n.
- Aucune migration Prisma (état dérivé des tables existantes).
