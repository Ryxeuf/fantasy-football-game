# Design — Fan Dévoué offert réservé aux équipes de ligue

## 1. Quand une équipe devient-elle une « équipe de ligue » ?

Le builder ne sait pas à quoi servira l'équipe. Il connaît la coupe (`cupId`,
parcours « construire pour cette coupe ») ; une équipe de ligue, elle, est
construite seule puis inscrite à une saison.

### Retenu : à l'inscription, repris au départ

Le fan offert s'accorde dans `addParticipant`, entonnoir unique des trois
chemins d'inscription (inscription par le coach, acceptation d'invitation,
participant de test). Il se reprend quand l'inscription disparaît ou cesse de
compter :

| Départ | Chemin | Effet sur l'inscription |
|---|---|---|
| Retrait de la saison | `withdrawParticipant` (coach avant démarrage, admin `force` ensuite) | statut `withdrawn` |
| Suppression par le commissaire | `removeTeamFromLeague`, `removeCoachFromSeason` (avant démarrage, aucun match) | suppression |
| Suppression de la ligue | `competition-lifecycle` (`DELETE`) | cascade |

Avantage sur un octroi au démarrage de la saison : le coach voit son fan dès
qu'il inscrit son équipe, et la règle se lit simplement (« inscrite en ligue
⇒ fan offert »). Le prix : écrire la reprise, ce que les §§ 3 et 4 cadrent.

Une saison qui se termine normalement ne reprend rien : l'équipe a un
historique de ligue, elle reste une équipe de ligue (et garde ses fans si
elle s'inscrit ensuite à une coupe — cf. § 7).

### Alternatives écartées

| Option | Pourquoi non |
|---|---|
| Au démarrage de la saison | Pas de reprise à écrire, mais le coach inscrit ne voit pas son fan avant le démarrage — écarté au profit de la lisibilité. |
| « Destination » choisie dans le builder (ligue / coupe / amical) | Le builder ne connaît pas la ligue et une équipe peut changer de destination : il faudrait de toute façon l'octroi à l'inscription. |
| Dériver à la lecture (fans affichés = stockés + 1 en ligue) | La séquence d'après-match de ligue ÉCRIT `Team.dedicatedFans` (+1 / −1, minimum 1) : la valeur stockée doit être la valeur réelle. |

## 2. Deux marqueurs, aucun `@default`

```prisma
model Team {
  /// Fan Dévoué offert aux équipes de LIGUE.
  /// null  = équipe antérieure à la règle : le fan offert est DÉJÀ compté ;
  /// false = pas de fan offert (équipe neuve hors ligue) ;
  /// true  = fan offert accordé par une inscription en ligue.
  leagueFreeFan Boolean?
}
model LeagueParticipant {
  /// Ce que CETTE inscription a accordé : "fan" | "refund" ; null = rien.
  freeFanGrant  String?
  /// Montant crédité (po) quand freeFanGrant = "refund".
  freeFanRefund Int?
}
```

- **Le compte seul ne se lit pas** : `dedicatedFans = 1` veut dire « 1 fan
  offert » pour une équipe historique et « 1 fan acheté » pour une équipe
  neuve. Sans `Team.leagueFreeFan`, une équipe historique qui rejoint une
  ligue recevrait un SECOND fan offert.
- **La reprise suit l'inscription qui a accordé.** Une équipe inscrite en
  saison 1 (fan accordé), puis en saison 2 (rien d'accordé : elle l'a déjà),
  qui quitte la saison 2 ne doit rien perdre. D'où le marqueur PAR
  inscription, et non un simple « l'équipe est-elle encore en ligue ? ».
- **Le remboursement mémorise son montant** : le prix d'un fan est éditable
  en admin (`RosterStaffConfig`), la reprise rend exactement ce qui a été
  donné.
- `null` = état historique, `false` écrit par la création — patron de
  `playoffsPublished` et de `Cup.sheetEntryMode` : `prisma/migrations/` est
  gitignoré (`db push`), une colonne ajoutée ne se backfille pas, et un
  `@default` REMPLIRAIT les lignes existantes sur Postgres.
- `Team.dedicatedFans @default(1)` reste en place : un chemin de création qui
  n'écrit pas le marqueur (seeders, `/__test/*`) produit `(1, null)`, donc
  exactement le comportement d'avant, jamais l'état incohérent `(1, false)`.
- **Pas de rattrapage** : les équipes existantes restent `null`.

## 3. Octroi : atomique avec l'inscription

`services/league-free-fan.createLeagueParticipant` :

1. plan PUR (`planLeagueFreeFanGrant`) à partir de l'équipe déjà chargée par
   `addParticipant` et de la config staff résolue (roster × format) ;
2. rien à accorder (`null` / `true`) ⇒ création simple, comme avant ;
3. sinon, UNE transaction : `team.updateMany where { id, leagueFreeFan:
   false }` (+1 fan, ou `treasury: { increment }` au plafond), puis création
   de l'inscription avec `freeFanGrant` / `freeFanRefund` — posés SEULEMENT
   si l'écriture conditionnelle a touché une ligne (deux inscriptions
   concurrentes n'accordent qu'une fois) ;
4. journal `team.league_free_fan.granted` APRÈS le commit.

### Équipe déjà au plafond : le prix d'un fan en trésorerie

En ligue, 6 fans coûtent 5 × 5 000 po (le premier est offert). Une équipe
construite hors ligue avec 6 fans les a payés 6 × 5 000 po. Lui ajouter un
7e fan dépasserait le plafond ; ne rien lui donner lui ferait payer la règle
de ligue 5 000 po de trop. Le plan rend donc `{ kind: "refund", amount }` au
prix de la config résolue.

## 4. Reprise : exacte quand c'est possible, jamais négative

`services/league-free-fan.withLeagueFreeFanRevoked(participants, op)` :
charge, dans une transaction, les équipes des inscriptions qui portent un
`freeFanGrant`, applique le plan PUR de reprise, puis exécute `op` (retrait,
suppression d'inscription(s), suppression de la ligue) dans la MÊME
transaction. Sans inscription concernée, `op` s'exécute seul, comme avant.

`planLeagueFreeFanRevoke` :

| Accordé | État de l'équipe | Reprise |
|---|---|---|
| `fan` | ≥ 1 fan | −1 fan |
| `fan` | 0 fan (fans perdus entre-temps) | rien à retirer |
| `refund` (A po) | trésorerie ≥ A | −A po |
| `refund` (A po) | trésorerie < A, ≥ 1 fan | −1 fan (un fan s'achète A po : même valeur) |
| `refund` (A po) | trésorerie < A, 0 fan | rien |

Dans tous les cas `Team.leagueFreeFan` repasse à `false` (écriture
conditionnée à `true`) : une nouvelle inscription accordera à nouveau le fan.
Une trésorerie ne devient jamais négative (même règle que les débits
commissaire). Le journal `team.league_free_fan.revoked` porte l'accordé, ce
qui a été repris et la raison du départ.

## 5. Une seule règle, pure, partagée serveur ↔ web

`packages/game-engine/src/rosters/dedicated-fans.ts`, consommé par tous les
calculs aujourd'hui écrits `max(0, n − 1) × prix` (huit endroits : trois côté
serveur, cinq côté web) et par les deux plans :

```ts
export type LeagueFreeFanMarker = boolean | null | undefined;
export function includedFreeDedicatedFans(marker: LeagueFreeFanMarker): 0 | 1;
export function paidDedicatedFans(fans: number, marker: LeagueFreeFanMarker): number;
export function dedicatedFansPurchaseCost(fans: number, unitCost: number, marker: LeagueFreeFanMarker): number;
export function minDedicatedFans(marker: LeagueFreeFanMarker): 0 | 1;
export function planLeagueFreeFanGrant(input): LeagueFreeFanGrantPlan;
export function planLeagueFreeFanRevoke(input): LeagueFreeFanRevokePlan;
```

`undefined` est lu comme `null` : un client web déployé avant le serveur
(champ absent de la réponse) garde le comportement actuel — patron
« backwards-compat sur champs API ajoutés ».

Le builder, qui construit une équipe NEUVE, appelle ces fonctions avec
`false`. Le clonage (`fromTeamId`) reprend les fans PAYÉS de l'équipe source,
pas son compte (sinon le fan offert d'une équipe de ligue deviendrait un fan
facturé dans la copie).

## 6. Journal

`services/league-free-fan` est le seul nouvel écrivain de `Team` : il capture
l'état AVANT la transaction et publie APRÈS le commit (`safeRecordTeamAudit`),
comme l'exige `team-audit-coverage`. Les appelants (`league`,
`commissioner-team-removal`, `competition-lifecycle`) ne touchent pas `Team`
eux-mêmes.

## 7. Ce qui ne change pas

- **L'existant** (`leagueFreeFan = null`) : aucun fan ajouté ni retiré, à
  l'inscription comme au départ.
- **Une équipe de ligue inscrite ensuite à une coupe** garde ses fans : c'est
  l'état réel de l'équipe, figé tel quel dans le snapshot d'inscription.
- **Sevens** : même règle (le format est orthogonal), au prix Sevens.
- **VE / VEA** : les Fans Dévoués en restent exclus.
- **La séquence d'après-match de ligue** (minimum 1, +1 / −1).

## 8. Hors périmètre

Les amicaux EN LIGNE font évoluer les fans et la trésorerie
(`move-processor`), alors que c'est une étape de l'après-match de ligue. À
trancher dans un change séparé.
