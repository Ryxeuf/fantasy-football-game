# Tasks — Durcir la validation des entrees API

## 1. Audit & inventaire (prerequis)
- [ ] 1.1 Generer l'inventaire complet : pour chaque `routes/*.ts`,
      lister les registrations `router.(post|put|patch|delete)` et
      reperer celles qui lisent `req.body` sans `validate()` dans la
      chaine (y compris handlers extraits montes ailleurs).
- [ ] 1.2 Classer chaque `req.body as` en Bucket A (vrai trou) ou
      Bucket B (cast redondant). Figer la liste A definitive.
- [ ] 1.3 Tracer le montage de `team-mutation-handlers.ts:44/168` et
      `team-share-handlers.ts:24` (valides par un routeur parent ou non ?).

## 2. Brique 1 — Fermer les vrais trous (securite)
- [ ] 2.1 `user.ts` : `updateUserSchema` ({ nafName }) + `validate()` sur
      le `PATCH` (l.27).
- [ ] 2.2 `pro-league.ts:985` : schema pour le body `Partial<{...}>` +
      `validate()`.
- [ ] 2.3 `pro-league.ts:1242` : schema `{ message }` + `validate()`.
- [ ] 2.4 Fermer les trous `team-*` confirmes a l'etape 1.3 (le cas
      echeant).
- [ ] 2.5 Tests unitaires des nouveaux schemas (valide + invalides).

## 3. Brique 2 — Typage & validateParams
- [ ] 3.1 Ajouter `validateParams(schema)` dans `middleware/validate.ts`
      (miroir de `validateQuery`).
- [ ] 3.2 Ajouter un `idParamSchema` partage (`z.string().min(1)`) et le
      brancher sur les routes `:id` mutantes prioritaires.
- [ ] 3.3 Extraire en const nommees exportees les `z.object()` inline du
      cluster `nfl-fantasy` (et toute autre route a schema inline).
- [ ] 3.4 Migrer les `req.body as {...}` → type derive du schema
      (`z.infer`), fichier par fichier (~25 fichiers). Prioriser admin +
      routes exposees.
- [ ] 3.5 `pnpm typecheck` vert (l'inference doit detecter les drifts
      schema/handler).

## 4. Brique 3 — Garde anti-regression
- [ ] 4.1 Test de scan `routes/no-raw-body-cast.test.ts` : echoue si un
      fichier `routes/*.ts` contient `req.body as`.
- [ ] 4.2 (option) Assertion renforcee : toute registration mutante
      lisant un body a `validate(` dans sa chaine.
- [ ] 4.3 Documenter la convention dans `CLAUDE.md` (section
      "Conventions backend") : type derive du schema obligatoire, pas de
      cast brut `req.body as`.

## 5. Cloture
- [ ] 5.1 Suite serveur verte + coverage >= 80% sur le code touche.
- [ ] 5.2 `/opsx:sync` (delta-spec → specs principales) puis
      `/opsx:archive` apres merge.
