# Exploration — Pronostics sur les matchs de ligue (2026-09-27)

> Statut : **exploration** (mode `/opsx:explore`), aucun code écrit.
> Suite de la session « Paris sur matchs de ligue » du 2026-09-11, restée
> bloquée sur six décisions et dont la branche (`claude/jolly-davinci-b37i3g`)
> n'existe plus sur le dépôt : rien n'en avait été consigné. Ce document est
> là pour que ça n'arrive pas deux fois. Prochaine étape naturelle :
> `/opsx:propose "pronostics de ligue"` en partant d'ici.

## 1. Ce qu'on avait déjà dit (mémoire retrouvée)

| Où | Quoi | État |
|---|---|---|
| Session `Paris sur matchs de ligue` (2026-09-11) | Cadre « paris » sur les rencontres de ligue : 1N2 + plus/moins 2,5 TD, Crowns en phase 1, ouverture au public en phases 2-3. **Six décisions bloquaient la proposition** : pari sur son propre match ? forfait = annulation ou victoire ? clôture auto seule ou manuelle ? mise plafonnée fixe ou réglée par le commissaire ? le commissaire parie-t-il ? « paris » ou « pronos » dans l'UI ? | Jamais consigné, branche disparue. Réponses proposées en §6. |
| `docs/roadmap/sprints/SPRINT-pro-league.md` (lot 1.D) | Économie **Crowns** : monnaie 100 % gagnée (jamais achetable, jamais encaissable), 1 000 à l'inscription, 50 par jour, paris à cotes sur la Pro League, badges, leaderboards. | Livré, puis **gelé** avec la Pro League le 2026-06-01 (`docs/pro-league-freeze-2026-06-01.md`). |
| `docs/roadmap/sprints/SPRINT-Q-fan-differentiation.md` (Q.B.3, Q.D.1, Q.D.2) | Trois mécaniques de pronostic **sur la Pro League** : prédiction texte libre scorée `perfect / winner / wrong`, mini-ligues privées de pronostics (pick 1N2 par match, code de jonction), Survivor hebdo. | Livré (#775, #776, #784), gelé avec la Pro League. Les récompenses en Crowns prévues (25 au MVP, 5 000 au survivant) n'ont **jamais** été câblées (« futur lot Sprint Q rewards »). |
| `docs/roadmap/backlog/future-ideas.md` | #11 Survivor Pick'em, #1 couche MPG (les Crowns gagnées deviennent le budget mercato), gate de réactivation liée aux KPI Pro League. | Backlog, gate non atteinte (Pro League gelée). |
| `docs/roadmap/sprints/SPRINT-R-...md` (R.B.2) | Season Pass cosmétique : `CosmeticPack {priceCrowns, priceEur}` + `UserCosmeticUnlock`, « 5 000 Crowns gagnables en jeu » comme chemin alternatif au paiement. | Jamais démarré. C'est le seul puits de Crowns « hors Pro League » jamais conçu. |

Conclusion de la fouille : **tout ce qui touche aux pronostics et à la monnaie
vit dans la Pro League, et la Pro League est gelée.** Le wallet est monté sous
`/pro-league/me/wallet` (routes) et `/pro-league/me/wallet` (page web), donc en
prod personne ne voit son solde. La ligue de base (PvP, feuille de match) n'a
aucun pronostic, et c'est elle qui vit.

## 2. Les briques réutilisables (état du code)

```
                 EXISTE                                   MANQUE
 ┌──────────────────────────────────────────┐   ┌───────────────────────────────┐
 │ Crowns : ProWallet + ProTransaction      │   │ Un puits de Crowns hors       │
 │   (ledger BET/WIN/REWARD/DAILY/BADGE/    │   │ Pro League                    │
 │   SINK/ADMIN_*), debit/credit atomiques, │   │                               │
 │   console admin /admin/wallets/[userId]  │   │ Un wallet ATTEIGNABLE en prod │
 │                                          │   │ (il est sous le guard         │
 │ Pick'em Pro : ProPredictionPick (1N2),   │   │  PRO_LEAGUE_ENABLED)          │
 │   computeMatchResult, settlePicksForMatch│   │                               │
 │   en try/catch isolé (patron Q.D.1)      │   │ Tout le côté LIGUE :          │
 │                                          │   │  - modèle de pronostic        │
 │ Ligue : League.isPublic + league-access  │   │  - réglage de portée          │
 │   (règle pure isLeagueVisibleTo),        │   │  - clôture d'un marché sans   │
 │   LeaguePairing scheduled→in_progress→   │   │    heure de coup d'envoi      │
 │   played/forfeit_*/cancelled,            │   │  - règlement + reversion      │
 │   scheduledAt / deadlineAt               │   │  - classement + palmarès      │
 │                                          │   │                               │
 │ Entonnoir résultat : recordLeagueMatch-  │   │ Une notification              │
 │   Result (validation de feuille ET       │   │  « pronostics ouverts /       │
 │   forfait online), recordForfeit (cron), │   │    journée réglée »           │
 │   reverseOfflineLeagueResult             │   │                               │
 │   (invalidation + édition ex-post)       │   │                               │
 │                                          │   │                               │
 │ Gamification hors Pro : UserAchievement  │   │                               │
 │   (/me/achievements, catégorie "leagues")│   │                               │
 │   + LeagueSeasonAward.awards (palmarès   │   │                               │
 │   de saison : topScorer, basher, …)      │   │                               │
 │                                          │   │                               │
 │ UI : MatchCard partagée (slots meta /    │   │                               │
 │   actions), StandingsOrderField (réglage │   │                               │
 │   hors verrou d'édition), notifications  │   │                               │
 │   league.round_pairing / round_followup  │   │                               │
 └──────────────────────────────────────────┘   └───────────────────────────────┘
```

Deux différences de fond avec la Pro League, qui changent le produit :

1. **Pas de cotes.** Les cotes Pro League sortent d'une pré-simulation (200
   matchs) ; une rencontre sur table n'a rien à simuler. Sans cote, un « pari »
   à mise libre n'a pas de sens : on est sur du **pick'em à points**, comme
   `ProPredictionPick`, pas comme `ProBet`.
2. **Pas de coup d'envoi.** Un match de ligue se joue quand les deux coachs
   se voient. `scheduledAt` est optionnel, la feuille peut être ouverte des
   jours avant (journaliers, coups de pouce) et remplie après. La clôture doit
   être **dérivée** de plusieurs signaux (§4).

## 3. Portée × visibilité : qui peut pronostiquer

La visibilité (`isPublic`, résolue par `league-access`) est la porte
extérieure ; la portée est la porte intérieure. On ne réinvente rien : on
**compose** avec `isLeagueVisibleTo`.

```
                       Ligue PUBLIQUE                    Ligue PRIVÉE (404 pour les autres)
                ┌────────────────────────────┐   ┌────────────────────────────────────┐
 off            │ personne                   │   │ personne                           │
                ├────────────────────────────┤   ├────────────────────────────────────┤
 members        │ coachs de la saison        │   │ coachs de la saison + commissaire  │
 (défaut)       │ + commissaire              │   │                                    │
                ├────────────────────────────┤   ├────────────────────────────────────┤
 open           │ tout compte connecté ;     │   │ = members + invités en attente     │
                │ les anonymes LISENT         │   │   + admins (ceux qui la voient).   │
                │ (classement, picks clos)   │   │ Quasi identique à « members » :    │
                │ mais ne jouent pas         │   │ l'UI l'indique                     │
                └────────────────────────────┘   └────────────────────────────────────┘
```

Règle pure, une seule fonction (`canPredict`) qui rend un **motif** plutôt
qu'un booléen, pour que l'UI explique le bouton grisé :

```
canPredict({ viewer, league, membership, pairing, closesAt, now })
  → "ok" | "anonymous" | "league-hidden" | "predictions-off"
    | "not-member" | "own-match" | "closed"
```

- `members` = propriétaire d'une équipe **de la saison** de la rencontre
  (`LeagueParticipant.team.ownerId`, tout statut, un coach retiré peut
  continuer à jouer) ou commissaire (`creatorId`).
- `own-match` : un coach ne pronostique pas sa propre rencontre (§6, déc. 1).
- Le réglage est une **règle de lecture** : rien de persisté n'en dépend.
  Comme l'ordre de classement, il échappe au verrou `PATCH /leagues/:id`
  (route dédiée `PATCH /leagues/:id/predictions-scope`, commissaire OU admin,
  un seul schéma Zod, une seule écriture).

Stockage : `League.predictionsScope String?` à **trois états** (patron
`playoffsPublished`) — `null` = ligue antérieure, pronostics **off** ; le
formulaire de création écrit `"members"` par défaut. `db push` sans backfill
oblige : l'existant ne change pas de comportement au déploiement, et le
commissaire d'une ligue en cours voit un bandeau « Activer les pronostics ».
Pas besoin de feature flag global : l'opt-in par ligue EST le gate.

## 4. Le pronostic lui-même

### Ce qu'on prédit (v1)

| Champ | Obligatoire | Points |
|---|---|---|
| Vainqueur (`home` / `draw` / `away`) | oui | 3 si juste |
| Score exact en TD (`homeScore`, `awayScore`) | non | +2 si juste (donc 5 max) |

Un barème unique, pas de réglage par ligue en v1 (un réglage de plus, c'est
un réglage à afficher et à départager). Extensions naturelles en v2, très
Blood Bowl : « au moins une sortie », « un mort ? », « le total de TD est pair
ou impair »… Elles se lisent toutes dans le résumé de feuille existant
(`summarizeMatchSheet`), rien à ressaisir.

### Quand ça ferme

```
   publication      scheduledAt     1er évènement     1re soumission     résultat
   de la journée    (si posé)       sur la feuille    de la feuille      validé
        │               │               │                 │                │
   ─────┼───────────────┼───────────────┼─────────────────┼────────────────┼────▶ t
        │◀── OUVERT ───▶│               │                 │                │
                        └────────── closesAt = min(signaux présents) ──────┘
                                        + clôture manuelle du commissaire (journée)
```

- `closesAt` est **dérivé** par une fonction pure à partir du pairing, de la
  feuille et de la journée ; on ne stocke qu'une chose : la clôture manuelle
  (`LeagueRound.predictionsClosedAt`), parce que c'est la seule qui soit une
  décision.
- Le **premier évènement** consigné sur la feuille est le meilleur proxy du
  coup d'envoi (un coach qui remplit en direct) ; la **première soumission**
  couvre ceux qui remplissent après coup ; `scheduledAt` couvre les ligues
  organisées. L'un des trois suffit toujours.
- Avant clôture : on affiche seulement « 5 coachs ont pronostiqué ». Après :
  les picks nommés (respecter `User.privateProfile` → « Coach anonyme »).
  C'est ce qui rend la chose sociale (« tout le monde voyait les Orques
  gagner ») sans effet moutonnier avant.

### Règlement, forfait, annulation, invalidation

```
 recordLeagueMatchResult ──▶ $transaction (participants, pairing=played)
                             │
                             └─▶ settleLeaguePredictions(pairingId)     fire-and-forget,
                                   result = home|draw|away               try/catch isolé,
                                   points = scorePrediction(pick, score)  idempotent (settledAt)
                                                                          — même posture que
                                                                          runPostMatchLeagueSequence
 recordForfeit / cancelled ──▶ settle(pairingId, "void")  → 0 point, hors précision

 reverseOfflineLeagueResult ──▶ unsettleLeaguePredictions(pairingId)
                                   result/points/settledAt = null, picks CONSERVÉS
                                   (la re-validation re-règle)
```

Le classement est **dérivé** (`groupBy userId` sur les pronostics réglés de la
saison), jamais un compteur persisté : c'est la leçon « un correctif de calcul
ne corrige pas un compteur persisté » appliquée avant d'avoir le bug, et ce
qui rend l'invalidation triviale. Volumes : 16 coachs × 15 journées × 8
rencontres, on ne parle pas de performance.

Départage du classement (comparateur pur, patron `league-standings-order`) :
points → scores exacts → vainqueurs justes → nom.

### Palmarès et succès

- À `closeSeason`, une entrée `oracle` dans `LeagueSeasonAward.awards` (à côté
  de `topScorer`, `basher`…) : meilleur pronostiqueur de la saison. Le recap
  de saison l'affiche.
- Succès `UserAchievement` (nouvelle catégorie `predictions`) : premier
  pronostic juste, 10 justes, un score exact, Oracle d'une saison. Ils
  s'affichent déjà sur `/me/achievements`, zéro UI nouvelle.
- Notifications : pas de nouveau bruit « pronostics ouverts » — la
  notification `league.round_pairing` existante (journée publiée) porte une
  ligne « Les pronostics sont ouverts ». Une seule nouvelle sorte,
  `league.predictions_settled`, **par journée** et par joueur (« Journée 3 :
  7 pts, 2/4 »), jamais par match.

## 5. Les gains : points, Crowns ou po ?

Trois monnaies candidates, et elles ne servent pas la même chose :

| | Points de pronostic | Crowns | Pièces d'or (trésorerie d'équipe) |
|---|---|---|---|
| Existe ? | à créer, **dérivés** | oui (`ProWallet`), gelée | oui, cœur du jeu |
| Portée | une saison d'une ligue | tout le site | une équipe |
| Ça sert à… | classement, palmarès, succès, se chambrer | **rien aujourd'hui hors Pro League** | recruter, relancer, coups de pouce |
| Risque | aucun | monnaie fantôme, inflation sans puits | pay-to-win à l'intérieur de la ligue |
| Réversible à l'invalidation ? | oui, gratuitement (dérivé) | ledger append-only : reversion à écrire | non sans passer par le journal d'équipe |

### La réponse à « on commence à introduire de la monnaie ? »

**Pas avec la v1, et on ne perd rien à attendre.** Trois raisons :

1. Le wallet est **inatteignable en prod** (guard `PRO_LEAGUE_ENABLED`).
   Créditer des Crowns aujourd'hui, c'est créditer un solde que personne ne
   voit. Détacher le wallet de la Pro League est un change à part entière
   (routes `/me/wallet` hors du guard, page hors de `/pro-league`, garder le
   nom `ProWallet` — un renommage sous `db push` = DROP + CREATE).
2. **Aucun puits hors Pro League.** Les deux existants (dédicace au Hall of
   Fame à 500, entrée de tournoi à 100) sont gelés avec elle. C'est
   exactement l'objection : une monnaie sans dépense possible ne sert à rien.
3. Les points de pronostic sont **persistés par pronostic** (`points`,
   `settledAt`). Le jour où des puits existent, une conversion
   **rétroactive** (« 10 Crowns par point, plafond par saison ») est un
   `REWARD` idempotent par `(userId, seasonId)`. On peut donc décider plus
   tard sans rien perdre — et la Pro League a déjà montré que le nerf de la
   guerre était le puits, pas la source (les daily bonus ont forcé à inventer
   les dédicaces pour « prévenir l'hyperinflation »).

Le vrai gain d'un pronostic entre coachs d'une ligue IRL, c'est le **droit de
chambrer** : un classement à côté du classement sportif, un titre au palmarès,
un succès sur le profil. C'est gratuit, immédiat, et c'est ce que MPG vend.

### Si on veut des Crowns quand même : à quoi elles serviraient

Listés par rapport effort / valeur pour un coach de ligue, avec ce qu'ils
réutilisent. **Aucun n'est de l'or d'équipe** (voir le rejet plus bas).

| Puits | Ce que ça fait | Réutilise | Effort |
|---|---|---|---|
| **Article de Gazette sur MA rencontre** | Le « journaliste » écrit le récit de la rencontre à partir des évènements de la feuille (TD, sorties, prières, coup d'envoi) ; affiché sur la page de la ligue et partageable. Coût réel (tokens) ⇒ vrai puits, et une feature que les ligues IRL adoreraient. | `pro-gazette-llm.ts` (Haiku), `summarizeMatchSheet` | 2-3 j |
| **Joker de pronostic** | Doubler les points d'UN pronostic par journée. Le puits alimente la boucle qu'il vide. Plafonné à 1/journée sinon le classement s'achète. | rien de spécial | 1 j |
| **Épingle / chambrage** sur la page de ligue ou d'une rencontre | Message court épinglé (280 car.), 1 par coach et par rencontre. Copie conforme de la dédicace HoF. | `pro-hall-of-fame-dedicate.ts` (blocklist Q.B.2 comprise) | 1 j |
| **Cosmétiques** (cadre de logo, couleurs, titre « Oracle » affiché sur la page de partage `/teams/[slug]` et son image OG) | Le Season Pass de Sprint R sans le paiement. | design R.B.2 (`CosmeticPack`, `UserCosmeticUnlock`), `Team.logoUrl`, `ProTeam.primaryColor` comme modèle | 1-2 sem |
| Entrée en Crowns à la Nuffle Cup mensuelle | Comme les `ProTournament`. **Rejeté** : gater une vraie compétition derrière une monnaie exclut les nouveaux. | `pro-tournament-entry.ts` | — |
| **Or d'équipe (po)** | « Prime du bookmaker : +10 000 po au meilleur pronostiqueur de la journée ». **Rejeté en v1** : le meilleur pronostiqueur achète un meilleur roster, dans la ligue même où il joue ; et il faut passer par le journal d'équipe, la VE, l'invalidation… Si un jour c'est demandé, c'est une option par ligue, décidée par le commissaire comme le Coup de mécène, jamais un défaut. | `league-patron.ts` (mécène), `TeamAuditEvent` | — |

Lecture narrative qui tient les trois monnaies ensemble : **les po sont la
monnaie des coachs, les Crowns celle des tribunes.** C'est déjà ainsi que la
Pro League les a posées (gagnées en pariant, dépensées en dédicaces). Les
spectateurs d'une ligue ouverte (§3, `open`) sont précisément les tribunes.

### Gate proposée pour la phase 2 (Crowns)

- Le wallet est atteignable en prod (change « détacher le wallet de la Pro
  League », ~1 j).
- Au moins **deux** puits livrés, dont un à coût réel (l'article de Gazette).
- Un plafond d'émission par saison et par joueur (les points ne sont pas
  bornés par la richesse du joueur, contrairement aux mises).
- Ensuite seulement : conversion rétroactive des points déjà marqués, puis
  crédit au règlement de chaque journée.

## 6. Les six décisions de la session du 11 septembre — réponses proposées

| # | Question | Proposition | Pourquoi |
|---|---|---|---|
| 1 | Pronostiquer son propre match ? | **Non** (`own-match`). | Équité (chacun a N-1 rencontres) et anti-triche : le coach connaît le résultat avant la soumission. Le nombre de rencontres exemptes (bye) reste une petite asymétrie, acceptée. |
| 2 | Forfait : annulation ou victoire ? | **Annulation** (`void`, 0 point, hors précision). Idem `cancelled`. | Un forfait n'est pas un résultat sportif ; personne ne pouvait le prévoir. La Pro League a déjà le statut `void`. |
| 3 | Clôture auto ou manuelle ? | **Les deux** : dérivée (`min` des signaux, §4) + clôture manuelle par journée par le commissaire. | Sans heure de coup d'envoi fiable, la dérivation seule laisse des trous ; la manuelle seule repose sur la discipline du commissaire. |
| 4 | Mise plafonnée ? | **Sans objet** : pas de mise, un barème fixe. Si Crowns un jour : mise fixe par pronostic, jamais libre. | Sans cote, une mise libre revient à « all-in sur le favori ». |
| 5 | Le commissaire joue-t-il ? | **Oui**, comme tout membre, sauf sur les rencontres de sa propre équipe. | Il voit les feuilles soumises avant validation : la clôture au premier évènement / à la première soumission neutralise l'avantage. |
| 6 | « Paris » ou « pronos » ? | **« Pronostics »** partout. | Pas de mise, pas de cote, pas d'argent : le mot « paris » attire des contraintes (App Store, vocabulaire des jeux d'argent) pour rien. |

## 7. Esquisse technique (pour la proposition, pas pour coder ici)

**Modèle.** Nommer la table `CompetitionPrediction` dès le départ (comme
`CompetitionDocument`), avec `pairingId` maintenant et `cupPairingId` nullable
plus tard : une colonne s'ajoute sous `db push`, un renommage de modèle, non.

```
CompetitionPrediction {
  id, pairingId → LeaguePairing (cascade), userId → User (cascade)
  pick        "home" | "draw" | "away"
  homeScore?  Int, awayScore? Int
  result?     "home" | "draw" | "away" | "void"      ← null tant que non réglé
  points?     Int, settledAt? DateTime
  @@unique([pairingId, userId])  @@index([userId])  @@index([pairingId, settledAt])
}
League.predictionsScope      String?    // null = off (antérieur), "off" | "members" | "open"
LeagueRound.predictionsClosedAt DateTime?  // clôture manuelle
```

**Modules purs, testables sans Prisma** (convention du dépôt) :
`league-predictions-rules` (`canPredict`, `predictionClosesAt`,
`scorePrediction`, comparateur de classement). Le service Prisma
(`league-predictions`) ne fait qu'orchestrer.

**Routes** (toutes derrière `ensureVisibleSeason` / `ensureVisiblePairingLeague`,
lecture en `optionalAuthUser`, mutations `authUser` + `validate`) :

```
GET    /leagues/seasons/:seasonId/predictions              journées, closesAt, mon pick, compteurs, picks clos, motif d'inéligibilité
PUT    /leagues/pairings/:pairingId/prediction             upsert tant que ouvert
DELETE /leagues/pairings/:pairingId/prediction
GET    /leagues/seasons/:seasonId/predictions/leaderboard  dérivé (groupBy)
PATCH  /leagues/:id/predictions-scope                      commissaire OU admin, hors verrou (+ miroir /admin)
POST   /leagues/rounds/:roundId/predictions/close          commissaire
```

**Hooks** : `settleLeaguePredictions` appelé après la transaction de
`recordLeagueMatchResult` (les deux entrées : validation de feuille et
forfait online) et dans `recordForfeit` (void) ; `unsettleLeaguePredictions`
dans `reverseOfflineLeagueResult`. Jamais dans les motifs de refus de
reversion : un pronostic ne bloque pas une invalidation.

**Web** : panneau `LeaguePredictionsPanel` sur `/leagues/[id]` (composant
autonome avec son `/auth/me`, patron Q.B.3), puce « Ton prono : 1 (2-1) »
dans le slot `meta` de `MatchCard`, page complète
`/leagues/[id]/seasons/[sid]/predictions`, bloc de réglage
`PredictionsScopeField` partagé entre création, édition et panneau réduit
d'une ligue verrouillée (patron `StandingsOrderField`). Plus tard : widget
« Pronostics à faire » sur `/me` — c'est lui, le crochet de rétention.

```
 ┌─ Pronostics — Journée 3 (ferme dim. 21h ou au 1er coup d'envoi) ───────────┐
 │  Gones Kass'Krânes  vs  Orcs de Nuln        [1] [N] [2]   score  _ - _      │
 │  Skavens du Ruisseau vs Halflings du Pré    [1] [N] [2]   score  2 - 1  ✓   │
 │  Ta rencontre : Nains vs Elfes              — pas de pronostic sur son match │
 │  5 coachs ont pronostiqué · picks visibles à la clôture                     │
 ├─ Oracle de la saison ───────────────────────────────────────────────────────┤
 │  1. Marie   23 pts (4 scores exacts)   2. Karim 21   3. toi 17              │
 └─────────────────────────────────────────────────────────────────────────────┘
```

**Tests** : unitaires sur les modules purs ; tests de route en chaîne Express
réelle (référence `routes/league-access.test.ts`, la matrice portée ×
visibilité en table) ; une spec `tests/e2e-api/specs/leagues-predictions-flow.spec.ts`
qui rejoue : créer la ligue → publier la journée → pronostiquer → valider la
feuille → classement → invalider → classement revenu → revalider.

## 8. Découpage possible

| Lot | Contenu | Effort |
|---|---|---|
| 1 — serveur | modèle, modules purs, routes, hooks de règlement / reversion, tests, spec e2e-api | 3-4 j |
| 2 — web | panneau, puce MatchCard, page classement, réglage de portée (création / édition / panneau réduit), bandeau d'activation | 3 j |
| 3 — palmarès & succès | `oracle` au palmarès, succès `predictions`, notification par journée | 1-2 j |
| 4 — coupes | `cupPairingId`, même service, exempts et placeholders (`home === away`) non pronosticables | 2 j |
| Phase 2 — Crowns | détacher le wallet ; article de Gazette ; joker ; conversion rétroactive | 1 j + 2-3 j + 1 j + 1 j |

## 9. Questions encore ouvertes

- **Classement unique ou « coachs » / « tribunes »** en mode `open` ? Les
  spectateurs pronostiquent toutes les rencontres, les coachs N-1. Un seul
  classement avec filtre me paraît suffire, et le titre `oracle` du palmarès
  pourrait rester réservé aux coachs.
- **Nul à 3 points aussi ?** Le nul est rare en Blood Bowl ; un barème plat
  est plus lisible, mais un « nul à 4 » ferait jouer les audacieux.
- **Faut-il montrer la distribution des picks avant clôture** (« 60 % sur les
  Orques ») ? Non par défaut : ça oriente. À reconsidérer si l'engagement est
  faible.
- **Un coach retiré (`withdrawn`) reste-t-il membre ?** Proposé oui (il suit
  encore sa ligue). À trancher avec les premiers retours.
