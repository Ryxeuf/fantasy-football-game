# Durcir et verrouiller la convention de validation des entrees API

## Why

L'audit `/ideas` a flague "~40% des routes serveur non validees (surface
d'injection avant scaling 10k MAU)". L'exploration a **recadre** ce
constat : la securite est en realite **quasi couverte**. `apps/server`
dispose deja d'une convention de validation mature et appliquee :

- middleware `validate` / `validateQuery` (`middleware/validate.ts`) qui
  `safeParse` le payload, renvoie `400 { error }` sur echec et **remplace
  `req.body` par la donnee parsee/coercee** ;
- **25 fichiers** `schemas/*.schemas.ts` (push, league, admin, team,
  auth, cup, commissioner, ...) ;
- la validation est cablee **au niveau du routeur**, y compris quand le
  handler est extrait dans un autre fichier (ex : `handlePurchase` monte
  avec `validate(purchaseSchema)` dans `team.ts:213`).

Les ~123 occurrences de `req.body as {...}` dans `routes/` sont donc
**majoritairement des casts de typage redondants poses DERRIERE un
`validate()` deja en place** — un smell de typage, pas un trou de
securite. (L'exemple phare de l'audit, `pro-league.ts:1099`, est meme un
handler qui lit `req.user`, pas `req.body`.)

Il reste neanmoins trois faiblesses reelles :

1. **Quelques vrais trous** (Bucket A) : poignee de routes mutantes
   lisant `req.body` sans `validate()` (`user.ts:31`, `pro-league.ts:985`
   et `:1242`, + handlers `team-*` a tracer).
2. **Dette de typage** (Bucket B) : ~123 casts `req.body as` qui peuvent
   diverger silencieusement du schema Zod (aucune garantie a la
   compilation que handler et schema s'accordent).
3. **Trou structurel** : `validateParams` n'existe pas — aucun
   `req.params` (`:id`) n'est valide nulle part.

Et surtout : **rien n'empeche la regression.** Un nouveau handler peut
reintroduire un `req.body as` non valide sans qu'aucun garde-fou ne le
detecte.

## What Changes

- **Brique 1 — Fermer les vrais trous (securite).** Auditer
  systematiquement les routes mutantes, creer les schemas Zod manquants
  et brancher `validate()` sur les routes residuelles non validees.
- **Brique 2 — Eliminer la dette de typage + combler `validateParams`.**
  Remplacer les `req.body as {...}` par un type derive du schema
  (`z.infer`) ; extraire en const nommees les `z.object()` inline
  (cluster `nfl-fantasy`) ; ajouter un middleware `validateParams` + un
  `idParamSchema` partage applique aux `:id`.
- **Brique 3 — Verrouiller la convention (anti-regression).** Ajouter un
  test / verif CI qui interdit le cast brut `req.body as` dans `routes/`
  et asserte que toute route lisant un body passe par `validate()`.

L'enchainement est volontaire : **la brique 2 rend la brique 3 triviale
a enforcer** — le pattern legitime devient `z.infer`, donc tout
`req.body as` residuel est une violation greppable.

## Impact

- **Capability** : nouvelle spec `request-validation` (convention de
  validation des entrees + validation des params + garde anti-regression).
- **Code** : `apps/server/src/middleware/validate.ts` (+`validateParams`),
  `apps/server/src/schemas/*` (schemas manquants + extraction inline),
  ~25 fichiers `apps/server/src/routes/*` (migration `z.infer`,
  branchement `validate` residuel), nouveau test de scan.
- **Aucune migration Prisma, aucun changement de contrat d'API** : les
  schemas refletent ce que les handlers lisent deja ; comportement
  identique pour les clients conformes.

## Non-Goals

- Refactor des gros fichiers de routes (`league.ts`, `admin.ts`) — idee
  separee (decoupage modules).
- Validation des **reponses** (output) — uniquement les entrees.
- Reecriture du format d'erreur `{ error }` ou du middleware existant.
- Passage en mode `.strict()` (rejet des cles inconnues) — cf. design,
  ecarte pour compat.
