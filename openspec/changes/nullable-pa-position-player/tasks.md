# Tasks — PA nullable sur Position et TeamPlayer

> Perimetre valide : **Position + TeamPlayer** (complet), pattern calque sur
> `StarPlayer` (deja nullable). TDD : test de non-regression d'abord.
>
> **Note d'audit 2026-07-23** : les briques 1 a 5 etaient deja livrees sur
> main (migration `20260616120000_pa_nullable_position_player`, formulaires
> admin, Zod, propagation typee `number | null`, affichages gardes via
> `formatPlusStat` / `?? "-"`). La convention retenue differe legerement du
> plan : la source de donnees positions est `packages/game-engine/src/rosters/
> positions.ts` (pas `data/positions-update.ts`, disparu), avec la sentinelle
> `pa: 0` cote game-engine convertie en `null` en base par le seed
> (`seed.ts`) et le sync (`seeders/sync-rosters.ts`). Reste-a-faire traite le
> 2026-07-23 : donnee Looney season_2 + tests de non-regression.

## 1. Schema & migration
- [x] 1.1 `prisma/schema.prisma` : `Position.pa` `Int` → `Int?` (ligne ~551) ;
      `TeamPlayer.pa` `Int` → `Int?` (ligne ~447). Commentaire `// null pour -`
      comme StarPlayer.
- [x] 1.2 Generer la migration Prisma (relax `NOT NULL` sur `Position.pa` et
      `TeamPlayer.pa`). Verifier qu'elle est additive, aucun backfill.
      → `20260616120000_pa_nullable_position_player`.
- [x] 1.3 Aligner le mirror sqlite de test (`prisma-sqlite` / `TEST_SQLITE=1`)
      si le schema de test est distinct.
- [x] 1.4 `pnpm prisma generate` (dans le conteneur si deps natives) ; `tsc`
      doit refleter `pa: number | null` dans les types generes.

## 2. Saisie admin (calque StarPlayer)
- [x] 2.1 `apps/web/app/admin/data/positions/[id]/edit/page.tsx` (~285-292) :
      retirer `required`, `defaultValue={position.pa ?? ""}`, label `PA`
      (sans `*`), placeholder `"Laissez vide pour -"`.
- [x] 2.2 Formulaire de **creation** de position (meme arborescence admin) :
      meme traitement PA optionnel.
- [x] 2.3 Handler de **duplication** de position
      (`apps/server/src/routes/admin-data.ts`) : `pa: sourcePosition.pa` copie
      tel quel (pas de coercition).

## 3. Validation / API
- [x] 3.1 `apps/server/src/schemas/admin-data.schemas.ts` : champ `pa`
      `z.number().int().optional().nullable()` sur create/update position
      (le client envoie deja `null` pour un champ vide, jamais `NaN`).
- [x] 3.2 `apps/server/src/routes/admin-data.ts` : create/update position
      ecrivent `pa: pa ?? null` (valeur Zod normalisee, `number | null`).
- [x] 3.3 Verifier la serialisation de lecture (`admin-data.ts`) : `pa` peut
      etre `null`, pas de `?? 0`.

## 4. Propagation Position → TeamPlayer (pas de coercition null→0)
- [x] 4.1 `team-create-from-roster-handler.ts` : `pa: t.pa` reste
      `number | null` (pas de `Number()`/`?? 0`).
- [x] 4.2 `team-purchase-handler.ts`, `utils/roster-helpers.ts`,
      `utils/default-lineup.ts`, `seeders/sync-rosters.ts` : `pa` passe brut
      (le sync convertit la sentinelle game-engine `0` → `null`).
- [x] 4.3 Verifier les types intermediaires (`PositionRow`, DTO roster) pour
      que `pa: number | null` traverse sans cast forcant
      (`roster-helpers.ts:73`, `default-lineup.ts:35,48`).

## 5. Affichage — garde `null → "-"` sur les rendus bruts
- [x] 5.1 `apps/web/app/teams/[slug]/TeamDetailClient.tsx` :
      `formatPlusStat(position.pa)` (formateur partage `lib/format-stats.ts`).
- [x] 5.2 `apps/web/app/me/teams/[id]/page.tsx` : `formatPlusStat(p.pa)`.
- [x] 5.3 `apps/web/app/admin/data/rosters/[id]/page.tsx` : chaine
      `ma/st/ag/pa/av` → `${position.pa ?? "-"}`.
- [x] 5.4 `apps/web/app/admin/users/page.tsx`,
      `apps/web/app/admin/teams/page.tsx` : `{player.pa ?? "-"}`.
- [x] 5.5 `apps/web/app/teams/position-detail-structured-data.ts` et
      `app/teams/[slug]/[position]/page.tsx` : `PA ${pa != null ? … : "-"}` ;
      `me/teams/new/page.tsx` : `<Stat>` passe par `formatStatByLabel`.
- [x] 5.6 Sites **deja gardes** (`pa || "-"`, `pa ?? "-"`, etc.) : verifies,
      non touches.
- [x] 5.7 Grep final `\{[a-z]+\.pa\}` sur `apps/web/app` : les seuls rendus
      "bruts" restants sont des compteurs de passes completees (`r.pa`,
      `b.pa` en pro-league/leagues), pas la caracteristique PA.

## 6. Donnees
- [x] 6.1 Cingle Gobelin : `packages/game-engine/src/rosters/positions.ts`
      (`goblin_looney`, season_2) `pa: 6` → `pa: 0` (sentinelle → `null` en
      base). Season_3 (`goblin_cingle`) avait deja `pa: 0`.
- [x] 6.2 Autres sources verifiees : `season3-rosters.ts` /
      `season3-reference-data.ts` utilisent deja `pa: 0` pour les postes
      sans passe (Fanatic, Beer Boar, Renard sylvestre…).
- [x] 6.3 Alignement des bases existantes : porte par le sync idempotent
      (`sync-rosters --write` / bouton admin) au deploiement — le seed initial
      ne rejoue pas sur une base peuplee.

## 7. Tests & cloture
- [x] 7.1 Test unite format/affichage : `formatPlusStat` — `null/undefined →
      "-"`, `2 → "2+"` (`apps/web/app/lib/format-stats.test.ts`).
- [x] 7.2 Test schema API : create/update position sans PA ou `pa: null` →
      `null` (jamais `0`/`NaN`) (`apps/server/src/schemas/zod-schemas.test.ts`).
- [x] 7.3 Tests non-regression chaine (ajoutes le 2026-07-23) :
      - `packages/game-engine/src/rosters/no-pass-positions.test.ts` :
        Looney S2 + Cingle S3 portent la sentinelle `pa: 0` (bug "PA 6+").
      - `apps/server/src/seeders/sync-rosters.test.ts` : le sync ecrit
        `pa: null` en base pour une position sentinelle `0`, et laisse les
        valeurs numeriques telles quelles.
      - `apps/server/src/utils/default-lineup.test.ts` : un `pa: null`
        traverse le lineup sans etre rematerialise en `0`/`NaN`.
- [x] 7.4 Suites vertes sur les perimetres touches : game-engine (rosters),
      server (`default-lineup`, `sync-rosters`, `zod-schemas`), `tsc` exit 0
      (game-engine + server), prettier clean sur le nouveau fichier.
- [ ] 7.5 `/opsx:sync` (delta-spec → specs principales) puis `/opsx:archive`
      apres merge de la PR.
