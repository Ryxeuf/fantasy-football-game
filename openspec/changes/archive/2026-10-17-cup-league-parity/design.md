# Design — une coupe offre ce qu'offre une ligue

## Context

- La feuille de match est commune (`LeagueMatchSheet` polymorphe ligue XOR
  coupe) ; une coupe se joue en résurrection : chaque rencontre rejoue le
  roster d'INSCRIPTION (`CupParticipant.rosterSnapshot`) et la validation
  n'écrit rien sur les équipes. Le résultat est matérialisé en `LocalMatch`
  + `LocalMatchAction`, dont dérivent classement, podiums et tops joueurs.
- `GET /cup/:id` sert toute coupe (privée comprise) à tout compte connecté :
  noms, classement, tops par joueur. La visibilité des coupes privées n'a
  pas été tranchée (cf. CLAUDE.md, « Une ligue PRIVÉE est INVISIBLE »).
- Les pronostics de ligue tiennent en un module PUR (`league-predictions-
  rules` : portée, saisie, note, clôture, éligibilité, classement), un cœur
  léger, un service exposé aux routes et un module de règlement appelé par
  l'entonnoir des résultats. `CompetitionPrediction` ne connaît que
  `LeaguePairing`.
- `prisma/migrations/` est gitignoré (prod = `db push`) : aucune colonne
  ajoutée ne peut être backfillée.

## Decisions

### 1. La fiche de roster de coupe montre le roster d'INSCRIPTION

C'est lui que joue chaque rencontre ; l'équipe en direct a pu vivre ailleurs
(ligue, autre coupe) et n'a aucun rapport avec la coupe. Repli sur l'équipe
en direct pour un participant historique sans snapshot, ANNONCÉ par la fiche
(`source: "live"`). Les statistiques sont celles de la coupe, avec la
définition des gestes des classements individuels (`cupActorGesture`). « MJ »
d'un joueur = rencontres de l'équipe : en résurrection, le roster inscrit
joue chaque rencontre. Un Star Player inscrit est une ligne du roster ; ses
gestes se regroupent par slug (`star-<side>-<slug>` change de côté d'une
rencontre à l'autre).

Alternative écartée : servir l'équipe en direct comme la ligue — la fiche
montrerait des joueurs morts ou recrutés depuis, qui ne jouent pas la coupe.

### 2. Même porte que `GET /cup/:id`

Toute personne connectée qui voit la coupe voit ses rosters : la coupe sert
déjà, à tout compte, les noms, le classement et les tops PAR JOUEUR. Exiger
d'être inscrit (règle de la ligue) masquerait un roster dont les joueurs
sont déjà nommés sur la même page. Le jour où la visibilité des coupes
privées sera tranchée, la fiche suivra la même garde.

### 3. Une seule mise en page de fiche, une seule méta d'affichage

`components/TeamRosterPanel` (web) et `services/team-roster-view` (serveur :
race, libellés de poste, valeur d'un joueur, règles spéciales, Ligue
retenue) sont partagés : deux fiches qui annoncent des valeurs différentes
pour la même équipe seraient un bug. La coupe ne fait que RETIRER ce qui
n'existe pas chez elle (trésorerie, blessures, disponibilité).

### 4. Pronostics : la prédiction devient polymorphe, pas une seconde table

`CompetitionPrediction` gagne `cupPairingId` (et `pairingId` devient
nullable), patron de `LeagueMatchSheet` / `CompetitionDocument`. Les règles
pures sont réutilisées TELLES QUELLES (barème, note, éligibilité, classement,
anonymisation, « rien avant la clôture »). Seuls changent :

- **appartenance** : commissaire + propriétaires d'une équipe inscrite
  (`CupParticipant` n'a pas de statut de retrait : tout inscrit est actif) ;
- **rencontres non pronosticables** : l'exempt (`awayTeamId: null`) n'est
  pas servi ; le placeholder de bracket (`home === away`) est servi
  `placeholder` ;
- **play-offs non publiés** (`Cup.playoffsPublished === false`) : rondes
  `playoff` masquées hors commissaire et fermées, comme en ligue ;
- **forfait** : une feuille de coupe validée avec `forfeitSide` est réglée
  `void` (la rencontre reste « jouée » côté coupe, l'issue sportive n'est pas
  un résultat de terrain) ;
- **portée** : `Cup.predictionsScope` sans `@default` — `null` (coupe
  existante) = `off`, `POST /cup` écrit `members` sauf choix contraire ;
  modifiable à tout moment par le commissaire (règle de lecture).

Les lectures qui suivaient `pairing → round → season` (statistiques de
succès, classement de saison) filtrent `pairingId: { not: null }` : une
prédiction de coupe n'entre pas dans une saison de ligue. Le titre d'Oracle
et les succès restent ceux des saisons de ligue (suite possible).

Crochets, tous best-effort (la saisie ou la validation est committée) :
clôture au 1er évènement et à la 1re soumission (`ctx.kind === "cup"`),
règlement dans la validation de coupe, dérèglement à l'invalidation, bilan
de ronde quand une ronde se complète (`CupRound.predictionsNotifiedAt`
réclamé avant l'envoi, une fois).

### 5. Feuilles à valider : une page, deux compétitions

Le serveur liste déjà les feuilles de coupe du commissaire. La page « Matchs
à valider » devient un composant (`PendingValidationsView`) monté sous
`/leagues/[id]/` ET `/cups/[id]/`, filtré sur `kind` + id. La notification
résout les noms et le lien selon la compétition. Les cartes de ronde lisent
le statut de la feuille (`matchSheet.status`) servi par `listCupRounds`.

### 6. Statistiques : une route, une page

`GET /cup/:id/leaderboards?topN=` (1-50) sert les classements individuels
(`computeCupPlayerLeaderboards(…, topN)`) et les podiums par équipe ; la
page `/cups/[id]/stats` offre le choix du top N. Pas de « future star » ni
de MVP (ni PSP ni MVP en coupe).

### 7. Calendrier

« Mes prochains matchs » réutilise la sélection pure de la ligue, adaptée à
la forme des rencontres de coupe. La relance d'une ronde réutilise le module
pur `league-round-followup`. La date convenue notifie l'adversaire comme en
ligue.

## Risks / Trade-offs

- **`pairingId` nullable** : toute lecture qui suivait `pairing` sans garde
  casserait sur une prédiction de coupe → recensement des lectures
  (`league-predictions-core`, `league-predictions`, `achievements`) et
  filtre explicite.
- **Client SQLite régénéré** : le client de test est versionné ; il est
  régénéré depuis le miroir, comme pour chaque colonne.
