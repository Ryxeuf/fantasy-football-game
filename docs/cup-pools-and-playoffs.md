# Poules et play-offs d'une coupe

> Complète [`docs/cup-match-sheet.md`](./cup-match-sheet.md) (feuille de match
> commune) et [`docs/cup-swiss-rounds.md`](./cup-swiss-rounds.md)
> (appariement). Le principe est le même : **une coupe est une ligue moins ses
> effets** — on partage le code et on nomme la différence.

## Poules

### Modèle

```prisma
model CupPool {
  id                  String  @id @default(cuid())
  cupId               String
  name                String
  order               Int     @default(0)
  color               String?
  /// Nombre d'équipes qui montent en play-offs depuis cette poule.
  qualifiesForPlayoffs Int    @default(0)
  @@unique([cupId, name])
  @@index([cupId, order])
}
```

`CupParticipant.poolId` est nullable (`onDelete: SetNull`) : supprimer une
poule DÉSAFFECTE ses inscrits, elle ne les retire pas de la coupe.

### Fenêtre d'édition

`ensurePoolsEditable` refuse la COMPOSITION dès qu'une `CupRound` existe
(`cup_started`) ou que la coupe est `terminee` / `archivee` (`cup_closed`).
Réaffecter une équipe après une ronde jouée réécrirait rétroactivement un
classement : les points restent, ils changent de colonne.

Le **quota** fait exception (`updateCupPool` l'accepte après coup) : il ne
gouverne que le seeding, qui n'a pas encore eu lieu. C'est ce qui permet de
corriger « 2 qualifiés par poule » en « 1 » quand on décide finalement une
demi-finale plutôt qu'un quart.

Le STATUT de la coupe ne suffisait pas comme garde-fou : une coupe passe
`en_cours` à la validation, bien AVANT la première ronde — s'y arrimer aurait
fermé la composition avant qu'elle soit possible.

### Appariement par groupe

Les rondes restent **communes** à la coupe (contrainte unique
`(cupId, roundNumber)`) ; c'est l'appariement qui se fait poule par poule,
chaque groupe passant par le moteur suisse ou le tirage avec SON classement
et SON historique.

```ts
// `poolGroups` (pur) : une entrée par poule, plus un groupe pour les
// équipes non affectées — les exclure les ferait disparaître en silence.
const groups = poolGroups(cup.pools ?? [], participants);
const plan = mergeGroupRounds(groups.map((g) => generateSwissRound(g)));
```

Conséquence assumée : une ronde peut porter **plusieurs exempts**, un par
groupe d'effectif impair. `CupRoundPlan.byes` est donc une LISTE — c'est le
seul endroit où la forme du plan a dû changer.

### Classement

`groupCupStandingsByPool` (pur) **projette** le classement général dans
chaque poule ; il ne le retrie pas. Deux tris séparés auraient fini par
diverger le jour où l'un oublierait un critère de départage. Les équipes non
affectées sont regroupées en queue sous `UNASSIGNED_POOL_ID`.

## Play-offs

### Un moteur partagé avec la ligue

`services/bracket-seeding.ts` porte les trois règles pures extraites de
`league-playoffs` : croisement des têtes (`generatePlayoffSeedingFor`), carte
d'avancement (`ADVANCEMENT_SLOTS` / `nextSlotFor`) et sélection depuis les
quotas de poule (`selectSeedsFromPools`). Elles ne manipulent que des
identifiants OPAQUES : on leur passe des `teamId` là où la ligue passe des
`participantId`. `league-playoffs` importe et **ré-exporte** le module, donc
aucun appelant existant n'a bougé.

### Une ronde par slot

`CupRound.kind = "playoff"`, `bracketSlot` (`qf1`…`qf4`, `sf1`, `sf2`,
`final`), `system = "bracket"`. Une ronde = une rencontre. C'est
contre-intuitif — on attendrait une ronde « demi-finales » à deux rencontres
— mais c'est ce qui permet à un slot d'exister avant que son adversaire soit
connu, et de retrouver le slot par la ronde sans le propager jusqu'à la
rencontre.

⚠️ Comme en ligue, un nouveau round s'alloue `max(roundNumber) + 1`, jamais
`round.roundNumber + 1` : le numéro suivant appartient au round FRÈRE (demi 1
= N, demi 2 = N+1).

### Placeholder : `home === away`

`CupPairing.homeTeamId` est NOT NULL. Une finale créée avant la seconde demie
n'a donc aucun moyen d'écrire « inconnu » : le premier qualifié occupe les
DEUX côtés, le second l'écrase à son arrivée. `placeholder` est dérivé à la
lecture, sans colonne dédiée.

`awayTeamId: null` n'était pas utilisable : il veut déjà dire EXEMPT
(`status: "bye"`) côté phase de classement.

### Publication : booléen à trois états

```prisma
/// null = coupe antérieure à la colonne (VISIBLE), false = généré non
/// publié, true = publié
playoffsPublished Boolean?
```

`prisma/migrations/` est gitignoré, la prod applique `db push` : aucun
backfill n'est possible. `startCupPlayoffs` écrit le `false` explicite sur les
brackets NEUFS.

**Le piège** : gater `getCupBracket` seul ne suffit pas — le CALENDRIER
(`GET /cup/:id`) sert lui aussi les rondes et aurait annoncé les têtes de
série avant publication. D'où `visibleCupRounds` (pur), appliqué à la lecture
et JAMAIS au calcul du classement, qui doit rester assis sur toutes les rondes
(masquer une ronde ne doit pas changer les points d'un exempt).

```ts
const rounds = visibleCupRounds(allRounds, {
  isCommissioner,
  playoffsPublished: cup.playoffsPublished ?? null,
});
const standings = computeCupStandings(cup, matches, {
  byesByTeamId: cupByesByTeamId(allRounds), // ← toutes les rondes
});
```

### Avancement

`settleCupPairingForLocalMatch` appelle `advanceCupPlayoffs` en **effet
secondaire non bloquant** (`.catch` + journalisation) : son échec ne doit
jamais faire échouer une validation déjà committée. Un match nul ne fait
avancer personne.

## Routes

| Verbe | Chemin | Qui |
|---|---|---|
| `GET` | `/cup/:id/pools` | tous |
| `POST` | `/cup/:id/pools` | commissaire |
| `POST` | `/cup/:id/pools/assign` | commissaire |
| `POST` | `/cup/:id/pools/auto-assign` | commissaire |
| `PATCH` | `/cup/pools/:poolId` | commissaire |
| `DELETE` | `/cup/pools/:poolId` | commissaire |
| `GET` | `/cup/:id/playoffs` | tous (gaté par la publication) |
| `POST` | `/cup/:id/playoffs/start` | commissaire |
| `PATCH` | `/cup/:id/playoffs/publish` | commissaire |
| `PATCH` | `/cup/:id/playoffs/seeds` | commissaire |

Les deux routeurs sont montés **avant** `cupRoutes`, dont le `GET /:id`
avalerait `/pools` et `/playoffs`.

## Écrans

- `apps/web/app/cups/[id]/CupPoolsManagerPanel.tsx` — composition, quotas,
  affectation manuelle et automatique. Lecture seule dès la 1re ronde.
- `apps/web/app/cups/[id]/CupPlayoffBracketView.tsx` — panneau de lancement
  (commissaire seul) puis tours en colonnes, publication et correction des
  têtes.
- `apps/web/app/cups/[id]/playoff-bracket.ts` — dérivations PURES (ordre des
  tours, têtes courantes, fenêtre d'édition), testées sans DOM.
- `apps/web/app/cups/[id]/CupStandings.tsx` — rendu une fois par poule, la
  barre de qualification marquée par le quota.
