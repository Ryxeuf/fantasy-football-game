# Sprint 0 — Bugfixes critiques & securite

> Prerequis avant tout developpement de features.
> Decouverts lors de l'audit complet du 2026-04-02.

---

## BUG-1 : Dodge rate ne cause jamais de blessure

**Fichier** : `packages/game-engine/src/actions/actions.ts:809`
**Probleme** : `const armorSuccess = true` hardcode — scaffolding de test laisse en production.
**Impact** : Un joueur qui rate un dodge ne subit JAMAIS de blessure (armor roll toujours reussi).
**Fix** : Remplacer par le vrai jet d'armure via `performArmorRoll()`.

## BUG-2 : Math.random() au lieu du RNG seede

**Fichier** : `packages/game-engine/src/core/game-state.ts:658,628`
**Probleme** : `recoverKOPlayers()` et `calculateMatchResult()` (MVP selection) utilisent `Math.random()`.
**Impact** : Resultats non reproductibles, impossible de replay/verifier un match.
**Fix** : Utiliser le RNG seede du gameState (`state.rng` ou equivalent).

## BUG-3 : Crowd push (surf) silencieusement ignore

**Fichier** : `packages/game-engine/src/mechanics/blocking.ts:669`
**Probleme** : Quand un joueur est pousse hors du terrain, le code log "ne peut pas etre repousse" et ne fait rien. `handleInjuryByCrowd()` existe dans `injury.ts:229` mais n'est jamais appelee.
**Impact** : Impossible de surfer un joueur — regle fondamentale de Blood Bowl.
**Fix** : Detecter quand la destination du push est hors-limites, appeler `handleInjuryByCrowd()`.

## SEC-1 : /admin/data/* sans authentification

**Fichier** : `apps/server/src/routes/admin-data.ts`
**Probleme** : Contrairement a `admin.ts` qui appelle `router.use(authUser, adminOnly)`, `admin-data.ts` ne met aucun middleware auth. Tous les endpoints CRUD skills/rosters/positions sont publics.
**Impact** : N'importe qui peut modifier les donnees de reference du jeu.
**Fix** : Ajouter `router.use(authUser, adminOnly)` en haut de `admin-data.ts`.

## SEC-2 : Socket room join sans verification participant

**Fichier** : `apps/server/src/game-rooms.ts`
**Probleme** : N'importe quel utilisateur authentifie peut rejoindre n'importe quelle room de match en envoyant un `matchId` connu. Pas de verification que l'utilisateur est bien participant du match.
**Impact** : Espionnage de l'etat de jeu d'un match auquel on ne participe pas.
**Fix** : Verifier en DB que `socket.data.user.id` est bien un participant du match avant `socket.join()`.
