# Design — Durcir la validation des entrees API

## Contexte

`apps/server` (Express + Prisma) suit deja la convention "route =
handler + Zod schema + middleware". `validate(schema)` fait
`schema.safeParse(req.body)`, renvoie `400 { error }` formate sur echec
et **remplace `req.body` par la donnee parsee/coercee**. `validateQuery`
fait l'equivalent sur `req.query`. 25 fichiers de schemas existent dans
`src/schemas/`.

Le probleme n'est donc pas l'absence d'outillage mais : (a) une poignee
de routes qui ne l'utilisent pas, (b) une dette de typage massive
(`req.body as`), (c) l'absence de `validateParams`, (d) l'absence de
garde anti-regression.

## Le modele a deux seaux (cle du recadrage)

Un `req.body as {...}` recouvre deux realites tres differentes :

```
 BUCKET B (majorite) — cast redondant            [smell typage]
   router.post("/x", authUser, validate(xSchema), handler)
                                  └── valide OK
   handler: const { a } = req.body as { a: string }   ← cast inutile
   => PAS un trou. Risque = drift schema/handler.

 BUCKET A (rare) — vrai trou                      [securite]
   router.patch("/y", authUser, handler)   ← pas de validate
   handler: const { b } = req.body as { b: string }
   => entree non validee. C'est CE qu'il faut fermer.
```

Preuves verifiees :
- Bucket B : `push.ts:43` (`validate(pushSubscribeSchema)`) puis
  `push.ts:45` (`req.body as {...}`). Idem `team.ts:213` qui monte le
  handler extrait `handlePurchase` avec `validate(purchaseSchema)`.
- Bucket A : `user.ts:27-31` (`router.patch(...)` sans validate,
  `req.body as { nafName }`).

## Decisions

### D1 — Bucket A : un schema dedie par route, pas un patch inline
Chaque trou se ferme en creant (ou completant) le `*.schemas.ts` du
domaine puis en inserant `validate(schema)` dans la chaine de
middleware. Le schema est **derive du cast existant** (`req.body as {T}`
documente deja la forme lue par le handler) pour garantir
l'iso-comportement.

### D2 — Bucket B : type derive du schema, pas de cast litteral
Remplacer `const { a } = req.body as { a: string }` par un type **issu du
schema** : `req.body as z.infer<typeof xSchema>` (ou un
`export type XBody = z.infer<typeof xSchema>` pose a cote du schema). Le
type devient monosource : si le schema evolue, le handler casse a la
compilation en cas de divergence. C'est la valeur reelle de la brique 2
(au-dela du nettoyage cosmetique).

Pour le cluster `nfl-fantasy`, les `z.object()` sont definis **inline**
dans le fichier de route : il faut d'abord les **extraire en const
nommees exportees** pour pouvoir les inferer (et tendre vers la
convention `schemas/*.schemas.ts`).

### D3 — `validateParams` : nouveau middleware miroir
Ajouter dans `middleware/validate.ts` :
- `validateParams(schema)` calque sur `validateQuery` (safeParse
  `req.params`, remplace par la donnee parsee, `400 { error }` sur echec) ;
- un `idParamSchema = z.object({ id: z.string().min(1) })` partage,
  **permissif** (non-vide) plutot que strict (cuid/uuid), pour ne pas
  casser des liens/ids existants. Branche en priorite sur les routes
  `:id` mutantes.

### D4 — Garde anti-regression : invariant greppable, pas d'ESLint custom
Plutot qu'une regle ESLint custom (couteuse a ecrire/maintenir), un
**test vitest** scanne `src/routes/**` et echoue si :
- un fichier contient le motif `req.body as` (cast brut interdit une fois
  la brique 2 faite) ;
- (option renforcee) une registration `router.(post|put|patch|delete)`
  lisant un body n'a pas de `validate(` dans sa chaine.

Le test vit dans le repo (ex : `routes/no-raw-body-cast.test.ts`) et
tourne en CI sans interaction. Il documente AUSSI la convention par
l'exemple.

## Risques & mitigations

| Risque | Detail | Mitigation |
|--------|--------|------------|
| Casser un client conforme | Schema trop strict (champ oublie) → handler recoit `undefined` | Deriver le schema du cast existant ; champs douteux en `.optional()` ; `z.object` strip les cles inconnues par defaut (ne PAS mettre `.strict()`) ; tester avec un payload reel web/mobile |
| Coercion inattendue | `validate*` remplace la valeur par la donnee parsee ; `validateParams/Query` peuvent coercer string→number | Garder params/query en `string` sauf besoin explicite ; pas de `z.coerce` par defaut |
| Faux sens "PG/sqlite JSON" | La tolerance PG/sqlite concerne la **lecture** du JSON persiste, **orthogonale** a la validation d'entree | Pour un champ JSON en body, le schema valide la **structure entrante** ; ne pas confondre avec le parsing DB |
| Volume (brique 2) | ~123 sites / ~25 fichiers | Migration mecanique fichier par fichier, sequencable ; la garde D4 empeche la re-derive |
| Faux positifs de la garde | GET handlers lisant `req.user`, commentaires | Le scan ne cible que `req.body as` (pas `req.user`) ; option renforcee limitee aux verbes mutants |

## Alternatives ecartees

- **Tout passer en `.strict()`** (rejeter les cles inconnues) : capte
  plus d'anomalies mais risque de casser des clients envoyant des champs
  extra/telemetrie. Ecarte au profit du strip par defaut (compat).
- **Regle ESLint custom** pour la garde : cout/maintenance superieur a un
  test de scan greppable, pour un benefice equivalent.
- **Shadow / log-only mode** (valider sans rejeter, logger les
  divergences) : pertinent a grande echelle, surdimensionne pour ~3-6
  vrais trous derives de casts deja typés.

## Plan de test

- **Unit** : un test par nouveau schema (cas valide + cas invalides),
  selon le pattern `*.schemas.test.ts` existant.
- **Regression** : le test de scan D4 (`req.body as` interdit dans
  `routes/`).
- **Non-regression fonctionnelle** : suite serveur existante verte (les
  schemas refletent le comportement actuel) + `pnpm typecheck` vert
  (l'inference detecte les drifts schema/handler).
