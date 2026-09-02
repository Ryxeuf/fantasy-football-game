# Tasks — Réglages d'équipe commissaire + refonte de l'éditeur

> TDD : gardes d'abord (périmètre, plafonds, trésorerie négative, Ligue
> invalide), puis happy paths, puis UI.

## 1. Service de réglages (serveur)
- [x] 1.1 `commissioner-team-edit.ts` : exporter `ensureTeamInLeague`.
- [x] 1.2 `commissioner-team-settings.ts` : `staffCostDelta` et `validateStaff`
      purs (barème et plafonds résolus).
- [x] 1.3 `getTeamSettings` : staff, `RosterStaffConfig`, Ligue courante +
      options via `effectiveRegionalRules`, Star Players recrutés.
- [x] 1.4 `updateTeamStaff` : édition partielle, refus `no_change`,
      plafonds, `chargeTreasury` optionnel, refus si solde négatif, recalcul
      VE/VEA, audit `update_staff`.
- [x] 1.5 `updateTeamRegionalLeague` : refus sous règlement qui neutralise
      l'axe régional, validation contre les options déclarées, `null` accepté,
      audit `update_regional_league`, `orphanedStarPlayers` best-effort.

## 2. Routes + schémas + mapping d'erreur
- [x] 2.1 `updateStaffSchema` (au moins un élément) et
      `updateRegionalLeagueSchema` (slug ou `null`).
- [x] 2.2 `routes/league.ts` : 3 handlers typés par les schémas (aucun
      `req.body as`), 3 routes `authUser` + `validate`.
- [x] 2.3 `domainError` : `CommissionerSettingsError` → 404 / 409 / 400.

## 3. Refonte de l'éditeur (web)
- [x] 3.1 Éclatement en `commissioner/` : `types.ts`, `roster-helpers.ts`
      (pur), `useCommissionerTeam` (chargement + mutations).
- [x] 3.2 Dialogue accessible : `role="dialog"`, `aria-modal`, titre lié,
      Échap, clic sur le fond, en-tête/pied fixes, plein écran mobile.
- [x] 3.3 Onglet effectif : recherche (nom/numéro/poste, insensible aux
      accents), filtre Tous/Actifs/Morts, compteur, lignes repliées.
- [x] 3.4 Panneau joueur : identité, 5 caractéristiques éditables d'un coup,
      raccourcis PSP, compétences groupées par accès primaire/secondaire.
- [x] 3.5 Retour d'action : bandeau de succès, erreur en `role="alert"`,
      champs préservés si l'appel échoue.

## 4. Nouveaux onglets (web)
- [x] 4.1 `StaffTab` : compteurs bornés, coût du différentiel annoncé, case
      « Répercuter sur la trésorerie », panneau trésorerie avec projection.
- [x] 4.2 `RegionalLeagueTab` : cartes de Ligues (libellé, description,
      alignements), option « aucun choix », Stars orphelins après
      enregistrement, message dédié si l'axe est neutralisé.
- [x] 4.3 Repli gracieux quand `/settings` est indisponible.

## 5. Tests
- [x] 5.1 `commissioner-team-settings.test.ts` (22).
- [x] 5.2 `commissioner-team-edit.schemas.test.ts` (+7).
- [x] 5.3 `roster-helpers.test.ts` (14).
- [x] 5.4 `CommissionerTeamEditor.test.tsx` (8) + `SettingsTabs.test.tsx` (8).
