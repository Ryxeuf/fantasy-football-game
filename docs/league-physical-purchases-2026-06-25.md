# Ligue physique — Achats = mutation de roster (réversible) (2026-06-25)

> Suite de [`league-physical-rework-2026-06-25.md`](./league-physical-rework-2026-06-25.md),
> chantier 1 du « reste à faire ». Les achats post-match d'une feuille de
> match (`LeagueMatchSheet.purchasesHome/Away`) **créent désormais réellement**
> l'élément acheté sur le roster, de façon **réversible**.

## Constat de départ

Le débit de trésorerie des achats était déjà appliqué (champ `treasuryDebit`
agrégé dans `buildOfflineInputFromSummary`), mais l'élément acheté
(joueur / relance / staff) **n'était jamais matérialisé** sur l'équipe. Cf.
« Reste à faire » de la refonte.

## Ce qui a été fait

### 1. Service dédié `league-offline-purchases.ts`

Module pur-orchestration qui réutilise la logique existante (aucune
réinvention) :

- `getRosterFromDb` → positions/stats d'un joueur recruté (comme
  `team-purchase-handler`) ;
- `resolveStaffConfigBySlug` → plafonds relances / staff / apothicaire ;
- `updateTeamValues` → recalcul TV après mutation.

Fonctions exposées :

- `parsePurchases(raw)` — parse tolérant array PG / string sqlite, conserve
  les champs optionnels `position` / `staff` / `number`.
- `applyOfflinePurchasesForTeam(teamId, purchases)` — matérialise les achats
  d'une équipe et retourne la **trace exacte** des mutations
  (`OfflineRosterMutationSide`). **Aucun débit** (déjà porté par
  `treasuryDebit`, pas de double-débit).
  - `kind:'reroll'` → `Team.rerolls++` (plafonné `maxRerolls`).
  - `kind:'staff'` → compteur correspondant (`assistants` / `cheerleaders` /
    `apothecary` / `dedicatedFans`), résolu via `staff` explicite sinon
    heuristique sur le libellé. Apothicaire ajouté seulement si autorisé et
    absent.
  - `kind:'player'` → `TeamPlayer.create` (numéro libre 1-16, stats issues de
    la position du roster). Position résolue par slug explicite sinon par
    **match unique de coût** (`cost*1000`). Plafonné à 16 joueurs vivants.
  - `kind:'other'` → aucune mutation roster (seul le débit treasury s'applique).
- `offlinePurchasesConsumed(mutations)` — garde-fou réversion : `true` si un
  joueur acheté a déjà joué / gagné du SPP / progressé / est mort.
- `buildPurchaseReverseOps(teamId, side)` — ops Prisma de réversion
  (suppression des joueurs créés + décrément des compteurs des deltas exacts).

### 2. Snapshot réversible étendu

`OfflineResultSnapshot` gagne :

- `input.purchasesHome/Away` (la saisie brute, traçabilité) ;
- `rosterMutations` (optionnel, retro-compat) — la trace exacte renseignée
  **après** application (ids des `TeamPlayer` créés + deltas de compteurs).

`recordOfflineLeagueResult` applique les achats après l'économie/blessures,
puis **met à jour** `Match.offlineResultInput` avec `rosterMutations` (uniquement
si une mutation a eu lieu).

### 3. Réversion exacte (`league-offline-edit.ts`)

`reverseOfflineLeagueResult` :

- nouveau garde-fou `purchase-consumed` (refus si joueur acheté consommé) ;
- ajoute les ops de réversion des achats à la transaction (suppression des
  joueurs créés + décrément exact des compteurs) ;
- recalcule la TV des équipes mutées **après** la transaction.

### 4. UI (feuille de match)

`PurchaseEditor` (section ACHATS du `PostMatchPanel`) :

- `kind:'player'` → sélecteur de **poste** (suggestions = postes déjà fieldés
  par l'équipe ; « auto » ⇒ résolution serveur par coût) ;
- `kind:'staff'` → sélecteur de **sous-type** (assistant / pom-pom /
  apothicaire / fan dévoué).

`page.tsx` conserve `position` / `staff` au parse et au save. Zod
`postMatchSchema` accepte ces champs optionnels.

## Tests

- `league-offline-purchases.test.ts` (16) — parse, application (joueur par
  slug / par coût / ambigu, relances/staff plafonnés, apothicaire, cap 16),
  garde-fou consommé, ops de réversion.
- `league-offline-result.test.ts` (+2) — matérialisation + persistance de
  `rosterMutations` dans le snapshot ; no-op si aucune mutation.
- `league-offline-edit.test.ts` (+2) — réversion (suppression + décrément) ;
  refus `purchase-consumed`.

## Invariants / choix

- **Pas de double-débit** : la trésorerie est débitée via `treasuryDebit` ;
  les achats ne font QUE matérialiser l'élément.
- **Réversion exacte** : on ne décrémente/supprime que ce qui a été
  réellement appliqué (deltas mémorisés, plafonds inclus).
- **Garde-fou** : un joueur acheté ayant joué/progressé bloque la réversion
  (même esprit que `advancement-consumed`).
