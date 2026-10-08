# Saisie de la feuille de match de coupe : complète ou simplifiée

## Why

Une rencontre de coupe se saisit sur la feuille de match des ligues, moins
deux onglets (« Fin du match », « Évolutions »). La coupe se jouant en
résurrection, la majorité de ce qu'on y saisit encore n'a AUCUN effet :
météo, pile ou face, popularité, coups de pouce, prières, mi-temps et tour,
gravité des blessures, coup d'envoi, et 8 types d'évènements sur 13. Le
classement et les tops ne lisent que le forfait, les touchdowns, les sorties
sur blocage, les sorties sur agression (avec leur victime), les passes
réussies et les interceptions. Les coachs recopient une feuille papier après
une partie sur table : chaque champ inutile est une saisie de trop.

## What Changes

- **Paramètre de coupe « mode de saisie de la feuille »** : `complète` (la
  feuille actuelle) ou `simplifiée`. Choisi à la création, modifiable à tout
  moment par le commissaire, y compris en cours de coupe — rien de persisté
  n'en dépend.
- **Défauts** : les coupes existantes restent en saisie complète ; une
  nouvelle coupe est créée en saisie simplifiée, sauf choix contraire.
- **Feuille simplifiée** : la feuille de match de la ligue, au même design
  (onglets, formulaire, timeline, libellés) et au même parcours
  (soumissions des deux coachs, validation et invalidation du commissaire),
  dont on RETIRE des champs. Seul le formulaire se réduit au forfait et à cinq
  types d'évènements (touchdown, sortie sur blocage, sortie sur agression,
  passe réussie, interception), avec acteur et, pour les sorties, victime.
  Plus de mi-temps, de tour, de gravité, d'avant-match détaillé, de choix de
  poste des journaliers ni de mort relevé. La timeline continue d'afficher
  tout évènement déjà saisi.
- **Sortie sur agression sans gravité** : en saisie simplifiée, une sortie
  sur agression est marquée comme telle sur l'évènement, et la
  matérialisation de coupe la compte (points d'agression, top « agresseur »,
  « sac de frappe ») sans inventer de gravité. La ligue n'est pas touchée.
- **Feuille papier alignée** : en saisie simplifiée, la feuille de rencontre
  PDF d'une coupe ne porte que ce que le formulaire demande.
- **Aide du site** : une section explique les deux modes, ce que chacun
  demande, et pourquoi le mode simplifié ne fait rien perdre au classement
  ni aux tops. Le bandeau de la feuille et le formulaire de la coupe y
  renvoient.

Les tops individuels et par équipe sont conservés dans les deux modes.

## Capabilities

### New Capabilities

Aucune.

### Modified Capabilities

- `cup-match-sheet` : mode de saisie configurable par coupe, contenu de la
  saisie simplifiée, sortie sur agression sans gravité.
- `cup-standings-criteria` : l'édition d'une coupe par son commissaire couvre
  aussi le mode de saisie, en cours de coupe compris.
- `competition-pdf-exports` : la feuille de rencontre imprimable d'une coupe
  suit son mode de saisie.
- `site-help` : l'aide explique le mode de saisie d'une coupe. Capacité
  introduite par le change `site-help-page`, non encore archivé : le delta
  est écrit en `ADDED`, valable que ce change soit archivé avant ou après.

## Impact

- **Base** : colonne nullable `Cup.sheetEntryMode` (`null` = complète), dans
  `prisma/schema.prisma` et le miroir `apps/server/prisma/sqlite/schema.prisma`.
  SANS `@default` : un défaut Prisma serait posé par `db push` sur les coupes
  existantes. Aucun backfill.
- **Serveur** : `schemas/cup.schemas` (création + édition),
  `routes/cup.ts` (création écrit `simplified` explicitement, `PATCH /cup/:id`
  accepte le champ), `services/competition-match-sheet-context`
  (`CompetitionSheetRules.entryMode`, jeu de règles de coupe construit depuis
  la coupe), `services/cup-match-sheet` (sortie sur agression marquée),
  `seed.ts`.
- **Web** : module pur de profil de saisie partagé par la page de la feuille
  et l'adaptateur PDF ; `leagues/pairings/[id]/sheet` (formulaire réduit) ;
  formulaire de création (`cups/page.tsx`) et d'édition
  (`cups/[id]/edit`) ; `lib/competition-pdf` ; `aide/help-catalogue`.
- **Aucune** nouvelle route, aucun nouveau flag, aucun changement d'API des
  évènements (`meta` est déjà un objet libre).
