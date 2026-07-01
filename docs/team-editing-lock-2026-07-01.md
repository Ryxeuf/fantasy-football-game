# Édition d'équipe : verrouillage si engagée, édition libre si brouillon (2026-07-01)

Change OpenSpec : `openspec/changes/restrict-team-editing-to-drafts` (capability
`team-editing`).

## Problème

La page d'édition (`me/teams/[id]/edit`) appliquait les contraintes BB (min 11,
budget) à chaque mutation, en permanence :

- **Brouillon bloqué** : à 11 joueurs pile + budget épuisé, on ne pouvait ni
  ajouter (budget) ni retirer (plancher 11) → échange de joueur impossible.
- **Pas d'anti-triche** : une équipe déjà engagée (match/ligue/coupe) restait
  librement modifiable (seul un match *en cours* bloquait).

`Team` n'a aucun champ de cycle de vie.

## Règle retenue

Une équipe est **engagée** dès qu'il existe pour elle une `TeamSelection`, un
`LocalMatch` non `cancelled`, une `LeagueParticipant` ou une `CupParticipant`
(dérivé, **sans migration**).

- **Engagée → verrouillée** (anti-triche) : composition/budget non modifiables.
- **Brouillon → édition libre**, validée **à la sauvegarde** (comme à la
  création) : on peut descendre sous 11, remanier, puis on valide tout d'un coup.
- **Progression légitime toujours possible** même engagée : dépense de trésorerie
  et montée de niveau (PSP), via des pages dédiées.

## Implémentation

### Serveur (`apps/server`)
- `services/team-lock-status.ts` — `isTeamRosterFrozen(teamId)` (4 `findFirst`
  parallèles) + `TEAM_ENGAGED_MESSAGE`.
- Verrou **403** (engagée) dans :
  - `routes/team-player-handlers.ts` : `handleAddTeamPlayer`,
    `handleDeleteTeamPlayer` (le plancher de 11 est supprimé : un brouillon peut
    descendre sous 11) ; `available-positions` expose `frozen`.
  - `routes/team-mutation-handlers.ts` : `handlePutTeamInfo` (staff),
    `handleUpdateTeam` (renommage).
- **Nouveau** `PUT /team/:id/roster` (`routes/team-roster-save-handler.ts` +
  `schemas/team.schemas.ts::saveRosterSchema`) : sauvegarde batch de l'état
  cible complet. Valide comme le builder (bornes de format via
  `getFormatConstraints`, min/max par poste, numéros uniques, budget
  joueurs + staff + Star Players ≤ `initialBudget`) puis applique le diff
  (suppression / mise à jour nom-numéro / création avec stats du poste) en
  transaction, avant recalcul TV.
- **Non verrouillés volontairement** : `POST /:id/purchase` (trésorerie) et
  l'avancement PSP (`PUT /:id/players/:pid/skills`, routes `team-advancement.ts`)
  — progression de jeu légitime. Les endpoints **commissaire**
  (`/leagues/:id/teams/:id/…`) sont distincts et non concernés.

### Web (`apps/web`)
- `me/teams/[id]/edit/page.tsx` : redirection vers la fiche si `frozen` ;
  ajout/suppression de joueurs **en local** (ids temporaires `tmp_…`, descente
  sous 11 permise, plus de garde budget côté client) ; `handleSave` →
  `PUT /:id/roster` (id omis pour les `tmp_`, erreurs serveur affichées) ;
  comptage par poste local ; retrait du `TreasuryPurchasePanel` + lien vers la
  page trésorerie ; budget affiché en avertissement non bloquant.
- `me/teams/[id]/treasury/page.tsx` (**nouvelle**) : dépense de trésorerie
  (accessible même engagée) ; lien depuis la fiche `me/teams/[id]/page.tsx`.
- PSP self-service : `me/teams/[id]/level-up` (inchangée).

## Tests
- `services/team-lock-status.test.ts` (5), `routes/team-roster-save-handler.test.ts`
  (7), et mise à jour de `routes/team.test.ts` (delete engagée → 403 ; brouillon
  sous 11 → 200). Suite serveur verte (hors échecs `kofi` pré-existants).
- Typecheck serveur OK ; typecheck web sans erreur sur les fichiers touchés.

## Limites / suites
- **Star Players** (hire/fire) : endpoints non gardés par l'engagement (aucune UI
  sur la page d'édition) — trou anti-triche théorique.
- Le staff (`PUT /:id/info`) reste édité en immédiat pour un brouillon ; son coût
  est pris en compte à la sauvegarde du roster.
- Rejoindre une ligue/coupe ne valide toujours pas 11-16/budget (pré-existant).

## Déploiement
Aucune migration Prisma → simple redéploiement.
