# Admin Star Players : saisie en cases à cocher

## Why

Le formulaire d'édition d'un Star Player
(`/admin/data/star-players/[id]/edit`) demandait deux listes en **texte
libre séparé par des virgules** :

- `Compétences (slugs séparés par des virgules)` — l'admin devait
  connaître par cœur les slugs (`block,dodge,loner-4`), sans catalogue
  affiché ni validation ;
- `Recrutable par (règles/rosters séparés par des virgules)` — idem,
  sans la liste des ligues régionales ni celle des alignements
  « Favori de… ».

Partout ailleurs dans l'admin data, ces listes se cochent : les rosters
utilisent `SlugCheckboxGrid` pour les ligues régionales et les règles
spéciales (`/admin/data/rosters/[id]/edit`).

Deux défauts fonctionnels s'ajoutaient à l'ergonomie :

1. **Les compétences n'étaient pas enregistrables.** Le serveur
   connectait la relation par `skill: { connect: { slug } }` alors que
   `Skill` est unique par `[slug, ruleset]` : Prisma rejette un `connect`
   ambigu. Le même bug avait déjà été corrigé pour les positions
   (`resolveSkillIdsForRuleset`), mais pas pour les Star Players.
2. **Le lien vers un roster précis était perdu à chaque enregistrement.**
   Le formulaire ne réémettait que `hirableBy[].rule` ; l'API retombe
   alors sur `rosterId: null` et l'entrée `StarPlayerHirableBy` perd sa
   cible.

## What Changes

- **Compétences en cases à cocher**, groupées par catégorie, avec
  filtre texte et compteur (`SkillCheckboxPicker`). Les slugs déjà
  enregistrés mais absents du catalogue sont conservés et affichés
  « hors catalogue ».
- **Recrutement en cases à cocher** (`HirableByPicker`) : catalogue
  complet des règles (`all`, les 10 ligues régionales, les alignements
  « Favori de… » dérivés de `TEAM_REGIONAL_RULES_BY_RULESET`) + liste
  filtrable des rosters pour un ciblage précis.
- **Couple `(rule, rosterId)` préservé** : un roster coché est réémis
  en objet `{ rule: slug, rosterId }`, plus en simple chaîne.
- **Catalogues filtrés sur le ruleset** du Star Player (édition) ou
  choisi dans le formulaire (création) : sans ce filtre, un même slug
  de compétence apparaît deux fois et le slug envoyé est ambigu.
- **Serveur** : `resolveSkillIdsForRuleset` appliqué à la création et à
  la mise à jour d'un Star Player, **avant** toute suppression de
  relation ; `SkillResolutionError` → HTTP 400 ; `ruleset` accepté à la
  création.
- **Confirmation par relecture serveur** après enregistrement, comme
  sur l'édition d'un roster.
- `SlugCheckboxGrid` remonte de `data/rosters/_components/` à
  `data/_components/` (partagé par rosters et Star Players) et gagne un
  `hint` optionnel pour afficher autre chose que la valeur cochée (un
  roster se coche par id, se lit par slug).

## Impact

- Specs : `admin-star-players` (nouvelle capability).
- Code web : `app/admin/data/_components/SlugCheckboxGrid.tsx` (déplacé),
  `app/admin/data/star-players/_components/*` (nouveau),
  `star-players/new/page.tsx`, `star-players/[id]/edit/page.tsx`,
  imports des trois écrans roster.
- Code serveur : `routes/admin-data.ts` (POST/PUT star-players),
  `schemas/admin-data.schemas.ts` (`ruleset` à la création).
- Pas de migration Prisma, pas de changement de modèle.
