# Design — Ronde suisse des coupes, clôture manuelle et journées repensées

## Modèle de données (coupes)

```prisma
model CupRound {
  id          String  @id @default(cuid())
  cupId       String  // Cup, onDelete: Cascade
  roundNumber Int     // @@unique([cupId, roundNumber])
  name        String?
  system      String  @default("swiss")   // réservé : "manual"
  status      String  @default("pending") // pending | in_progress | completed
  scheduledAt DateTime?
  pairings    CupPairing[]
}

model CupPairing {
  id          String  @id @default(cuid())
  roundId     String  // CupRound, onDelete: Cascade
  tableNumber Int     @default(1)          // 1 = tête de classement
  homeTeamId  String
  awayTeamId  String?                       // null = exempt (bye)
  status      String  @default("scheduled") // scheduled | in_progress | played | bye | cancelled
  scheduledAt DateTime?
  localMatch  LocalMatch?                   // FK sur LocalMatch.cupPairingId (@unique)
}
```

Alternatives écartées :

- **Réutiliser `LeagueRound` / `LeaguePairing`** : ils sont rattachés à une
  `LeagueSeason` et à des `LeagueParticipant` (FK obligatoires), avec une
  feuille de match, des points bonus et un cron de forfait — rien de tout
  cela n'a de sens en coupe, dont le résultat est un `LocalMatch`.
- **FK sur `CupPairing.localMatchId`** : la FK vit sur `LocalMatch`
  (`cupPairingId @unique`), comme `Match.leaguePairingId` : la contrainte
  d'unicité garantit qu'une rencontre ne produit qu'un seul match, même
  quand les deux coachs cliquent en même temps (P2002 → 409), et
  `onDelete: SetNull` conserve un match joué si la ronde est supprimée.
- **Persister les points d'exempt** : le classement de coupe reste dérivé
  des matchs terminés ; les exempts sont injectés à la lecture
  (`byesByTeamId`), donc aucune donnée à corriger si une ronde est effacée.

`prisma/migrations/` étant gitignoré (prod = `db push`), tout est additif :
deux tables et une colonne nullable ; aucun backfill.

## Moteur pur `swiss-pairing`

- Entrée : équipes DANS L'ORDRE du classement (le service fournit le
  classement, départages compris), historique (rencontres, exempts,
  domiciles).
- Appariement « au plus proche » avec **retour arrière** : zéro rematch
  tant qu'un appariement complet sans rematch existe (budget de 200 000
  nœuds, puis repli glouton avec rematch, signalé `rematchForced`).
- Exempt : la dernière équipe non encore exemptée, sinon la dernière.
- Domicile : l'équipe qui a le moins reçu, à égalité la mieux classée.
- Déterministe, sans I/O, testé sur 24 équipes × 5 rondes.

## Service `cup-rounds`

- `generateSwissCupRound` : coupe validée / en cours, ≥ 2 inscrits, ronde
  précédente sans rencontre ouverte ; classement courant → moteur → ronde +
  rencontres (+ exempt) en une transaction ; notification interne
  `cup.round_pairing` (jamais bloquante).
- Cycle : `POST /local-match` avec `cupPairingId` (équipes = celles de la
  rencontre, statut `scheduled`) → `in_progress` (écriture conditionnelle
  sur le statut) ; `/complete` → `played` et ronde `completed` si toutes les
  rencontres sont terminales ; match annulé / supprimé → rencontre libérée.
- Commissaire : suppression de la dernière ronde tant qu'aucun match n'y
  existe, annulation d'une rencontre sans match.

## Clôture manuelle de saison (ligue)

`recordLeagueMatchResult` / `maybeCompleteRoundAndSeason` gardent la
complétion de journée et le démarrage automatique des playoffs, mais ne
touchent plus `LeagueSeason.status`. `closeSeason` (route `/close`) porte
désormais le palmarès ET la clôture thématique. Le garde-fou
`season-completed` de la reversion ne s'applique donc qu'aux saisons
clôturées par le commissaire. Une journée ré-ouverte par une invalidation
repasse `in_progress` (statut connu de l'UI) au lieu de `scheduled`.

## Date prévisionnelle

Service `league-pairing-schedule` (autorisation par les deux équipes et le
créateur ; refus sur rencontre jouée / forfaitée / annulée). Même schéma
Zod réutilisé par `/cup/pairings/:id/schedule`. L'éditeur web est un
composant commun (`components/competition/ScheduleEditor`, endpoint en
prop) ; `PairingScheduleEditor` l'enveloppe pour la ligue.

## Journées repensées

`components/competition/MatchCard` est purement présentationnel (libellés
en props, aucun fetch) : c'est ce qui permet de l'utiliser à l'identique
dans `SeasonCalendar` (ligue) et `CupRoundsView` (coupe). Les `data-testid`
historiques du calendrier sont conservés. Le statut affiché d'une journée
est dérivé (`effectiveRoundStatus`) : en base une journée reste `pending`
tant qu'elle n'est pas complète.
