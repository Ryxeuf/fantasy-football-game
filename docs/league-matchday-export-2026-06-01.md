# Export d'une journée — 2026-06-01 (W-C)

Chaque journée (round) d'une ligue est exportable pour **imprimer** ou
**diffuser** aux joueurs (usage offline / tabletop type mordorbihan).

## Implémentation (client only, zéro dépendance ajoutée)

Composant `MatchdayExport` (bouton « Exporter » dans l'en-tête de round du
`SeasonCalendar`) ouvre une **feuille de journée** : matchups domicile vs
extérieur + statut. Deux actions :

- **Imprimer** : `window.print()`. Scope via la classe `.matchday-print-area`
  + une règle `@media print` dans `globals.css` (masque tout le reste de la
  page, isole la feuille). Les styles Tailwind s'appliquent (même document).
- **Télécharger PDF** : `jsPDF` + `jspdf-autotable` (déjà en deps) génèrent un
  PDF **structuré** (titre + table des pairings), pas une rasterisation du DOM.
  Fichier `journee-N.pdf`.

### Choix PDF vs PNG
L'option retenue était « impression + PNG », mais `html-to-image` n'est pas une
dépendance du projet alors que `jsPDF`/`jspdf-autotable` le sont déjà. Un PDF
structuré via la dépendance existante couvre « imprimer ou diffuser » sans
ajouter de dépendance ni rasteriser — strictement préférable ici. Un export PNG
reste ajoutable si un format image est spécifiquement souhaité.

### Limite connue
La feuille liste les **matchups + statut**, pas le score par match (le score
n'est pas dans le payload de saison ; l'ajouter nécessiterait d'enrichir
`getSeasonById` avec le score offline parsé depuis `Match.offlineResultInput`).
Enhancement possible.

## Tests
`MatchdayExport.test.tsx` 3/3 (ouverture feuille / PDF autotable+save /
impression). Web leagues 62/62. tsc web OK.
