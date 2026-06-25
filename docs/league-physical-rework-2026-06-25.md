# Refonte gestion de ligue physique (2026-06-25)

Objectif : faire de la gestion de ligue une **gestion 100 % physique**
(joueurs réels, tabletop) avec **saisie manuelle** des résultats, conforme à
la séquence d'après-match du livre de règles officiel. Les ligues en ligne
(« online leagues ») seront refaites séparément plus tard.

## Constat de départ

Le backend du flux offline était déjà ~80 % en place et n'a **pas** été
réécrit :

- Modèle `LeagueMatchSheet` (FSM `draft → submitted_home/away →
  both_submitted → validated → invalidated`) + `LeagueMatchEvent` (timeline),
  summarizer pur, snapshot.
- `validateByCommissioner` applique tous les effets via
  `buildOfflineInputFromSummary` → `recordOfflineLeagueResult` →
  `recordLeagueMatchResult` + `runPostMatchLeagueSequence` (classement +
  points + bonus, SPP + level-up, blessures durables, trésorerie, fans).
- `canInvalidateMatchSheet` bloque l'invalidation si un match ultérieur a été
  joué ; notifs commissaire + page `/leagues/[id]/pending-validations`.

Le flux **2 joueurs valident → commissaire valide** existait donc déjà :
`submitByCoach` (= « valider ma saisie ») → `both_submitted` → notif →
`validateByCommissioner`, avec `unsubmitByCoach` (= « reprendre la saisie »)
tant que non validé commissaire (les données saisies sont conservées).

## Ce qui a été fait

### 1. Découplage online (commit `refactor(league): découple…`)

Une ligue ne crée plus de match jouable en ligne ; un match en ligne n'écrit
plus jamais le classement.

- Suppression `League.matchMode` / `turnDeadlineHours` + route admin
  `PATCH /admin/leagues/:id/match-mode`.
- Suppression `createMatchFromPairing` (service + route
  `POST /pairings/:id/match` + schéma + test) et `handleAttachMatch`
  (`POST /seasons/:id/rounds/:id/matches`).
- `move-processor` : retrait du bloc d'auto-écriture du classement en fin de
  match online.
- `SeasonCalendar` : retrait des CTA « lancer / reprendre / voir » online ;
  un pairing `scheduled` n'a plus que la saisie manuelle.
- ⚠️ `Match.mode="async"` / `turnDeadlineHours` (génériques, hors ligue) et le
  cron async sont **conservés**.

### 2. Application des dépenses de trésorerie (commit `feat(league): applique…`)

Les coups de pouce, erreurs coûteuses et achats étaient stockés sur la feuille
mais jamais appliqués. Câblage d'un **débit de trésorerie réversible** :

- `recordOfflineLeagueResult` : net trésorerie = `winnings - treasuryDebit`.
- `buildOfflineInputFromSummary` : `treasuryDebit` = somme `inducements +
  costlyErrors + purchases` (tolérant array PG / string sqlite).
- `reverseOfflineLeagueResult` : annule le net exact.
- Réutilise les champs **existants** du modèle (aucun changement de schéma).

### 3. Refonte UI mobile-first (commit `feat(league): refonte mobile-first…`)

- `getMatchSheet` expose les 2 équipes + joueurs (n°, nom, poste, mort/blessé,
  SPP) pour les **pickers joueurs**.
- Page `/leagues/pairings/[id]/sheet` reconstruite, responsive, sections
  **RÉSUMÉ / AVANT-MATCH / AU COURS DU MATCH / FIN DU MATCH** :
  - score auto dérivé des events ;
  - avant-match : météo, facteur popularité → gains auto, coups de pouce
    (éditeur + cash investi calculé) ;
  - au cours : éditeur d'events avec pickers acteur/cible, blessures dérivées ;
  - fin : joueur du match (picker), gains, fans dévoués, achats, erreurs
    coûteuses ;
  - libellés FR du flux 2 joueurs (Valider ma saisie / Reprendre la saisie /
    Valider le match commissaire).

## Reste à faire

- **2b** : bonus au classement (commissaire) + SPP bonus (« accordé par
  Nuffle ») + table météo distincte de la météo initiale + toggle « Déclarer
  forfait » sur la feuille → **nécessite de nouveaux champs `LeagueMatchSheet`**.
- **2c** : achats appliqués comme mutation de roster (ajout joueur/relance/
  staff) ; licenciements ; surfaçage des progressions in-flow juste après
  validation.
- Consolidation : retirer `EnterResultModal` (saisie rapide legacy) au profit
  de la feuille, en repointant le CTA `SeasonCalendar` et en ouvrant l'accès
  feuille aux 2 coachs impliqués.
- E2E Playwright : parcours 2 coachs → validation commissaire (mobile).
