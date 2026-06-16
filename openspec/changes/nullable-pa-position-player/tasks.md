# Tasks — PA nullable sur Position et TeamPlayer

> Perimetre valide : **Position + TeamPlayer** (complet), pattern calque sur
> `StarPlayer` (deja nullable). TDD : test de non-regression d'abord.

## 1. Schema & migration
- [ ] 1.1 `prisma/schema.prisma` : `Position.pa` `Int` → `Int?` (ligne ~551) ;
      `TeamPlayer.pa` `Int` → `Int?` (ligne ~447). Commentaire `// null pour -`
      comme StarPlayer.
- [ ] 1.2 Generer la migration Prisma (relax `NOT NULL` sur `Position.pa` et
      `TeamPlayer.pa`). Verifier qu'elle est additive, aucun backfill.
- [ ] 1.3 Aligner le mirror sqlite de test (`prisma-sqlite` / `TEST_SQLITE=1`)
      si le schema de test est distinct.
- [ ] 1.4 `pnpm prisma generate` (dans le conteneur si deps natives) ; `tsc`
      doit refleter `pa: number | null` dans les types generes.

## 2. Saisie admin (calque StarPlayer)
- [ ] 2.1 `apps/web/app/admin/data/positions/[id]/edit/page.tsx` (~285-292) :
      retirer `required`, `defaultValue={position.pa ?? ""}`, label `PA`
      (sans `*`), placeholder `"Laissez vide pour -"`.
- [ ] 2.2 Formulaire de **creation** de position (meme arborescence admin) :
      meme traitement PA optionnel.
- [ ] 2.3 Handler de **duplication** de position
      (`apps/server/src/routes/admin-data.ts:1003`) : verifier que `pa` est
      copie tel quel (pas de coercition).

## 3. Validation / API
- [ ] 3.1 `apps/server/src/schemas/admin-data.schemas.ts` (~112-126) : champ
      `pa` optionnel/nullable avec `preprocess` `"" | undefined → null`, sinon
      `Number`. Jamais `NaN`.
- [ ] 3.2 `apps/server/src/routes/admin-data.ts` : remplacer
      `pa: parseInt(formData.get("pa"))` par la valeur Zod normalisee
      (`number | null`) cote create ET update position.
- [ ] 3.3 Verifier la serialisation de lecture (`admin-data.ts:645,928`) :
      `pa` peut etre `null`, pas de `?? 0`.

## 4. Propagation Position → TeamPlayer (pas de coercition null→0)
- [ ] 4.1 `team-create-from-roster-handler.ts:351` : `pa: t.pa` reste
      `number | null` (pas de `Number()`/`?? 0`).
- [ ] 4.2 `team-purchase-handler.ts:187`, `utils/roster-helpers.ts:122,183`,
      `utils/default-lineup.ts:140`, `scripts/sync-rosters.ts:115` : idem,
      passer `pa` brut.
- [ ] 4.3 Verifier les types intermediaires (`PositionRow`, DTO roster) pour
      que `pa: number | null` traverse sans cast forcant.

## 5. Affichage — garde `null → "-"` sur les rendus bruts
- [ ] 5.1 `apps/web/app/teams/[slug]/TeamDetailClient.tsx:436,525` :
      `{position.pa}` → `{position.pa != null ? `${position.pa}+` : "—"}`
      (respecter le glyphe local du composant).
- [ ] 5.2 `apps/web/app/me/teams/[id]/page.tsx:476,524` : `{p.pa}` → garde.
- [ ] 5.3 `apps/web/app/admin/data/rosters/[id]/page.tsx:562` : `{position.pa}`
      dans la chaine `ma/st/ag/pa/av` → `${position.pa ?? "-"}`.
- [ ] 5.4 `apps/web/app/admin/users/page.tsx:1287`,
      `apps/web/app/admin/teams/page.tsx:563` : `{player.pa}` → garde.
- [ ] 5.5 `apps/web/app/teams/position-detail-structured-data.ts:39` et
      `app/teams/[slug]/[position]/page.tsx:181` : `PA ${pa}+` en dur →
      `PA ${pa != null ? `${pa}+` : "-"}` (et idem `me/teams/new/page.tsx:565`
      `<Stat value={p.pa}>` si non garde).
- [ ] 5.6 Sites **deja gardes** (`pa || "-"`, `pa ?? "-"`, `pa ? ... : "—"`,
      `pa !== null && ...`) : verifier qu'ils restent corrects, ne pas toucher.
      (StarPlayerCard, exportPDF, r/[token], comparer, og-image-content, etc.)
- [ ] 5.7 `grep -rn '\{[a-z]*\.pa\}' apps/web/app` final : zero rendu brut
      restant non garde.

## 6. Donnees
- [ ] 6.1 `data/positions-update.ts:673` : Cingle Gobelin `pa: 6` → `pa: null`.
- [ ] 6.2 Verifier les autres sources de positions (seed.ts:353 lit la def) ;
      tout poste sans-PA identifie → `null`.
- [ ] 6.3 Reseed local (dans le conteneur) et controler l'affichage `-` du
      Cingle sur la page roster + le catalogue admin.

## 7. Tests & cloture
- [ ] 7.1 (TDD, ecrit en premier) Test unite format/affichage : `pa=null → "-"`,
      `pa=0 → "-"`, `pa=2 → "2+"` ; jamais `"null+"`/`"NaN+"`.
- [ ] 7.2 Test integration API : create/update position PA vide → `pa: null`
      persiste et relu.
- [ ] 7.3 Test non-regression chaine : equipe creee depuis une position
      `pa=null` → `TeamPlayer.pa === null` → rendu `-`.
- [ ] 7.4 Suites vertes : server + web (`vitest run`), `tsc` exit 0, prettier
      `--check` clean sur les fichiers touches. Coverage 80%+ maintenu.
- [ ] 7.5 `/opsx:sync` (delta-spec → specs principales) puis `/opsx:archive`
      apres merge de la PR.
