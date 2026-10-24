# Design — Fan Dévoué offert réservé aux équipes de ligue

## 1. Quand une équipe devient-elle une « équipe de ligue » ?

C'est la vraie question : le builder ne sait pas à quoi servira l'équipe. Il
connaît la coupe (`cupId`, parcours « construire pour cette coupe ») ; une
équipe de ligue, elle, est construite seule puis inscrite
(`addParticipant`, appelé par l'inscription, l'acceptation d'invitation et le
participant de test).

### Retenu : au démarrage de sa première saison de ligue

`startSeason` (et `regenerateSchedule`, qui passe aussi la saison
`in_progress`) accorde le fan offert à chaque participant ACTIF
(`listActiveParticipantIds`) qui ne l'a pas encore reçu.

Pourquoi ce moment et pas un autre :

- **c'est un point de non-retour.** Avant le démarrage, une équipe se retire
  (`withdrawParticipant`, statut `withdrawn`) ou se fait supprimer par le
  commissaire ; après, elle ne sort plus que par forfait et reste dans
  l'historique de la ligue. Accorder au démarrage évite d'écrire une
  REPRISE du fan — avec ses propres pièges (fan déjà revendu, fans modifiés
  entre-temps, remboursement à reprendre).
- **rien ne se joue avant.** Les rencontres naissent au démarrage, la feuille
  de match fige l'état de l'équipe à son ouverture (`captureMatchSnapshots`) :
  le fan offert est donc dans la « version du match » dès la première
  rencontre.
- **un seul entonnoir.** Toute saison qui démarre passe par le scheduler ;
  les inscriptions, elles, ont trois appelants.

### Alternatives écartées

| Option | Pourquoi non |
|---|---|
| À l'inscription (`addParticipant`) | Le retrait et la suppression avant démarrage doivent alors reprendre le fan : trois chemins de plus, une reprise impossible à rendre exacte si le coach a racheté ou revendu entre-temps. |
| « Destination » choisie dans le builder (ligue / coupe / amical) | Le builder ne connaît pas la ligue et une équipe peut changer de destination : il faudrait de toute façon un rattrapage à l'inscription. Le choix ne serait qu'un pré-affichage. |
| Dériver à la lecture (fans affichés = stockés + 1 en ligue) | La séquence d'après-match de ligue ÉCRIT `Team.dedicatedFans` (+1 / −1, minimum 1) : la valeur stockée doit être la valeur réelle, pas une base à laquelle on ajoute. |

Effet visible assumé : entre l'inscription et le démarrage, une équipe neuve
affiche ses seuls fans achetés. La fiche d'équipe l'annonce (« +1 offert au
démarrage d'une saison de ligue »).

## 2. Le marqueur : `Team.leagueFreeFan Boolean?`, trois états, sans `@default`

```prisma
/// Fan Dévoué offert aux équipes de LIGUE.
/// null = équipe antérieure à la règle : le fan offert est DÉJÀ compté dans
///        dedicatedFans (quel que soit l'usage de l'équipe) ;
/// false = pas (encore) accordé — construction hors ligue ;
/// true = accordé au démarrage d'une saison de ligue.
leagueFreeFan Boolean?
```

- Le compte de la base n'est PAS lisible seul : `dedicatedFans = 1` veut dire
  « 1 fan offert » pour une équipe historique et « 1 fan acheté » pour une
  équipe neuve. Sans marqueur, une équipe historique qui rejoint une ligue
  recevrait un SECOND fan offert.
- `null` = état historique, `false` écrit par la création — patron de
  `playoffsPublished` et de `Cup.sheetEntryMode` : `prisma/migrations/` est
  gitignoré (`db push`), une colonne ajoutée ne se backfille pas, et un
  `@default(false)` REMPLIRAIT les lignes existantes sur Postgres.
- L'octroi est une écriture CONDITIONNELLE (`updateMany where { id,
  leagueFreeFan: false }`) : deux démarrages concurrents, ou
  `regenerateSchedule` après `startSeason`, n'accordent qu'une fois.
- `Team.dedicatedFans @default(1)` reste en place : un chemin de création
  oublié (seeders, `/__test/*`) produit `(1, null)`, donc exactement le
  comportement d'avant, jamais un état incohérent `(1, false)`.

## 3. Une seule règle, pure, partagée serveur ↔ web

`packages/game-engine/src/rosters/dedicated-fans.ts`, consommé par tous les
calculs aujourd'hui écrits `max(0, n − 1) × prix` (huit endroits : trois côté
serveur, cinq côté web) :

```ts
export type LeagueFreeFan = boolean | null | undefined;

/** Fans OFFERTS compris dans le compte : 1 si historique ou accordé, 0 sinon. */
export function includedFreeDedicatedFans(marker: LeagueFreeFan): 0 | 1;
/** Fans PAYÉS = compte − fans offerts compris (jamais négatif). */
export function paidDedicatedFans(fans: number, marker: LeagueFreeFan): number;
/** Coût d'achat des fans (hors VE/VEA, inchangé sur ce point). */
export function dedicatedFansPurchaseCost(fans: number, unitCost: number, marker: LeagueFreeFan): number;
/** Minimum de l'équipe : 1 si un fan offert est compté, 0 sinon. */
export function minDedicatedFans(marker: LeagueFreeFan): 0 | 1;
/** Plan d'octroi au démarrage d'une saison de ligue. */
export function planLeagueFreeFan(input: {
  fans: number; marker: LeagueFreeFan; maxFans: number; unitCost: number;
}): { kind: "none" } | { kind: "fan"; fansAfter: number } | { kind: "refund"; amount: number };
```

`undefined` est lu comme `null` : un client web déployé avant le serveur
(champ absent de la réponse) garde le comportement actuel — patron
« backwards-compat sur champs API ajoutés ».

Le builder, qui construit une équipe NEUVE, appelle ces fonctions avec
`false`. Le clonage (`fromTeamId`) reprend les fans PAYÉS de l'équipe source,
pas son compte (sinon le fan offert d'une équipe de ligue deviendrait un fan
facturé dans la copie).

## 4. Équipe déjà au plafond : le prix d'un fan en trésorerie

En ligue, 6 fans coûtent 5 × 5 000 po (le premier est offert). Une équipe
construite hors ligue avec 6 fans les a payés 6 × 5 000 po. Au démarrage, lui
ajouter un 7e fan dépasserait le plafond ; ne rien lui donner lui ferait payer
la règle de ligue 5 000 po de trop. `planLeagueFreeFan` rend donc
`{ kind: "refund", amount: dedicatedFanCost }`, crédité en `{ increment }`
(jamais lire-puis-écrire), au prix de la config staff résolue du roster ×
format. Le marqueur passe à `true` dans la même écriture.

## 5. Journal

`services/league-scheduler` devient un écrivain de `Team` : l'octroi passe par
`safeRecordTeamAudit` (action `team.league_free_fan`, `details` = saison,
nature `fan` | `refund`, montant), capturé AVANT, publié APRÈS le commit —
sinon la garde `team-audit-coverage` le refuse, et un fan apparu sans trace
est précisément l'écart que le journal sert à expliquer. L'octroi est
best-effort par équipe : un échec est journalisé et ne fait pas échouer le
démarrage de la saison (même posture que les crochets post-règlement), le
démarrage suivant (`regenerateSchedule`) le rattrape.

## 6. Ce qui ne change pas

- **L'existant.** Une équipe historique (`null`) garde son compte. Une équipe
  de coupe ou d'amical historique conserve donc son fan offert — retirer un
  fan à des équipes en circulation, dont certaines figées dans un snapshot de
  coupe en cours, est une décision à part (§ 7).
- **Une équipe de ligue inscrite ensuite à une coupe** garde ses fans : c'est
  l'état réel de l'équipe, figé tel quel dans le snapshot d'inscription. La
  règle porte sur la CONSTRUCTION.
- **Sevens** : même règle (le format est orthogonal), au prix Sevens.
- **VE / VEA** : les Fans Dévoués en restent exclus.
- **La séquence d'après-match de ligue** (minimum 1, +1 / −1) : une équipe de
  ligue a toujours au moins son fan offert.

## 7. Questions ouvertes

1. **Rattraper l'existant ?** Recommandation : non par défaut. Option : un
   script d'opérateur en simulation par défaut (`-- --apply`, posture de
   `db:resync-sheet-casualties`) qui retire le fan offert aux équipes
   historiques jamais inscrites à une saison de ligue et non engagées dans une
   coupe en cours, et pose `leagueFreeFan = false`.
2. **Les amicaux en ligne font évoluer les fans et la trésorerie**
   (`move-processor`). Hors de ce change ; à confirmer comme règle à corriger.
