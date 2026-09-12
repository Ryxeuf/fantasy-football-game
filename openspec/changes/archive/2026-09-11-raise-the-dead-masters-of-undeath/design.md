# Design — Relever le Mort

## Un joueur synthétique de plus, pas une nouvelle mécanique

La feuille connaît déjà deux familles de joueurs qui jouent sans exister au
roster : les journaliers et les Star Players engagés. Le mort relevé est la
troisième, et il emprunte à la première presque tout : id déterministe par
côté (`raised-<side>-1`), dérivation à la lecture, exclusion de la
persistance post-match (`isSyntheticSheetPlayerId`), côté lu dans l'id pour
les PSP de Joueur du Match (`syntheticSheetPlayerSide`), évolution vérifiée et
tirée par la feuille (`reviewJourneymanAdvancements`,
`rollJourneymanRandomPrimary`), recrutement matérialisé à l'étape 4 avec ses
PSP et son évolution (`buildJourneymanHire`, puis `applyOfflinePurchasesForTeam`
qui traite `raised_dead` comme `journeyman`).

Deux différences, et seulement deux : il ne porte PAS Solitaire (c'est un
Trois-quart ordinaire de la fiche), et son recrutement est GRATUIT — le coût
est forcé à 0 tandis que sa valeur pleine (poste + évolution) entre en VE via
la matérialisation habituelle.

## Le choix est stocké, le joueur est dérivé

La feuille stocke `{ victimId, position }` par côté (`raisedDeadHome/Away`),
jamais le joueur. Le Trois-quart relevé n'existe que si la victime est ENCORE
un adversaire tué relevable dans les évènements : retirer la sortie du mort
(correction de saisie) fait disparaître le relevé avec elle, sans état à
nettoyer. Une seule dérivation (`raiseDeadSideView`) sert l'affichage, le
choix, l'appartenance d'une évolution, le tirage et le recrutement — deux
dérivations divergentes feraient refuser côté serveur un relevé que la feuille
affiche, le piège déjà rencontré avec les journaliers.

« Une fois par match » tient par construction : une colonne, un choix ; un
second relevé remplace le premier.

## Éligibilité : la règle, mot pour mot

Adversaire (côté opposé dans `summary.injuries`, journaliers et Star Players
compris), résultat Mort consigné, Force 4 ou moins, sans le Trait Minus. Minus
est le nom français de Stunty (`stunty`) — Microbe (`titchy`) est un autre
Trait ; la description anglaise du catalogue disait « Titchy » à tort, elle
est corrigée.

La règle spéciale de l'équipe est lue EN BASE (`Roster.specialRules` via
`resolveSpecialRulesForTeam`), catalogue compilé en repli — le patron « base
d'abord » du dépôt. La feuille n'expose le bandeau qu'aux porteurs de la règle,
et le PATCH refuse les autres (409).

## « Sinon, il est perdu »

Le livre retire les morts avant les embauches : l'effectif compté pour le cap
de 16 est le roster actif MOINS les morts de ce match (`canHireRaisedDead`),
exposé à l'UI (`canHire`) et re-vérifié à la validation. Un relevé tué à son
tour n'a plus rien à rejoindre. Dans ces cas, l'achat `raised_dead` retombe en
« dépense diverse » à 0 : rien n'est créé, rien n'est débité (le delta
raw → enrichi corrige le débit, comme pour les journaliers), et l'entrée
d'évolution est tracée « non recruté ».

## Colonnes nullables, aucun backfill

`prisma/migrations/` est gitignoré et la prod applique le schéma par `db push`
: les deux colonnes sont `Json?` et `null` se lit « pas relevé ». Le parse est
tolérant PG (objet natif) / SQLite (chaîne JSON). Prisma 6 accepte `null` en
écriture sur une `Json?` (vérifié sur le client SQLite) : l'annulation écrit
`null`, pas un objet vide.

## Alternatives écartées

- **Un évènement `raise_dead` dans le journal** : la relève apparaîtrait dans
  la timeline, mais il aurait fallu étendre le summarizer, les schémas et la
  matérialisation en actions de coupe pour un évènement sans effet de score.
  La colonne de choix suit le patron des journaliers (`journeymenHome/Away`)
  et reste supprimable d'un clic.
- **Réutiliser `kind: "journeyman"` avec un id `raised-…`** : le prix aurait
  suivi la logique du journalier (poste + évolution, débité) ; un type dédié
  rend le « gratuit » explicite dans la saisie, le schéma et la matérialisation.
