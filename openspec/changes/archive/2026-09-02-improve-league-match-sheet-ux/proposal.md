# Refonte UX de la feuille de match de ligue (règles officielles BB)

## Why

La saisie de feuille de match de ligue physique
(`/leagues/pairings/[id]/sheet`) s'écartait des règles officielles Blood
Bowl et restait austère :

- La **table météo** était codée en dur à 2 valeurs (`classique`,
  `stade_couvert`) et la météo à 5 conditions figées, alors que le moteur
  expose 12 tables complètes (`WEATHER_TYPES`). Aucune **conséquence** de
  la météo n'était affichée.
- Les **coups de pouce** étaient une saisie 100 % libre (`{name, cost,
  qty}`) : aucun lien avec le catalogue officiel
  (`INDUCEMENT_CATALOGUE`) ni les Star Players, et **aucun garde-fou de
  budget** — on pouvait acheter hors trésorerie/petty cash.
- La **TV** (valeur d'équipe) et la **cagnotte** n'étaient ni affichées
  ni prises en compte pour le budget des coups de pouce (règle du petty
  cash ignorée : la trésorerie était débitée du coût total).
- Pas de **race** ni de **coach** visibles sur le résumé.
- Les **évènements** ne portaient ni **mi-temps** ni **tour**.

## What Changes

- **Identité d'équipe** : badges **race** (libellé du roster) + **coach**
  (owner) et bandeau **TV / cagnotte** par équipe sur le résumé.
- **Météo** : les 12 tables du moteur sont proposées ; la météo **dépend
  de la table** choisie (résultats 2..12) ; la **conséquence
  informative** de la météo est affichée.
- **Coups de pouce** pilotés par le **catalogue officiel** + les **Star
  Players disponibles** pour le roster (coût auto, quantité bornée par
  `maxQuantity`).
- **Budget** = petty cash (différence de CTV) + trésorerie
  (`calculatePettyCash`) : jauge UI, **blocage du dépassement côté UI ET
  serveur** (`updatePreMatch` → erreur `inducement_over_budget`).
- **Comptabilité petty cash** : à la validation, la trésorerie n'est
  débitée que de **l'excédent au-delà du petty cash** (et non plus du
  coût total des coups de pouce).
- **Évènements** : saisie de la **mi-temps** (1/2) et du **tour** (1..8),
  stockés dans `LeagueMatchEvent.meta` (`{ half, turn }`), affichés en
  badge.
- **Timeline chronologique** : les évènements sont triés par mi-temps puis
  tour (départage stable par ordre de saisie) et rendus en liste ordonnée
  avec séparateurs de mi-temps.
- **Navigation par onglets** : la feuille est découpée en 3 onglets
  (Avant-match / En cours / Fin du match) sur la même page (état préservé,
  pas de refetch) ; résumé, actions de workflow et invalidation restent
  hors onglets.
- **API** : `getMatchSheet` renvoie un bloc `reference` (tables météo,
  catalogue de coups de pouce, Star Players par équipe, budgets par
  équipe) et `MatchSheetTeam` est enrichi (`raceName`, `coachName`,
  `teamValue`, `currentValue`, `treasury`).

## Out of scope

- Pas de **migration** : mi-temps/tour passent par `meta` (Json déjà
  présent) ; aucune nouvelle colonne.
- Les **règles d'effet** de la météo et des coups de pouce restent
  **informatives** sur la feuille physique (pas d'application moteur :
  c'est de la saisie offline).
- Pas de refonte du panneau **fin de match** (achats/SPP/MVP/erreurs
  coûteuses inchangés), hormis le bénéfice du débit petty cash.

## Impact

- **Capability** : `league-match-sheet` (delta — ADDED requirements).
- **Backend** : `services/league-match-sheet.ts`,
  `schemas/league-match-sheet.schemas.ts`.
- **Frontend** : `app/leagues/pairings/[id]/sheet/page.tsx` +
  `_components/MatchSheetPanels.tsx`.
- **Tests** : service (`league-match-sheet.test.ts`) + composant
  (`MatchSheetPanels.test.tsx`).
- **Compat ascendante** : valeurs météo/coups de pouce héritées hors
  catalogue restent affichables ; petty cash par défaut 0/0 → débit
  identique à l'historique tant que les CTV ne sont pas renseignées.
