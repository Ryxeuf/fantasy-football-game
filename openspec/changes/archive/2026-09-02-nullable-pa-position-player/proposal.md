# PA nullable sur Position et TeamPlayer ("pas de passe" = "-")

## Why

En Blood Bowl 2020/3, certaines positions n'ont **aucune** caracteristique
de Passe (PA) : la fiche affiche `-`, pas une valeur. Exemple concret signale :
le **Cingle Gobelin** (Looney) n'a pas de PA, or l'interface affiche `6`.

La cause est structurelle, pas un simple bug d'affichage :

- `Position.pa` et `TeamPlayer.pa` sont des colonnes `Int` **non-nullable**
  ([`prisma/schema.prisma:447`](../../../prisma/schema.prisma#L447),
  [`:551`](../../../prisma/schema.prisma#L551)) → il y a **toujours** une valeur.
- Le formulaire d'admin d'une position met PA en `required`, type `number`,
  `defaultValue={position.pa}`
  ([`positions/[id]/edit/page.tsx:285-292`](../../../apps/web/app/admin/data/positions/[id]/edit/page.tsx#L285))
  → on ne peut **pas** vider le champ depuis l'admin.
- La donnee seed du Cingle stocke `pa: 6` en dur
  ([`data/positions-update.ts:673`](../../../data/positions-update.ts#L673)).

Le **pattern correct existe deja** dans le repo sur le modele `StarPlayer` :
`pa Int?` ([`schema.prisma:593`](../../../prisma/schema.prisma#L593), commente
`null pour -`), formulaire admin **sans `required`** avec
`defaultValue={starPlayer.pa || ""}` + placeholder *« Laissez vide pour - »*
([`star-players/[id]/edit/page.tsx:208-215`](../../../apps/web/app/admin/data/star-players/[id]/edit/page.tsx#L208)),
et affichage `null → "-"`. On **replique ce pattern eprouve** sur `Position`
et `TeamPlayer`.

Pourquoi **aussi `TeamPlayer`** : une `Position` est **copiee** en `TeamPlayer` a la
creation d'une equipe depuis un roster (`team-create-from-roster-handler`,
`team-purchase-handler`, `roster-helpers`, `default-lineup`). Si seul
`Position.pa` devient nullable, copier un `null` dans une colonne `TeamPlayer.pa`
non-nullable casse a l'insertion — et le `-` ne se propagerait jamais aux
equipes reelles. Le `null` doit traverser toute la chaine.

## What Changes

- **Brique 1 — Schema & migration.** `Position.pa` et `TeamPlayer.pa` passent de
  `Int` a `Int?`. Migration Prisma additive (assouplissement de contrainte,
  aucune perte de donnee : les valeurs existantes restent). Mirror sqlite de
  test aligne.
- **Brique 2 — Admin (saisie).** Formulaire d'edition **et** de creation
  d'une position : retirer `required` sur PA, `defaultValue={position.pa ?? ""}`,
  placeholder *« Laissez vide pour - »* (calque exact de StarPlayer). Le
  handler de **duplication** de position propage `pa` tel quel (deja le cas,
  a verifier — [`admin-data.ts:1003`](../../../apps/server/src/routes/admin-data.ts#L1003)).
- **Brique 3 — Validation/API.** Le schema Zod de la position accepte PA
  vide/absent → `null` ; la route ne fait plus `parseInt("")` (qui donne `NaN`)
  mais convertit `"" → null`
  ([`admin-data.schemas.ts`](../../../apps/server/src/schemas/admin-data.schemas.ts),
  [`admin-data.ts`](../../../apps/server/src/routes/admin-data.ts)). La copie
  Position→TeamPlayer passe `pa` (nullable) sans coercition.
- **Brique 4 — Affichage.** Tous les sites qui rendent encore `{position.pa}` /
  `{player.pa}` **bruts** (sans garde) passent en `pa != null ? `${pa}+` : "-"`
  (ou `"—"` selon le composant), en s'alignant sur les sites qui le font deja
  (`pa || "-"`, `pa ?? "-"`). Idem la structured-data SEO qui ecrit `PA ${pa}+`.
- **Brique 5 — Donnees.** Mettre `pa: null` pour le Cingle Gobelin (et tout
  autre poste sans passe identifie) dans la source de positions, puis reseed.
- **Brique 6 — Test de non-regression.** Test verifiant qu'une position a PA
  null s'affiche `-` (pas `6`, pas `NaN+`, pas `null+`) et qu'une equipe creee
  depuis cette position herite d'un `TeamPlayer.pa` null rendu `-`.

## Impact

- **Capability** : nouvelle spec `position-stats` (representation de
  l'absence de PA de bout en bout : DB nullable, saisie admin, API, affichage,
  propagation Position→TeamPlayer).
- **Migration Prisma** : 1 migration (relax `NOT NULL` sur `Position.pa` et
  `TeamPlayer.pa`). Pas de backfill.
- **Code** :
  - Schema : `prisma/schema.prisma` (+ mirror sqlite de test si separe).
  - Admin saisie : `apps/web/app/admin/data/positions/[id]/edit/page.tsx`
    (+ formulaire de creation correspondant).
  - API/validation : `apps/server/src/schemas/admin-data.schemas.ts`,
    `apps/server/src/routes/admin-data.ts`.
  - Copie Position→TeamPlayer : `team-create-from-roster-handler.ts`,
    `team-purchase-handler.ts`, `utils/roster-helpers.ts`, `utils/default-lineup.ts`
    (verifier qu'aucune coercition `Number()` ne force `null → 0`/`NaN`).
  - Affichage (garde `null → "-"`) : `apps/web/app/teams/[slug]/TeamDetailClient.tsx`,
    `apps/web/app/me/teams/[id]/page.tsx`, `app/admin/data/rosters/[id]/page.tsx`,
    `app/admin/users/page.tsx`, `app/admin/teams/page.tsx`,
    `app/teams/position-detail-structured-data.ts`,
    `app/teams/[slug]/[position]/page.tsx`, et tout autre `{*.pa}` brut.
  - Donnees : `data/positions-update.ts` (+ tout fichier source de positions).
- **Aucune rupture de contrat cote consommateurs** : les sites deja gardes
  (`pa || "-"`) restent corrects ; le type API de `pa` devient `number | null`.

## Non-Goals

- **Rendre MA / ST / AG / AV nullable** : hors scope (decision : on se limite a
  PA, seule stat reellement "-" dans la grande majorite des cas BB). Un futur
  change pourra generaliser si besoin (Big Guys / armes secretes exotiques).
- **Migrer la convention d'affichage `+`** (AV+/PA+) ou refondre les boites de
  stats : on ne touche que la gestion de l'absence de valeur.
- **Audit exhaustif des donnees pour corriger toutes les positions BB** : on
  corrige le Cingle Gobelin (cas signale) ; les autres postes sans-PA pourront
  etre nettoyes ensuite via le meme champ admin desormais disponible.
