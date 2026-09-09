# Design

## 1. Où vit la précédence budget/PSP du builder

Le serveur résout les budgets de coupe PUIS exécute son bloc `if (pack)`,
qui les écrase (`routes/team-build-handler.ts`). Le pack prime donc sur la
coupe. Le client faisait l'inverse : ses deux effets « pack » étaient gardés
par `if (… || cupId) return`, et l'effet de coupe posait `?? 0` sur le pool.

Trois options :

- **Retenue — un module pur partagé par un seul effet client.**
  `build-budget.resolveBuildBudget({ packRules, packStarTax, cupRules,
  roster })` rend `{ teamValue, startingPspPool }` ou `null`. Le builder
  n'a plus qu'un effet, et la règle est testable sans React. Elle reste
  DEUX implémentations (client + serveur), mais celle du client tient en
  vingt lignes lisibles côte à côte avec le commentaire qui cite le
  serveur.
- Rejetée : *lever les gardes `cupId` sur place*. Les deux effets se
  seraient battus (l'un pose le budget du pack, l'autre celui de la coupe)
  au gré de leurs dépendances — un oscillateur, pas un correctif.
- Rejetée : *faire résoudre budget et pool par le serveur et les servir au
  builder* (`GET /cup/:id` renverrait les valeurs déjà résolues). C'est la
  bonne cible à terme — une seule implémentation — mais elle demande de
  connaître le roster AVANT que le coach l'ait choisi, donc un endpoint par
  roster ou une table complète : hors proportion pour un correctif.

## 2. Une palette, deux variantes, et deux couleurs qui ne se lisent pas

La consigne nomme des teintes, pas des couleurs de texte. Deux d'entre
elles ne sont pas utilisables telles quelles :

- la **Passe est blanche** : sur les cartes blanches du site, un badge blanc
  n'existe que par sa bordure. Elle porte donc une bordure grise franche
  (`border-gray-400`, `border-gray-900` en variante pleine) et un texte
  anthracite — la bordure n'est pas décorative ici, elle est le badge ;
- l'**Agilité est jaune** : un texte blanc dessus tombe sous 3:1. Sa
  variante pleine garde un texte très sombre (`text-yellow-950`).

Les quatre autres suivent la règle générale : texte `-900` sur fond `-100`
(douce), blanc sur fond `-600` (pleine). Quatre tests verrouillent ces
contraintes plutôt que les valeurs, pour qu'un futur ajustement de teinte
ne puisse pas les casser en silence.

La palette est indexée deux fois — par catégorie (`General`, `Agility`, …,
`Scélérates`, variantes plurielles comprises) et par code d'accès
(`G/A/S/F/P/M/K`, `F` étant l'alias français de la Force) — pour que la
lettre d'un poste et le badge d'une compétence ne puissent pas diverger.

Les catégories hors code couleur (Traits, Règles de Star Player) restent
grises. `Extraordinaire`, qui était jaune, retombe sur ce gris : garder son
jaune l'aurait rendu indiscernable de l'Agilité.

## 3. Archives : exclure par défaut, pas interdire

Le filtre vit côté serveur (`listLeagues`), pas dans la page : le même
endpoint sert la home, la liste et les futurs consommateurs. `?status=
archived` reste servi — c'est de lui que vit la page d'archives — et le
comptage de pagination voit le même périmètre que la liste.

Corollaire côté web : l'option « Archivée » quitte le filtre de `/leagues`.
L'y laisser aurait redonné, depuis la liste de base, exactement la vue dont
on venait de la débarrasser.

Les listes d'admin passent par `/admin/leagues`, hors de ce chemin : elles
voient toujours tout, ce qui est leur rôle.

## 4. Relance : le message est une constante, pas un gabarit

Les deux textes sont repris au mot près de la formulation du commissaire et
vivent en constantes verrouillées par test. Une relance doit dire la même
chose à tout le monde, à chaque journée : un gabarit paramétrable aurait
été une invitation à la dérive, sans bénéfice.

Découpage pur / I-O calqué sur `league-pairing-schedule` :
`league-round-followup` (qui relancer, dans quel cas, quel texte) ne touche
ni Prisma ni transport ; `league-round-followup-notify` charge, autorise et
envoie.

**Ce qui éteint une relance.** Une feuille `submitted_*` / `validated` est
parvenue au commissaire : plus rien à réclamer. Un `draft` ou un
`invalidated` NON — un brouillon n'est pas une feuille, et une feuille
invalidée est précisément revenue aux coachs.

**Trois canaux isolés.** Notification interne d'abord (seul canal garanti,
indépendant des préférences push et d'une adresse valide), puis push, puis
e-mail. Chacun dans son propre `try/catch` : un transport en panne ne doit
pas priver les autres coachs de leur relance. Le compte rendu remonte les
e-mails RÉELLEMENT acceptés par le transport — en CI il n'y en a aucun, et
la console ne doit pas prétendre le contraire.

**Rejouable, donc rien à persister.** Une journée qui traîne se relance
plusieurs fois ; aucune trace au-delà des notifications elles-mêmes, donc
aucune colonne, donc aucune migration (`prisma/migrations/` est gitignoré
ici, cf. CLAUDE.md).

**Nommage.** `league-round-reminder.ts` existait déjà pour l'annonce
« vous avez été apparié pour la J{n} », avec sa préférence push
`LeagueRoundReminder`. D'où « followup » pour la relance : deux sujets, deux
noms.
