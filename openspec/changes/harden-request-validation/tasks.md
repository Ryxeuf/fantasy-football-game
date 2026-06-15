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
      cluster `nfl-fantasy` (schemas inline). *(reste sur denylist)*
- [~] 3.4 Migrer les `req.body as {...}` → type derive du schema
      (`z.infer` / `type XInput`). **12 fichiers migres** (push, pro-league,
      user, admin-digest, email-digest, pro-gazette-comments,
      team-advancement, feedback, league-invitation, matchmaking,
      pro-survivor, auth-privacy). **31 fichiers restants** sur la denylist
      du ratchet (dont league.ts=29 casts, cluster nfl-fantasy, admin-*).
- [x] 3.5 `pnpm typecheck` vert (exit 0) apres chaque lot migre.

## 4. Brique 3 — Garde anti-regression — FAIT
- [x] 4.1 `routes/no-raw-body-cast.test.ts` : ratchet a denylist
      decroissante. Tout fichier de route hors denylist DOIT etre clean
      (zero `req.body as`) ; un fichier denyliste DOIT encore contenir un
      cast (sinon le retirer). Empeche toute nouvelle regression meme avant
      la fin de la migration.
- [x] 4.2 Le ratchet remplace l'assertion "toute route a validate" par un
      invariant plus simple et robuste (le cast brut est interdit hors
      denylist ; les vrais trous de validation ont ete fermes en Brique 1).
- [x] 4.3 Convention documentee dans `CLAUDE.md` (section "Conventions
      backend" → "Validation des entrees").

## 5. Cloture
- [x] 5.1 Suite verte sur le perimetre touche (guard 50, schemas 102,
      validate 24, routes migrees). Typecheck exit 0. *(coverage globale a
      re-mesurer quand la denylist sera vide)*
- [ ] 5.2 Finir la migration des 31 fichiers denylistes (lots suivants,
      ratchet garantit la securite), puis `/opsx:sync` + `/opsx:archive`
      apres merge.
