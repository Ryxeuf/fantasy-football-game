# Sélecteurs admin unifiés & statistiques de roster utiles

## Why

Deux irritants indépendants mais voisins :

1. **Trois UX pour la même tâche dans l'admin data.** Ajouter une
   compétence à une position se fait en chips + recherche ; ajouter une
   compétence à un Star Player, ses ligues régionales ou ses rosters
   autorisés se fait en grilles de cases à cocher (dizaines de cases,
   scan visuel long, sélection courante noyée). Même tâche, mêmes
   données, ergonomie différente.
2. **Des statistiques de roster que personne n'utilise.** Sur
   `/teams/[slug]`, « Coût minimum » vaut presque toujours 0k (min de
   coût×min avec des minimums à 0), « Coût maximum » additionne tous les
   slots au maximum (un total que personne n'achète), « Joueurs max »
   répète la limite d'effectif.

## What Changes

- **Un seul sélecteur multiple dans l'admin data** : `ChipMultiSelect`
  (chips retirables, recherche avec suggestions groupées, filtres par
  groupe), extrait du sélecteur de compétences des positions. Consommé
  par : compétences des positions (inchangé fonctionnellement),
  compétences des Star Players, règles/ligues régionales et rosters
  spécifiques du bloc « Recrutable par ».
- **Fiche publique d'équipe** : suppression de « Joueurs max », « Coût
  minimum » et « Coût maximum » ; à la place, fourchette de coût par
  joueur, prix d'un onze de départ légal et marge restante sur le budget
  standard de 1 000k.

## How

- Le générique préserve la garantie des grilles qu'il remplace : une
  valeur sélectionnée absente du catalogue (donnée héritée, autre
  ruleset) reste affichée « hors catalogue » et n'est jamais perdue à
  l'enregistrement.
- La sémantique du payload Star Player ne bouge pas : règles globales en
  chaînes, rosters ciblés en couples `{ rule, rosterId }`.
- Les statistiques de roster sont des fonctions pures
  (`teams/[slug]/roster-stats.ts`) testées indépendamment du rendu.

## Non-goals

- Les écrans admin des rosters (règles spéciales d'équipe) gardent leurs
  grilles de cases à cocher : listes courtes, cases toutes visibles.
- Aucun changement d'API ni de schéma.
