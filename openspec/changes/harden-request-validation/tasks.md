# Tasks — Durcir la validation des entrees API

> **Tranche 1 livree** (audit + Brique 1 securite + infra `validateParams`).
> Tranche 2 a suivre : migration `z.infer` (3.3/3.4), garde (4.x), doc.

## 1. Audit & inventaire (prerequis) — FAIT
- [x] 1.1 Inventaire des routes lisant `req.body`. Resultat : 123 `req.body as`
      dans `routes/`, dont la **grande majorite sont des casts redondants
      derriere un `validate()`** (Bucket B), pas des trous.
- [x] 1.2 Classement Bucket A / Bucket B. **Liste A figee (8 sites / 4 fichiers)** :
      `user.ts:31`, `pro-league.ts:658` (vote MVP), `:760` (prediction),
      `:985` (bet), `:1242` (dedicace HoF), `pro-gazette-comments.ts:88`
      (commentaire) + `:138` (reason de flag), `admin-digest.ts:25` (force).
- [x] 1.3 Montage des handlers extraits trace : `team-*` et `match-*` sont
      montes **avec `validate()`** par leur routeur parent (`team.ts:89`,
      `match.ts:50-52/168/238/260`...). `kofi.ts` valide en inline
      (`kofiWebhookPayloadSchema.safeParse`). => **aucun trou** dans ces
      fichiers.

## 2. Brique 1 — Fermer les vrais trous (securite) — FAIT
- [x] 2.1 `user.ts` : `updateNafSchema` + `validate()` sur `PATCH /me/naf`.
- [x] 2.2 `pro-league.ts` : `submitMvpVoteSchema` (vote MVP),
      `submitFanPredictionSchema` (prediction), `placeBetSchema` (bet) +
      `validate()` sur les 3 routes.
- [x] 2.3 `pro-league.ts` : `dedicateHallOfFameSchema` + `validate()` sur
      `POST /hall-of-fame/:id/dedicate`.
- [x] 2.4 `pro-gazette-comments.ts` : `createCommentSchema` + `validate()`
      sur la creation de commentaire (UGC). `admin-digest.ts` :
      `runDigestSchema` + `validate()`. Le `reason` du flag est laisse
      **volontairement permissif** (le flag doit toujours aboutir, defaut
      "user-report") — params valides, body non rejete.
- [x] 2.5 Tests unitaires des nouveaux schemas (25 cas, `zod-schemas.test.ts`).

## 3. Brique 2 — Typage & validateParams
- [x] 3.1 `validateParams(schema)` ajoute dans `middleware/validate.ts`
      (miroir de `validateQuery`) + tests (`validate.test.ts`).
- [x] 3.2 `idParamSchema` partage (`z.string().min(1)`, `.passthrough()`)
      branche sur les routes `:id` mutantes prioritaires (pro-league
      mvp-vote / predictions / dedicate ; pro-gazette comment / flag /
      delete).
- [ ] 3.3 Extraire en const nommees exportees les `z.object()` inline du
      cluster `nfl-fantasy` (et autres routes a schema inline). *(tranche 2)*
- [ ] 3.4 Migrer les `req.body as {...}` → type derive du schema
      (`z.infer`), fichier par fichier (~123 sites / ~25 fichiers). *(tranche 2)*
- [x] 3.5 `pnpm typecheck` vert sur le perimetre touche (exit 0).
      *(re-verifier apres 3.4)*

## 4. Brique 3 — Garde anti-regression *(tranche 2 — depend de 3.4)*
- [ ] 4.1 Test de scan `routes/no-raw-body-cast.test.ts` : echoue si un
      fichier `routes/*.ts` contient `req.body as`.
- [ ] 4.2 (option) Assertion renforcee : toute route mutante lisant un body
      a `validate(` dans sa chaine.
- [ ] 4.3 Documenter la convention dans `CLAUDE.md` (type derive du schema
      obligatoire, pas de cast brut `req.body as`).

## 5. Cloture
- [x] 5.1 Suite verte sur le perimetre touche : `zod-schemas.test.ts` (102),
      `validate.test.ts` (24), routes pro-league/gazette (60). *(coverage
      globale a re-mesurer apres tranche 2)*
- [ ] 5.2 `/opsx:sync` (delta-spec → specs principales) puis `/opsx:archive`
      apres merge.
