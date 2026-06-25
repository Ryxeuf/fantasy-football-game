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

### 4. Bonus classement / SPP bonus / météo / forfait (2b)

Nouveaux champs `LeagueMatchSheet` (+ miroir sqlite + client) :
`weatherTable`, `forfeitSide`, `rankingBonusHome/Away`, `sppBonus`.
Effets appliqués et réversibles à la validation :
- SPP bonus « Nuffle » → increment spp avant la séquence post-match (level-up) ;
- bonus au classement → increment des points participants ;
- forfait → validation routée vers `recordForfeit` (2-0, barème forfait).
UI : table météo + toggle forfait (avant-match), bonus classement + éditeur
SPP bonus avec picker joueur (fin de match).

### 5. Consolidation UI (3b)

Une seule UI de saisie = la feuille de match. `SeasonCalendar` mène à
`/leagues/pairings/:id/sheet` (accessible aux 2 coachs impliqués + commissaire).
`EnterResultModal` (saisie rapide legacy) supprimé.

### 6. Progressions in-flow

La séquence post-match (level-up) est déjà déclenchée à la validation offline
(`runPostMatchLeagueSequence`). La feuille validée expose un lien direct vers
les progressions de l'équipe du coach (`/me/teams/:id/level-up`, banner de
pending-advancements existant).

## Reste à faire

- **Achats en mutation de roster** : aujourd'hui les achats sont saisis et
  débités de la trésorerie (cf. §2) mais ne créent pas encore réellement les
  joueurs / relances / staff dans le roster. À traiter prudemment (intégrité
  TV / trésorerie / carrière) — non fait pour ne pas risquer la cohérence.
- **Licenciements** : saisie + application (retrait de joueur) — non câblé.
- **E2E Playwright** : parcours 2 coachs → validation commissaire (mobile).
  Couverture actuelle : unit + intégration (973 tests ligue verts), dont
  `validateByCommissioner` applique tous les effets et la réversion.
