# Édition d'une équipe par le commissaire : refonte UX + staff et Ligue régionale

## Why

L'éditeur commissaire (`CommissionerTeamEditor`, FR12 puis E13/E14/E15/A64) a
grossi par ajouts successifs jusqu'à 635 lignes dans un seul fichier, et
l'ergonomie n'a jamais été reprise :

- **Tout est déplié en permanence.** Chaque joueur affiche à la fois son
  identité, son ajustement de PSP, son ajout de compétence et son sélecteur de
  caractéristique. Sur un roster de 16 joueurs, c'est une colonne de plus de
  60 champs de saisie : impossible de *lire* un effectif, encore moins d'y
  retrouver le joueur à corriger — il n'y a ni recherche ni filtre.
- **Aucun retour après une action.** Un ajustement réussi ne dit rien ; seule
  une erreur s'affiche. Les champs sont vidés même quand l'appel échoue.
- **Dialogue non accessible.** Pas de `role="dialog"`, pas de fermeture à
  l'Échap, pas de titre lié, en-tête qui défile avec le contenu.
- **Deux capacités manquent.** Le staff (relances, cheerleaders, assistants,
  apothicaire, fans dévoués) n'est éditable que par le coach
  (`PUT /team/:id/info`) — et plus du tout dès que l'équipe est engagée
  (`isTeamRosterFrozen`). La **Ligue régionale** est, elle, immuable après la
  création (`team-regional-league.ts`) : une erreur de choix n'était donc
  rattrapable par *personne*, alors qu'elle conditionne les Star Players
  recrutables et les Coups de Pouce de toute une saison.

Le commissaire est précisément l'acteur censé corriger l'après-coup sans
invalider toute la chaîne. Il lui manquait la moitié des leviers.

## What Changes

- **Réglages d'équipe côté serveur.** Nouveau service
  `commissioner-team-settings.ts` : `getTeamSettings` (staff courant, plafonds
  et coûts résolus du couple roster × format, Ligue régionale courante et
  options ouvertes, Star Players recrutés), `updateTeamStaff` et
  `updateTeamRegionalLeague`. Trois routes commissaire
  (`GET .../settings`, `PATCH .../staff`, `PATCH .../regional-league`).
- **Plafonds réels, pas de constantes en dur.** Les bornes du staff sont celles
  opposées au coach (`RosterStaffConfig`, éditable en admin) : le Sevens
  plafonne à 6 relances, certains rosters n'ont pas droit à l'apothicaire.
- **Débit de trésorerie optionnel.** Le différentiel de coût est calculé et
  annoncé, mais n'est répercuté que si le commissaire le demande
  (`chargeTreasury`) : corriger une saisie ne doit pas refacturer une relance
  déjà payée par le coach.
- **Ligue régionale corrigeable, avec avertissement.** Le changement est
  autorisé pour le commissaire (et lui seul), validé contre les Ligues
  *déclarées* par le roster (`effectiveRegionalRules`, source unique). Les
  Star Players déjà recrutés devenus inéligibles sont **listés, pas retirés** :
  l'arbitrage revient au commissaire.
- **Refonte UX de l'éditeur.** Éclatement en modules sous
  `apps/web/app/leagues/[id]/commissioner/` ; dialogue accessible (Échap, clic
  sur le fond, `aria-modal`, en-tête/pied fixes, plein écran sur mobile) ;
  trois onglets (effectif / staff & trésorerie / Ligue régionale) ; recherche
  et filtre de statut sur l'effectif ; lignes de joueur repliées, dépliables à
  la demande ; les 5 caractéristiques éditables d'un coup ; bandeau de succès
  après chaque action et champs préservés en cas d'échec.

Hors périmètre (volontaire) : pas d'ajout/retrait de joueur au-delà de ce qui
existe déjà (suppression pré-saison, retrait d'un mort) ; pas de recrutement de
Star Player par le commissaire ; aucun changement de schéma Prisma.

## Impact

- **Capability** : `commissioner-team-settings` (nouvelle).
- **Code serveur** : `services/commissioner-team-settings.ts` (nouveau),
  `services/commissioner-team-edit.ts` (export de `ensureTeamInLeague`),
  `schemas/commissioner-team-edit.schemas.ts` (2 schémas), `routes/league.ts`
  (3 routes + handlers + mapping d'erreur).
- **Code web** : `leagues/[id]/commissioner/*` (10 fichiers, remplace
  `CommissionerTeamEditor.tsx`), `leagues/[id]/SeasonParticipants.tsx` (import).
- **Tests** : `commissioner-team-settings.test.ts` (22),
  `commissioner-team-edit.schemas.test.ts` (+7), `roster-helpers.test.ts` (14),
  `CommissionerTeamEditor.test.tsx` (8), `SettingsTabs.test.tsx` (8).
- **Données** : aucune migration. Les colonnes touchées existent déjà
  (`Team.rerolls`… et `Team.regionalLeague`).
