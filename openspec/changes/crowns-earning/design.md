# Design — les Couronnes se gagnent en jouant

## Context

Motivation : voir `proposal.md`. Exigences : `specs/crowns/spec.md`.

État du code qui contraint l'approche :

- **Wallet** : `ProWallet.crowns` + journal `ProTransaction { type, amount,
  ref? }` (`services/pro-wallet`). `credit` / `creditInTx` incrémentent,
  `debit` / `debitInTx` décrémentent sous condition. `ProTransaction.ref`
  n'est pas unique et porte un historique Pro League.
- **Lecture** : `GET /crowns/me` (`routes/crowns.ts`, monté derrière
  `requireFeatureFlag(CROWNS_FLAG)`) sert solde + 20 opérations ; le web la
  lit au montage (`contexts/CrownsContext`, pastille du menu).
- **Feuilles** : `LeagueMatchSheet` est polymorphe (`pairingId` XOR
  `cupPairingId`). `status` vaut `validated` puis `invalidated` ; `validatedAt`
  RESTE renseigné après une invalidation — le statut fait foi. Le côté d'une
  ligue se lit par `LeaguePairing.home/awayParticipant.team.ownerId`, la
  saison par `round.seasonId` ; une coupe par `CupPairing.home/awayTeam.ownerId`
  et `round.cupId`.
- **Succès** : `UserAchievement { userId, slug }`, débloqués paresseusement
  par `GET /achievements` ; catalogue en code (`ACHIEVEMENTS_CATALOG`). Les
  succès de matchs (joués, victoires, TD, sorties) ne lisent que le jeu en
  ligne.
- **Bonus de bienvenue** : `grantFirstTimeBonus` (`pro-wallet-rewards`,
  1000, `REWARD` réf. `first_signup`), servi par une route Pro League gelée.
- **Dette** : `grantFirstTimeBonus`, `claimDailyBonus`,
  `pro-hall-of-fame-dedicate` et `pro-tournament-entry` écrivent encore
  `crowns: current ± montant` après lecture.
- **Pas de table de configuration générique** (`RulesetConfig` est typée par
  ruleset) ; `prisma/migrations/` est gitignoré, la prod passe par `db push`.

## Goals / Non-Goals

**Goals :**

- Créditer feuilles validées, succès et bonus de bienvenue par UN seul
  chemin, idempotent, rétroactif et sûr en concurrence.
- Ne toucher ni au service de feuille de match, ni à la chaîne de résultats.
- Rendre chaque crédit explicable (coach) et traçable (admin).

**Non-Goals :**

- Pronostics, palmarès, notifications de gain, barème éditable (suites).
- Étendre les succès de matchs aux feuilles.
- Ouvrir le flag `crowns` : ce change reste en recette.

## Decisions

### D1 — Rattrapage à la LECTURE du solde, pas crédit à la validation

`GET /crowns/me` appelle `reconcileCrownsRewards(userId)` avant de lire le
solde. Le rattrapage calcule ce qui est dû, retire ce qui est déjà au
registre, et crédite le reste.

- *Alternative écartée : crédit dans la validation de feuille.* Il faudrait
  s'insérer dans un service de ~4 000 lignes et dans la chaîne des résultats
  (le piège d'import des pronostics : un module lourd importé par la chaîne
  court-circuite les mocks), puis écrire à part le rattrapage de l'historique
  et celui des succès débloqués ailleurs. Trois chemins pour une règle.
- *Alternative écartée : cron.* Le repo préfère « le lecteur paie »
  (snapshots de carrière, rattrapage des sorties).
- *Conséquence acceptée* : un gain apparaît à la lecture suivante du solde
  (montage de l'app, profil, boutique), pas à la seconde de la validation.
- Le flag est porté par la route : flag fermé ⇒ aucun rattrapage, et
  l'ouverture crédite l'historique au premier passage.

### D2 — Un registre dédié, à clé de source UNIQUE et globale

Nouvelle table `CrownsReward` :

| Champ | Rôle |
|---|---|
| `sourceKey` (unique) | `sheet:<sheetId>:home\|away`, `achievement:<userId>:<slug>`, `signup:<userId>` |
| `userId` | bénéficiaire |
| `kind` | `sheet` \| `achievement` \| `signup` |
| `periodKey` | `season:<id>` \| `cup:<id>` pour une feuille, `null` hors plafond |
| `amount` | versé (≥ 0 ; 0 = plafonné ou marqueur « déjà perçu ») |
| `baseAmount` | barème avant plafond |
| `transactionId` | opération du passage, lignes plafonnées comprises (`null` si le passage n'a rien versé) |
| `createdAt` | — |

Index `(userId, periodKey)` (plafond) et `(userId, createdAt)` (admin).

- **Clé de feuille par CÔTÉ, sans l'utilisateur** : un côté ne paie qu'une
  fois, même si l'équipe change de propriétaire — le nouveau propriétaire
  tombe sur une clé déjà prise.
- *Alternative écartée : un index unique sur `ProTransaction.ref`.* Des
  doublons historiques de la Pro League feraient échouer le `db push`, et un
  passage agrège plusieurs récompenses en une opération (D3).
- Nouvelle table, colonnes neuves : rien à backfiller.

### D3 — Un passage = une transaction = une opération du journal

1. Hors transaction : `getOrCreateWallet(userId)` (posture existante) et
   chargement des candidats (D5-D7).
2. Plan PUR (D4) : lignes à écrire, montant total.
3. Transaction interactive : création de l'opération `REWARD` réf.
   `rewards:<cuid>` si total > 0, création des lignes du registre (rattachées
   à l'opération), incrément du wallet.
4. P2002 sur une clé ⇒ un passage concurrent l'a déjà écrite ⇒ la
   transaction entière est annulée et la lecture sert le solde courant.

Les lignes à 0 (plafonnée, bonus déjà perçu) s'écrivent aussi : elles ne
sont plus jamais réévaluées (même règle que les refus définitifs du
rattrapage des sorties). Elles sont rattachées à l'opération du passage
quand il en existe une, pour que le détail servi au journal compte les
plafonnées ; un passage qui ne verse rien n'écrit pas d'opération.

### D4 — Règles PURES dans `services/crowns-rewards-rules`

Barème (constantes, **valeurs de départ à calibrer en recette**) :

| Constante | Valeur |
|---|---|
| `SHEET_REWARD` | 25 |
| `ACHIEVEMENT_REWARD` | 50 |
| `SIGNUP_BONUS` | 250 |
| `SEASON_SHEET_CAP` | 500 (≈ 20 feuilles ; une saison normale n'y arrive pas) |

Le module construit les clés et `planCrownsRewards(candidates, earnedByPeriod)`
applique le plafond dans un ordre DÉTERMINISTE (date de validation, puis id
de feuille) : à entrée égale, plan égal — testable sans Prisma.

- *Alternative écartée : barème éditable en admin.* Il n'existe pas de table
  de configuration générique ; en créer une pour quatre entiers alourdirait
  le lot. Le calibrage se fait par une ligne de code ; l'édition admin est
  une suite.

### D5 — Éligibilité d'une feuille

Une requête `leagueMatchSheet.findMany` sur `status = "validated"` avec un
`OR` sur les quatre chemins de propriété (domicile/extérieur × ligue/coupe),
`select` minimal (id, `validatedAt`, propriétaires des deux côtés, saison ou
coupe). Un côté est éligible si son propriétaire est le coach ET que l'autre
côté n'est pas au même compte. Puis UNE lecture du registre sur les clés
candidates (`sourceKey in [...]`) et une agrégation `groupBy` des montants
déjà versés par `periodKey` pour le plafond.

### D6 — Succès : les lignes persistées, rien de plus

`UserAchievement` du coach ∩ slugs de `ACHIEVEMENTS_CATALOG`. Pas de crochet
dans `unlockAchievements` : un succès débloqué par `GET /achievements` est
ramassé à la lecture suivante du solde.

### D7 — Bonus de bienvenue : un seul bonus, deux chemins qui se reconnaissent

- Le rattrapage verse `SIGNUP_BONUS` sous la clé `signup:<userId>`, sauf si
  une opération `REWARD` réf. `first_signup` existe : il écrit alors un
  marqueur à 0 (une seule vérification, jamais répétée).
- `grantFirstTimeBonus` (route Pro League gelée) refuse désormais aussi
  quand le registre porte un bonus versé : si la Pro League rouvre, un coach
  ne touche pas les deux.

### D8 — Best-effort et anti-rafale

- Appel au rattrapage dans un `try/catch` au point d'appel : la garantie
  « le solde se sert toujours » vit là (posture de `healSeasonCasualties`).
- Débounce en mémoire par coach (60 s en prod, 0 en test) : la pastille
  lue au montage ne relance pas quatre requêtes à chaque navigation. Une
  instance par processus suffit : le rattrapage est idempotent.

### D9 — Détail servi au journal, champ optionnel

Pour chaque opération `REWARD` dont la réf. commence par `rewards:`,
`GET /crowns/me` ajoute `rewards?: { sheets, achievements, signup, capped }`,
lu en UNE requête sur le registre (`transactionId in [...]`). Champ
optionnel côté web (patron « backwards-compat » K). `describeCrownsTransaction`
reconnaît la réf. ; une opération `REWARD` sans cette réf. reste « Bonus de
bienvenue » (historique Pro League).

La réponse porte aussi le barème en vigueur (`schedule`) : le bloc « Comment
gagner des Couronnes » l'affiche tel quel au lieu de recopier des montants qui
divergeraient au premier calibrage.

### D10 — Lecture admin

`GET /admin/coach-cosmetics/:userId/crowns-rewards` (`adminOnly`, 50 plus
récentes) dans le routeur admin des cosmétiques, affichée sur
`/admin/coach-cosmetics/[userId]`.

### D11 — Dette des écrivains du wallet

Les quatre écrivains passent à `{ increment }` / au décrément conditionnel
(`updateMany where crowns >= montant`, 0 ligne ⇒ `InsufficientFundsError`),
dans leurs transactions existantes. Aucun changement de comportement attendu
hors concurrence.

## Risks / Trade-offs

- [Pic d'émission à l'ouverture : tout l'historique d'un coup] → plafond par
  saison, flag encore en recette ; mesurer avec la métrique « Crowns
  inflation » de l'analytique admin avant d'ouvrir.
- [Deux passages concurrents sur des candidats DIFFÉRENTS d'une même saison
  peuvent dépasser le plafond d'une récompense] → fenêtre de quelques
  millisecondes, au pire 25 Couronnes ; accepté. Les candidats identiques
  sont couverts par P2002.
- [Le côté d'une feuille est payé au propriétaire ACTUEL de l'équipe, pas à
  celui du jour du match] → cas rare (transfert d'équipe) ; la clé globale
  empêche tout double versement.
- [Premier passage volumineux pour un coach très actif] → quelques centaines
  de lignes dans une transaction, acceptable ; découpage par lots possible
  plus tard sans changer le registre.
- [Une ligne plafonnée à 0 n'est pas reprise si le plafond augmente] →
  documenté ; l'admin peut compenser par un ajustement.
- [Gain visible à la lecture suivante seulement] → le web relit le solde au
  montage et sur le profil ; pas de temps réel recherché.

## Migration Plan

1. `db push` crée `CrownsReward` (joué par `scripts/deploy.sh`) ; aucune
   donnée existante modifiée.
2. Déploiement avec `crowns` fermé : rien n'est crédité.
3. Recette (override par compte, bypass admin) : vérifier le premier passage
   d'un compte réel, le plafond, le journal, l'écran admin.
4. Ouverture du flag : chaque coach est crédité de son historique à sa
   première lecture.

Retour arrière : refermer `crowns` arrête toute émission ; les lignes du
registre restent (elles empêchent un double versement à la réouverture) ;
l'admin corrige un solde par l'ajustement existant.

## Open Questions

- Valeurs du barème (D4) : à calibrer en recette sur le rythme réel de
  feuilles validées — elles ne changent ni les specs ni les tâches.
