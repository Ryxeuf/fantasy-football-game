# Tasks — Édition d'équipe verrouillée si engagée / libre si brouillon

> TDD : détection d'engagement + gardes 403 d'abord, puis sauvegarde batch, puis
> refonte UI. Calque sur `specs/team-editing/spec.md`.

## 1. Détection d'engagement (serveur)
- [x] 1.1 `services/team-lock-status.ts` : `isTeamRosterFrozen(teamId)` (true si
      `TeamSelection` OU `LocalMatch` non annulé OU `LeagueParticipant` OU
      `CupParticipant`) + constante `TEAM_ENGAGED_MESSAGE`.
- [x] 1.2 `services/team-lock-status.test.ts` : brouillon → false ; chacune des 4
      sources d'engagement → true ; filtre `LocalMatch` exclut `cancelled`.

## 2. Verrous 403 sur les endpoints propriétaire (serveur)
- [x] 2.1 `team-player-handlers.ts` : garde 403 `TEAM_ENGAGED_MESSAGE` dans
      `handleAddTeamPlayer` et `handleDeleteTeamPlayer` (suppression du plancher
      de 11 : un brouillon peut descendre sous 11).
- [x] 2.2 `team-mutation-handlers.ts` : garde 403 dans `handlePutTeamInfo` (staff)
      et `handleUpdateTeam` (renommage).
- [x] 2.3 `available-positions` expose `frozen` pour piloter la redirection UI.
- [x] 2.4 Laisser `POST /:id/purchase` (trésorerie) et l'avancement PSP NON gardés.
- [x] 2.5 `team.test.ts` : delete engagée → 403 ; brouillon sous 11 → 200.

## 3. Sauvegarde batch du roster (serveur)
- [x] 3.1 `schemas/team.schemas.ts` : `saveRosterSchema` + `SaveRosterBody`
      (`{ name?, players: [{ id?, position, name, number }] }`, 1..16).
- [x] 3.2 `routes/team-roster-save-handler.ts` : `handleSaveRoster` — garde 403
      engagée ; validations (postes valides, min/max par poste, bornes de format,
      numéros uniques, budget joueurs+staff+stars ≤ budget initial) ; diff
      transactionnel (delete/update/create) ; recalcul TV.
- [x] 3.3 `team.ts` : route `PUT /:id/roster` (auth + `validate(saveRosterSchema)`)
      + re-export du handler.
- [x] 3.4 `team-roster-save-handler.test.ts` : 404 / 403 engagée / < min format /
      numéros dupliqués / budget dépassé / id étranger / diff succès.

## 4. Refonte page d'édition (web)
- [x] 4.1 Redirection vers la fiche si `frozen` (effet + garde de rendu).
- [x] 4.2 Ajout/suppression de joueur en local (ids `tmp_…`), descente sous 11
      permise, plus de garde budget côté client.
- [x] 4.3 `handleSave` → `PUT /:id/roster` (id omis pour les `tmp_`), erreurs
      serveur affichées, succès → redirection fiche.
- [x] 4.4 Comptage par poste local pour le filtre d'ajout ; cap 16 local.
- [x] 4.5 Retrait du `TreasuryPurchasePanel` + lien vers `/treasury` ; texte d'aide
      mis à jour.

## 5. Page trésorerie dédiée (web)
- [x] 5.1 `me/teams/[id]/treasury/page.tsx` : `TreasuryPurchasePanel` avec le même
      wiring (team + available-positions + refetch), accessible même engagée.
- [x] 5.2 Lien « Trésorerie » depuis la fiche `me/teams/[id]/page.tsx` + i18n.

## 6. Vérifications
- [x] 6.1 `pnpm --filter @bb/server typecheck` + suite serveur (hors échecs kofi
      pré-existants).
- [x] 6.2 `pnpm --filter web tsc --noEmit` : aucune erreur sur les fichiers touchés.
