# Le Fan Dévoué offert est réservé aux équipes de ligue

## Why

Le premier Fan Dévoué gratuit est une règle de LIGUE. Une équipe construite
hors compétition (amical, entraînement contre l'IA) ou pour une coupe n'en a
pas : elle part de 0 Fan Dévoué et paie chacun des siens.

Le site l'accorde aujourd'hui à TOUTES les équipes, sans regarder où elles
jouent :

- `POST /team/build` pose `dedicatedFans = 1` par défaut et ne facture que
  `max(0, n − 1)` fans, coupe comprise (`cupId`) ;
- `POST /team/create-from-roster`, l'équipe d'entraînement de l'IA et les
  équipes de test écrivent `dedicatedFans: 1` en dur ;
- le minimum est 1 partout (schémas Zod, éditeur de staff, réglages du
  commissaire) et chaque calcul de coût retire un fan gratuit
  (`team-budget-summary`, sauvegarde de roster, builder web, `staff-cost`,
  page de partage `/r/[token]`, fiche d'équipe) ;
- la feuille de match locale remplace 0 fan par 1 (`dedicatedFans || 1`).

Conséquence : une équipe de coupe ou d'amical a un Fan Dévoué de trop au
Facteur de Popularité, et 5 000 po (20 000 po en Sevens) de budget en plus à
la construction.

La difficulté : une équipe ne sait pas à la construction si elle jouera en
ligue. Le builder ne connaît que la coupe (`cupId`) ; une équipe de ligue est
construite seule, puis inscrite à une saison.

## What Changes

- **Construction : 0 Fan Dévoué par défaut, chacun se paie.** Builder,
  création depuis un roster, équipe de l'IA, coupe ou pas. Le minimum passe à
  0 ; le plafond (6) et le prix unitaire (config staff du roster × format)
  ne changent pas.
- **Le fan offert est accordé au DÉMARRAGE de la première saison de ligue**
  de l'équipe (`startSeason`, et `regenerateSchedule` qui démarre aussi une
  saison) : +1 Fan Dévoué, une seule fois dans la vie de l'équipe. Une équipe
  déjà au plafond reçoit le prix d'un fan en trésorerie, ce qui revient au
  même que de l'avoir construite selon la règle de ligue. Chaque octroi est
  journalisé (`TeamAuditEvent`).
- **Un marqueur à trois états** sur l'équipe, `Team.leagueFreeFan Boolean?` :
  `null` pour une équipe antérieure à la règle (son fan offert est déjà
  compté), `false` pour une équipe neuve qui ne l'a pas encore reçu, `true`
  une fois qu'elle l'a reçu. C'est la CRÉATION qui écrit `false`, sans
  `@default` : aucune équipe existante ne change.
- **Une seule règle de calcul**, pure et partagée par le serveur et le web
  (`@bb/game-engine`) : fans compris dans le compte, fans payés, coût d'achat,
  minimum de l'équipe et plan d'octroi. Tous les calculs `n − 1` en dérivent.
- **0 est un compte légitime** : plus de repli `|| 1` au Facteur de
  Popularité.
- **Écrans** : le builder annonce la règle à côté de la ligne « Fans
  dévoués » et facture chaque fan ; la fiche d'équipe d'une équipe qui n'a pas
  reçu son fan offert l'annonce (« offert au démarrage d'une saison de
  ligue ») ; l'éditeur de staff et les réglages du commissaire appliquent le
  minimum de l'équipe (0 ou 1).

## Capabilities

### New Capabilities

- `team-dedicated-fans` : nombre de Fans Dévoués à la construction, fan
  offert des équipes de ligue (moment, unicité, plafond, journal), coût des
  fans achetés, minimum par équipe, Facteur de Popularité sans repli.

### Modified Capabilities

- `commissioner-team-settings` : le minimum des fans dévoués est celui de
  l'équipe (1 si son fan offert est compté, 0 sinon), et non plus 1 en dur.

## Impact

- **Base** : `Team.leagueFreeFan Boolean?` (sans `@default`) dans
  `prisma/schema.prisma` et le miroir `apps/server/prisma/sqlite/schema.prisma`.
  `Team.dedicatedFans @default(1)` est CONSERVÉ : couplé à `leagueFreeFan =
  null`, il garde la sémantique historique pour tout chemin de création qui
  n'aurait pas été mis à jour (seeders, endpoints de test).
- **Moteur** : `packages/game-engine/src/rosters/dedicated-fans.ts` (pur).
- **Serveur** : `routes/team-build-handler`, `routes/team-create-from-roster-handler`,
  `routes/team-roster-save-handler`, `routes/team-mutation-handlers`,
  `services/team-budget-summary`, `services/commissioner-team-settings`,
  `services/ai-practice`, `routes/league-test-data`, `services/league-scheduler`
  (octroi), `routes/local-match` (repli), schémas `team.schemas` /
  `commissioner-team-edit.schemas`, lectures d'équipe (champ `leagueFreeFan`
  servi, optionnel).
- **Web** : builder `me/teams/new`, `me/teams/staff-cost`, `r/[token]/staff-lines`,
  `TeamInfoDisplay`, `TeamInfoEditor`, fiche / édition / trésorerie d'équipe,
  fiche admin.
- **Aucune** nouvelle route, aucun flag : c'est un correctif de règle.
- **Hors périmètre** (relevé au passage, à trancher à part) : un match amical
  EN LIGNE fait évoluer les Fans Dévoués et la trésorerie (`move-processor`),
  alors que cette étape appartient à la séquence d'après-match de ligue.
