# Aide de jeu — companion de table mobile-first

## Why

Le compendium (`/compendium`) est une **référence** : dix chapitres à lire,
organisés par thème. Sur une table de jeu, ce n'est pas ce dont on a
besoin. Le coach cherche « et maintenant, je fais quoi ? » puis, ponctuellement,
une table précise (météo, événement de coup d'envoi, jet d'élimination).
Avec le compendium il doit deviner le chapitre, scroller, perdre sa place,
et recommencer au coup d'envoi suivant.

C'est exactement le rôle de l'aide de jeu papier livrée dans la boîte : le
**déroulé chronologique** d'une partie, court, et les tables à portée de main.
Le site n'a pas d'équivalent.

## What Changes

- Nouvelle page **`/aide-de-jeu`** : le déroulé complet d'une partie en
  **trois phases** (avant / pendant / après le match), chaque étape tenant
  en une ou deux lignes. Mobile first, consultable d'une main au-dessus
  d'un plateau.
- **Les tables ne sont jamais dans le flux** : chaque étape porte des
  pastilles (`2D6 Météo`, `D16 Élimination`…) qui ouvrent une **fiche** en
  panneau — bottom-sheet sur mobile, panneau latéral sur desktop — sans
  quitter la page ni perdre sa position.
- **14 fiches** : météo (12 terrains), événements de coup d'envoi (2D6 et
  D16), prières à Nuffle (D16), coups de pouce, blessure / Minus /
  élimination / séquelles, contester la décision, PSP par action, coûts
  d'amélioration, amélioration de caractéristique (D8), hausse de valeur,
  tableau de compétences, fans dévoués, erreurs coûteuses.
- **Fiche partageable** : `?fiche=<id>` ouvre directement le panneau
  (lien profond, bouton retour du navigateur géré).
- **Checklist de partie** : les étapes d'avant-match et les actions
  limitées du tour (1 Blitz, 1 Passe, 1 Remise, 1 Botter de coéquipier,
  1 Agression) sont cochables, persistées en `localStorage`, avec une
  remise à zéro explicite.
- **Points d'entrée** : entrée « Aide de jeu » dans le menu Compendium
  (desktop + mobile), lien pied de page, entrée sitemap, lien croisé
  depuis le compendium.

## How

- **Aucune règle n'est réécrite à la main.** Le contenu des fiches est
  **dérivé** de sources déjà versionnées et déjà reformulées :
  - `app/compendium/data/rules-bb-2025.json` pour les tables du compendium
    (coup d'envoi, blessures, agressions, ligue, PSP, coups de pouce) —
    extraites par `(chapitre, caption)` via des sélecteurs purs ;
  - `WEATHER_TYPES` et `PRAYERS_TABLE` de `@bb/game-engine` pour la météo
    (absente du compendium) et les prières à Nuffle.
  Une table renommée ou déplacée en amont fait donc **échouer un test**
  plutôt que de disparaître silencieusement de la page.
- **Le déroulé lui-même** (`sequences.ts`) est du contenu neuf : des
  résumés d'une ligne rédigés pour l'aide de jeu, qui pointent vers les
  fiches et vers les chapitres du compendium. Il ne recopie pas le `.json`.
- **Page serveur** (`page.tsx`, ISR 3600) pour le SEO et les données
  structurées ; l'interactivité (panneau, checklist, deep-link) vit dans
  un client component.
- **Pas de nouvelle table Prisma, pas de route serveur** : tout est
  statique, la checklist reste sur l'appareil.

## Non-goals

- Remplacer le compendium : chaque fiche renvoie vers son chapitre complet.
- Lancer les dés à la place du coach (pas de simulateur ici).
- Synchroniser la checklist avec un match en cours ou un compte.
