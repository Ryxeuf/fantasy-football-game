# Feuille de match : couleurs d'équipe, accès coups de pouce, auto-calculs & évolutions inline

## Why

Suite à la refonte UX de la feuille de match (cf.
`improve-league-match-sheet-ux`), plusieurs frictions subsistaient :

- La **saisie d'évènements** était sous la timeline : avec beaucoup
  d'évènements, il fallait scroller toute la liste pour saisir.
- Les **coups de pouce** proposaient le catalogue complet sans tenir
  compte de ce que **chaque roster peut réellement acheter** (les star
  players étaient déjà filtrés, pas les inducements génériques).
- Aucune **différenciation visuelle des équipes** : impossible de voir
  d'un coup d'œil quelle équipe a effectué une action.
- La **fin de match** demandait une saisie manuelle de valeurs pourtant
  dérivables des règles (SPP, gains).
- Les **évolutions de joueurs** se faisaient sur une page séparée ; rien
  ne rappelait qu'elles ne s'appliquent qu'après validation.

## What Changes

- **Saisie d'évènements** : le bloc de saisie passe **avant** la timeline.
- **Coups de pouce par équipe** : chaque équipe ne voit que les inducements
  accessibles à son roster (filtre `canPurchase` + coût régional), en plus
  des star players déjà filtrés.
- **Couleurs de roster** : couleurs primaire/secondaire dérivées du roster,
  utilisées dans la **timeline** (bordure + pastille de tour par équipe) et
  l'**en-tête de récap** (barres + liserés du score).
- **Auto-calculs fin de match** : SPP estimés par joueur (depuis les
  évènements + MVP) affichés ; gains auto depuis la popularité. Le calcul
  **officiel et autoritaire** est fourni par le serveur (modificateurs
  d'équipe inclus) et appliqué à la validation.
- **Onglet Évolutions** : rappel de la règle de staging + **édition inline**
  des évolutions (choix de compétence / amélioration de caractéristique)
  directement dans la feuille, une fois le match validé.
- **Staging confirmé** : les évolutions ne sont **jamais** écrites au roster
  avant la validation du commissaire (comportement déjà en place,
  désormais explicite et accessible depuis la feuille).

## How

- **Backend** (`league-match-sheet.ts`) : `reference.inducements` par équipe
  (`inducementOptionsFor(roster)`), `reference.colors` (hex via
  `getTeamColors`), et SPP autoritaire par joueur exposé dans la réponse
  (réutilise `calculatePlayerSPP` + modificateur d'équipe).
- **Frontend** : réorganisation de l'onglet « En cours », timeline et
  en-tête colorés, bloc SPP read-only en fin de match, onglet « Évolutions ».
- **Réutilisation** : le sélecteur d'avancement de la page level-up est
  **extrait** en composant partagé `AdvancementEditor`, monté à la fois sur
  `/me/teams/[id]/level-up` et dans l'onglet Évolutions de la feuille.

## Out of scope

- Pas de **die rolls automatiques** non déterministes (fans dévoués, MVP
  aléatoire) : ils restent saisis/choisis.
- Pas de persistance de surcharges de couleur par roster (les couleurs
  proviennent des constantes du moteur).

## Impact

- **Capability** : `league-match-sheet` (delta — ADDED).
- **Backend** : `services/league-match-sheet.ts`.
- **Frontend** : `leagues/pairings/[id]/sheet/*`, `components/AdvancementEditor.tsx`,
  `me/teams/[id]/level-up/page.tsx`.
- **Tests** : service (reference par équipe, couleurs, SPP autoritaire),
  composants (auto-SPP, AdvancementEditor).
