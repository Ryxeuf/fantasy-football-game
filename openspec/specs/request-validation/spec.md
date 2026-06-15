# request-validation

## Purpose

Convention de validation des entrees HTTP du serveur `apps/server` (corps,
parametres, requete) et garde anti-regression associee. Garantit que toute
entree mutante est validee a la frontiere via Zod, que le type lu par le
handler derive du schema (pas de cast brut), et que la convention ne peut pas
se redegrader silencieusement.

## Requirements

### Requirement: Validation systematique des corps de requete mutants
Toute route HTTP mutante (POST/PUT/PATCH/DELETE) qui lit `req.body` DOIT
passer par le middleware `validate(schema)` (ou un equivalent inferable)
avant d'atteindre son handler. La validation peut etre cablee sur la
route elle-meme ou sur le routeur parent montant un handler extrait.

#### Scenario: Payload invalide rejete
- WHEN un client envoie un corps ne respectant pas le schema de la route
- THEN le serveur DOIT repondre `400` avec `{ error }` listant le(s) champ(s) fautif(s)
- AND le handler metier ne DOIT pas etre execute

#### Scenario: Payload valide normalise
- WHEN un client envoie un corps conforme au schema
- THEN `req.body` DOIT etre remplace par la donnee parsee (coercee) avant le handler

#### Scenario: Route mutante sans validation
- WHEN une route POST/PUT/PATCH/DELETE lit `req.body` sans `validate()` dans sa chaine
- THEN la garde anti-regression DOIT echouer en CI

### Requirement: Type des entrees derive du schema (pas de cast brut)
Un handler NE DOIT PAS recaster `req.body` via un type litteral inline
(`req.body as { ... }`). Le type lu DOIT etre derive du schema Zod de la
route (`z.infer<typeof schema>` ou un alias exporte a cote du schema),
afin que toute divergence schema/handler echoue a la compilation.

#### Scenario: Drift schema/handler detecte a la compilation
- WHEN un champ est retire ou renomme dans un schema
- THEN tout handler qui le destructure DOIT provoquer une erreur `tsc`

#### Scenario: Cast brut interdit
- WHEN un fichier `routes/*.ts` contient le motif `req.body as`
- THEN la garde anti-regression DOIT echouer

### Requirement: Validation des parametres de route
Le serveur DOIT exposer un middleware `validateParams(schema)` (miroir de
`validateQuery`) validant `req.params`. Un `idParamSchema` partage
(non-vide) DOIT etre disponible et applique en priorite aux routes
mutantes parametrees par `:id`.

#### Scenario: Parametre id manquant ou vide
- WHEN une route protegee par `validateParams(idParamSchema)` recoit un `:id` vide
- THEN le serveur DOIT repondre `400` avec `{ error }`
- AND le handler ne DOIT pas etre execute

#### Scenario: Parametre id valide preserve
- WHEN le `:id` est une chaine non-vide
- THEN il DOIT etre transmis au handler sans coercition de type inattendue

### Requirement: Compatibilite ascendante des clients conformes
La generalisation de la validation NE DOIT PAS modifier le contrat
observable pour un client conforme. Les schemas DOIVENT etre des
sur-ensembles fideles de ce que lisent les handlers ; les cles inconnues
DOIVENT etre ignorees (strip par defaut), non rejetees.

#### Scenario: Cle inconnue envoyee par un client
- WHEN un client conforme envoie un champ supplementaire non declare au schema
- THEN la requete DOIT reussir et le champ inconnu DOIT etre ignore (pas de `400`)

#### Scenario: Champ optionnel absent
- WHEN un champ historiquement optionnel est absent du corps
- THEN la requete DOIT reussir avec ce champ a `undefined`
