# Règlement en coupe, code couleur des compétences, archives et relance de journée

## Why

Quatre retours d'usage, indépendants les uns des autres :

1. **Créer une équipe depuis une coupe ignore le règlement de tournoi.**
   Le budget retombe sur celui du roster et le pool de PSP sur **zéro** :
   aucune compétence achetable, alors que la même équipe construite hors
   compétition en propose. Le serveur, lui, fait primer le pack sur la
   coupe — client et serveur divergeaient.
2. **Les catégories de compétences n'ont pas de code couleur.** Chaque
   consommateur portait son propre `switch` et ils avaient divergé : la
   liste `/skills` peignait la Passe en violet et la Mutation en orange, et
   les lettres d'accès d'un poste étaient toutes vertes ou grises — donc
   indiscernables entre elles.
3. **Les ligues archivées polluent la liste de base.** Elles n'ont plus
   d'action possible et noyaient les ligues vivantes, alors qu'une page
   « Ligues archivées » existe déjà.
4. **Aucun moyen de relancer les coachs d'une journée.** Le commissaire
   court après les matchs non planifiés et les feuilles qui n'arrivent pas,
   à la main, hors de l'application.

## What Changes

- **Règlement de tournoi en coupe** : `build-budget.ts` (pur, côté web)
  porte la précédence unique — règlement > règles de coupe > rien —
  reproduite du serveur ; l'effet « le pack force édition/format/mode
  avancé » n'est plus coupé par `cupId` ; `buildForCupHref` (pur) pose
  `tournamentRuleset` dès l'URL du lien de construction pour que le pack
  s'applique au premier rendu.
- **Code couleur officiel** : Générale bleu · Agilité jaune · Force rouge ·
  Mutation vert · Passe blanc · Scélérate violet.
  `lib/skill-category-colors` devient la source unique (variante douce +
  variante pleine, indexée aussi par code d'accès G/A/S/F/P/M/K).
  Le blanc et le jaune reçoivent un traitement de contraste explicite.
- **Archives** : `listLeagues` sans filtre exclut `status = archived` ;
  `?status=archived` continue de les servir ; le filtre de `/leagues` ne
  propose plus « Archivée ».
- **Relance de journée** : `league-round-followup` (pur) décide qui
  relancer et rédige les deux messages ; `league-round-followup-notify`
  envoie sur trois canaux isolés ; `POST /leagues/rounds/:roundId/remind`
  réservé au commissaire ; bouton « Relancer » par journée avec compte
  rendu.

## Impact

- Aucune migration : rien n'est ajouté au schéma. La relance ne persiste
  que ses notifications (`league.round_followup`), et reste rejouable.
- `Extraordinaire` quitte le jaune, désormais pris par l'Agilité, et
  retombe sur le gris neutre des catégories hors code couleur.
