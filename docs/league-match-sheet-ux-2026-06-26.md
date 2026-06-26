# Feuille de match ligue — refonte UX & règles officielles (2026-06-26)

Refonte de la saisie de feuille de match de ligue physique
(`/leagues/pairings/[id]/sheet`) pour la rapprocher des règles
officielles Blood Bowl et la rendre plus agréable, dans l'esprit BB.

## Ce qui change

### Identité d'équipe (RÉSUMÉ)
- Badge **race** (libellé du roster, ex: « Humains ») + badge **coach**
  (nom du owner) sous chaque nom d'équipe.
- Bandeau **TV** (Valeur d'Équipe Actuelle = `currentValue`) +
  **cagnotte** (`treasury`) par équipe.
- Composants exportés réutilisables : `TeamIdentityBadges`,
  `TeamValueStrip`, helper `formatGold`.

### Météo
- Toutes les **tables météo** du moteur sont proposées
  (`WEATHER_TYPES`, 12 tables) au lieu des 3 valeurs codées en dur.
- Le sélecteur de **météo dépend de la table choisie** : il liste les
  résultats 2..12 de la table (`roll — condition`). Changer de table
  réinitialise la météo.
- La **conséquence (informative)** de la météo sélectionnée est
  affichée (description issue de la table).

### Coups de pouce (inducements)
- Plus de saisie libre : ajout via le **catalogue officiel**
  (`INDUCEMENT_CATALOGUE`, hors `star_player`) + les **Star Players
  disponibles pour l'équipe** (`getAvailableStarPlayers(roster)`).
- Coût **auto-rempli**, quantité bornée par `maxQuantity`.
- **Budget = petty cash + trésorerie** (règles BB, `calculatePettyCash`
  sur les CTV) : jauge de budget, blocage du « reste » négatif côté UI
  (bouton désactivé) **et** côté serveur (`updatePreMatch` rejette avec
  le code `inducement_over_budget`).
- À la validation, la **trésorerie n'est débitée que de l'excédent**
  au-delà du petty cash (`buildOfflineInputFromSummary` reçoit le petty
  cash par équipe ; défaut 0/0 → rétro-compat).

### Évènements
- Saisie de la **mi-temps** (1/2) et du **tour** (1..8) pour chaque
  évènement. Stockés dans `LeagueMatchEvent.meta` (`{ half, turn }`) —
  pas de migration. Schéma `addEventSchema` étendu (`half`, `turn`),
  fusionnés dans `meta` côté service sans écraser un `meta` fourni.
- **Timeline chronologique** : les évènements sont triés par mi-temps
  puis par tour (ordre de saisie comme départage stable), rendus en
  liste ordonnée (`<ol>`) avec rail vertical, séparateurs de mi-temps et
  badge `T{n}`. Tri pur exporté : `chronologicalTimeline(events)`.

### Navigation par onglets
- La feuille est découpée en **3 onglets** (même page, état préservé,
  pas de refetch) : **Avant-match / En cours / Fin du match**. Le résumé,
  les actions de workflow (valider/commissaire) et l'invalidation restent
  visibles hors onglets. L'onglet « En cours » porte un compteur
  d'évènements.

## Données de référence (API)

`getMatchSheet` renvoie désormais un bloc `reference` :

```ts
reference: {
  weatherTables: { id, name, results: { roll, condition, description }[] }[],
  inducements:   { slug, name, cost, maxQuantity, description }[],
  starPlayers:   { home: StarPlayerOption[], away: StarPlayerOption[] },
  budget:        { home: TeamBudget, away: TeamBudget },  // ctv, treasury, pettyCash, maxBudget
}
```

`MatchSheetTeam` est enrichi : `raceName`, `coachName`, `teamValue`,
`currentValue`, `treasury`.

## Fichiers
- `apps/server/src/services/league-match-sheet.ts` — enrichissement
  équipes, `buildMatchSheetReference`, enforcement budget, petty cash
  à la validation, half/turn dans `addEvent`.
- `apps/server/src/schemas/league-match-sheet.schemas.ts` — `half`/`turn`.
- `apps/web/app/leagues/pairings/[id]/sheet/_components/MatchSheetPanels.tsx`
  — types de référence, badges, éditeur de coups de pouce catalogue +
  budget, météo dépendante.
- `apps/web/app/leagues/pairings/[id]/sheet/page.tsx` — RÉSUMÉ badges,
  half/turn, passage de `reference`.

## Tests
- `league-match-sheet.test.ts` : reference exposée, budget rejeté/accepté,
  petty cash réduit le débit treasury, half/turn dans `meta`.
- `MatchSheetPanels.test.tsx` : badges, météo dépendante + conséquence,
  budget bloquant.
