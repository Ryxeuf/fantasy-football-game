# Design — pronostics de ligue

## Un pick'em, pas un pari

La Pro League calcule ses cotes en pré-simulant 200 matchs. Une rencontre
jouée sur table n'a rien à simuler : sans cote, une mise libre revient à
« tout sur le favori ». Le modèle retenu est donc celui de
`ProPredictionPick` (un choix par rencontre, des points au résultat), pas
celui de `ProBet`.

| Pronostic | Points |
|---|---|
| Bon vainqueur, ou bon nul | 3 |
| Score exact en plus | +2 |
| Faux | 0 |
| Rencontre forfaite, annulée, ou forfait en ligne | hors classement |

Le score est optionnel mais doit être COHÉRENT avec le vainqueur choisi
(`2-1` avec « extérieur » est refusé) : sans cette règle, un score exact
pourrait valoir 2 points avec un vainqueur faux, et le barème cesserait de se
lire d'un coup d'œil.

## Données

```prisma
model CompetitionPrediction {
  pairingId        String   // LeaguePairing, cascade
  userId           String   // User, cascade
  pick             String   // home | draw | away
  homeScore        Int?     // score prédit (optionnel, les deux ou aucun)
  awayScore        Int?
  result           String?  // null = en attente ; home | draw | away | void
  resultHomeScore  Int?     // score RÉEL, copié au règlement
  resultAwayScore  Int?
  settledAt        DateTime?
  @@unique([pairingId, userId])
}
League.predictionsScope          String?   // null = ligue antérieure ⇒ off
LeaguePairing.predictionsClosedAt DateTime? // write-once
LeagueRound.predictionsNotifiedAt DateTime? // write-once (notification)
```

- **Le nom est générique dès le départ.** `LeagueMatchSheet` a gardé son nom
  en devenant polymorphe parce qu'un renommage de modèle sous `db push` est
  un DROP + CREATE. Les coupes ajouteront un `cupPairingId` nullable ; le
  service restera le seul chemin d'écriture (patron `CompetitionDocument`).
- **On stocke le RÉSULTAT, pas les points.** Les points et la note
  (`exact` / `outcome` / `wrong`) sont recalculés à la lecture par le module
  pur. Changer le barème ne laisse aucun compteur périmé derrière lui — la
  leçon de « un correctif de calcul ne corrige pas un compteur persisté ».
- **Trois colonnes nullables, aucune par défaut.** `db push` pose `null` sur
  l'existant : pronostics coupés sur toute ligue antérieure, rencontres non
  closes, journées jamais notifiées. `createLeague` écrit `members`.

## Où se règlent les pronostics

L'exploration envisageait de dériver le résultat à la lecture. Le code l'en
empêche : `Match` n'a pas de colonnes de score, le score vit dans le
snapshot de la feuille (`LeagueMatchSheet.scoreHome/Away`) OU dans
l'instantané de saisie (`Match.offlineResultInput`), selon le chemin. Une
dérivation devrait savoir lequel fait foi, et divergerait à la première
édition ex-post.

L'entonnoir, lui, est unique : TOUT résultat de ligue passe par
`recordLeagueMatchResult`, qui reçoit les deux scores. Le règlement s'y
branche, après la transaction :

```
recordLeagueMatchResult ──▶ $transaction (compteurs, pairing = played)
                            └─▶ settleLeaguePredictionsForResult   (awaité, try/catch)
                                  un updateMany par rencontre : result + score réel
                                  + predictionsClosedAt s'il était vide

reverseOfflineLeagueResult ──▶ $transaction (pairing = scheduled)
                               └─▶ unsettleLeaguePredictions (updateMany → null)
                                     la clôture, elle, RESTE : le résultat a été vu
```

- **Awaité, pas fire-and-forget** : la validation d'une feuille rend la main
  quand le classement des pronostics est à jour (tests e2e déterministes),
  et un échec est journalisé sans remettre en cause le résultat committé.
- **Les côtés se lisent par participant**, pas par la convention « A =
  domicile » de l'entonnoir : `settle` reçoit `{ participantId, score }` et
  les place lui-même sur le pairing.
- **Forfaits et annulations ne s'écrivent pas** : le statut du pairing
  (`forfeit_*`, `cancelled`) suffit à les sortir du classement. Seul le
  forfait EN LIGNE, qui passe par l'entonnoir avec un score synthétique,
  est marqué `void` (`RecordMatchResultInput.forfeit`).
- **L'édition ex-post** est une reversion suivie d'une saisie : elle règle
  à nouveau, sans code de plus.

## La clôture

```
closed = statut terminal                 (played, forfeit_*, cancelled)
      || predictionsClosedAt posé        (write-once)
      || scheduledAt passé               (relu à chaque lecture)
      || journée de play-off non publiée || ligue archivée
```

`predictionsClosedAt` s'écrit au premier évènement de la feuille (`addEvent`),
à la première soumission (`submitByCoach`), au résultat, et par la clôture
manuelle — `updateMany … where predictionsClosedAt: null`, donc une seule
fois. Une clôture recalculée depuis la feuille se rouvrirait : `removeEvent`
et `unsubmitByCoach` existent.

La date prévue reste une PRÉVISION relue à chaque fois. Sur une ligue datée,
le calendrier la cale sur le début de la journée (`computeRoundDates`), ce qui
donne « fermé au début de la journée » sans code dédié ; un report
(`schedulePairing`) déplace la clôture avec lui.

Clôture manuelle : le commissaire (ou un admin) ferme une journée entière ;
les deux coachs d'une rencontre, le commissaire ou un admin ferment une
rencontre (« Coup d'envoi », le filet des soirées en club).

## Qui peut pronostiquer

Une règle pure, `predictionEligibility`, rend un MOTIF plutôt qu'un booléen,
pour que l'écran explique un bouton grisé :

```
ok | anonymous | predictions-off | not-member | own-match | placeholder | closed
```

La visibilité est tranchée AVANT, par `services/league-access` : une ligue
privée invisible répond 404 sur toutes les routes, lecture comme écriture.

| Portée | Peut pronostiquer |
|---|---|
| `off` (ou `null`) | personne |
| `members` | propriétaire d'une équipe ACTIVE de la saison, commissaire |
| `open` | tout compte connecté qui voit la ligue |

Sur une ligue privée, `open` ne s'étend qu'à ceux qui la voient déjà
(invités, admins) : l'écran le dit.

La portée est une règle de LECTURE : rien de persisté n'en dépend. Comme
l'ordre du classement, elle échappe au verrou d'édition —
`PATCH /leagues/:id/predictions-scope` (commissaire ou admin) — et le panneau
réduit d'une ligue verrouillée la sert.

## Ce qui est montré, et quand

Avant la clôture : RIEN des pronostics des autres, pas même leur nombre ; le
serveur ne les met pas dans la réponse. Après : les choix nommés, leur
répartition, et la note de chacun une fois réglés. Un compte au profil privé
qui n'est ni coach de la saison ni commissaire apparaît « Coach anonyme ».

Les journées de play-off non publiées suivent la règle du calendrier (« gater
un contenu, c'est gater TOUTES ses lectures ») : absentes pour qui n'est pas
commissaire, et fermées aux pronostics pour tous.

## Classement : deux onglets, une fonction

`computePredictionLeaderboard` (pur) agrège les pronostics RÉGLÉS de la
saison, par utilisateur, et classe dans chaque groupe : points → scores
exacts → bons résultats → nom. Le groupe n'est pas stocké : Coachs si
l'utilisateur possède une équipe ACTIVE de la saison, Tribunes sinon
(commissaire sans équipe, coach retiré avec ses points acquis, spectateurs).
Un coach pronostique N-1 rencontres par journée, une tribune N : les mettre
dans un même tableau favoriserait les tribunes de 14 % (16 équipes) à 50 %
(6 équipes).

## Gains

- **Palmarès** : `SeasonAwardsCatalogue.oracle`, le premier de l'onglet
  Coachs (ex æquo compris), au format des autres distinctions
  (`SeasonAwardEntry`, valeur = points). Calculé par `computeSeasonRecap`,
  donc persisté par `closeSeason` et servi en direct par le récap avant la
  clôture. Un échec du calcul rend une liste vide : un palmarès se sert
  toujours.
- **Succès** (catégorie `predictions`, évalués paresseusement comme les
  autres) : premier pronostic juste, 10 justes, un score exact, Oracle d'une
  saison, Oracle des tribunes. Les deux derniers se lisent sur les saisons
  CLÔTURÉES, avec la même fonction que le palmarès.
- **Notification** `league.predictions_settled`, UNE par journée et par
  joueur, quand la journée se complète (résultat ou forfait) :
  « Journée 3 : 7 pts, 2 bons résultats sur 3 ». `predictionsNotifiedAt`
  empêche un second envoi après une invalidation suivie d'une nouvelle
  saisie.

## Routes

Module `routes/league-predictions.ts`, monté sur `/leagues` à côté des
autres routeurs de ligue (le fichier `routes/league.ts` dépasse 3 600
lignes).

| Route | Accès |
|---|---|
| `GET /leagues/seasons/:seasonId/predictions` | `optionalAuthUser`, ligue visible |
| `GET /leagues/seasons/:seasonId/predictions/leaderboard` | `optionalAuthUser`, ligue visible |
| `PUT /leagues/pairings/:pairingId/prediction` | `authUser` + `validate`, éligible |
| `DELETE /leagues/pairings/:pairingId/prediction` | `authUser`, son pronostic, rencontre ouverte |
| `POST /leagues/pairings/:pairingId/predictions/close` | coach de la rencontre, commissaire, admin |
| `POST /leagues/rounds/:roundId/predictions/close` | commissaire, admin |
| `PATCH /leagues/:id/predictions-scope` | commissaire, admin ; hors verrou |

Erreurs typées (`LeaguePredictionError`) : 404 introuvable ou invisible, 403
non autorisé (portée, membre, sa rencontre), 409 fermé ou non pronostiquable,
400 saisie invalide.

## Tests

- Modules purs sans Prisma : éligibilité (matrice portée × lecteur), clôture,
  note et points, cohérence score / vainqueur, classement et groupes.
- Service avec Prisma mocké : upsert, suppression, lecture (rien des autres
  avant la clôture), règlement et reversion, notification idempotente.
- Routes en chaîne Express réelle avec de vrais JWT (patron
  `routes/league-access.test.ts`) : 401, 403, 404 d'une ligue privée, 409.
- Hooks : la feuille pose la clôture ; l'entonnoir règle ; la reversion
  dérègle.
- Spec e2e-api `leagues-predictions-flow.spec.ts` : pronostiquer, valider,
  classement, invalider, classement revenu, revalider, portée ouverte,
  palmarès et succès.
