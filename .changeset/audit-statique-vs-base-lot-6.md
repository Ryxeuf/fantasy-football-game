---
"@bb/server": patch
"@bb/web": patch
"@bb/game-engine": patch
---

Audit « statique vs base de données » — lot 6 (modèle de données). Les
dernières données de catalogue quittent le code compilé pour des tables
éditables en admin. Partout la même posture : la base fait foi, le catalogue
de `@bb/game-engine` reste le repli journalisé et la source du seed, et le
moteur ne lit jamais Prisma — le serveur lui passe le catalogue résolu.

- **Colonnes de catalogue (6a).** Nom anglais des postes
  (`Position.displayNameEn`), plafond combiné de Gros Bras
  (`Roster.maxBigGuys`, servi au builder serveur ET web), partenaire
  obligatoire d'un Star Player (`StarPlayer.pairWithSlug`) — le prix de la
  paire se dérive désormais des deux coûts en base, donc un prix corrigé en
  admin corrige aussi celui de la paire. Les 10 pouvoirs de Star Player ont
  leur propre catégorie (`StarPlayerRule`) au lieu d'une liste codée en dur.
- **Univers des rosters (6.8).** Un roster créé en admin apparaissait dans le
  catalogue public mais le builder authentifié le refusait (« Roster non
  autorisé ») : la liste vient maintenant de `Roster.slug`.
- **Budget de construction (6.7).** `POST /team/build` prend `Roster.budget`
  comme défaut, avec la même règle que le builder web : le « Restant » affiché
  ne peut plus diverger de l'équipe réellement construite. Le plafond du
  format continue de gouverner hors Blood Bowl à 11.
- **Règles spéciales et Ligues régionales (6.5).** Les tables
  `TeamSpecialRule` et `RegionalLeague` existaient mais n'étaient jamais lues :
  corriger une description en base n'avait aucun effet visible. Elles servent
  maintenant les fiches de roster, la fiche d'équipe, les écrans commissaire
  et la création d'équipe, avec un CRUD admin et des sélecteurs de formulaire
  qui les listent.
- **Coups de pouce (6.1).** Prix, plafonds, remises et conditions d'achat
  passent en base (`Inducement`). Les conditions étaient des fonctions
  TypeScript : elles deviennent des données évaluées par une fonction pure, ce
  qui les rend enfin stockables et éditables. Corriger un prix ne demande plus
  de déploiement, et la correction s'applique au match en ligne, au match
  local et à la feuille de ligue.
- **Barème d'avancement (6.2).** Coûts en PSP et surcoûts de valeur d'équipe
  deviennent une donnée PAR ÉDITION (`AdvancementCost`, `CharacteristicValue`,
  `RulesetConfig`), avec une grille d'administration — les équipes Saison 2 se
  voyaient appliquer le barème de la Saison 3.

Toutes les colonnes ajoutées sont nullables et lues avec repli : le schéma est
appliqué par `prisma db push`, sans backfill possible. Les seeders ne
réécrivent jamais une valeur déjà posée. Un slug inconnu du moteur reste un
libellé sans effet en match, et les consoles le signalent explicitement.
