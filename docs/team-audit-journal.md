# Journal d'équipe — mode d'emploi

> Trace append-only de **toute** modification d'une équipe : qui, quoi, et
> quel était l'état de l'équipe après chaque étape. Conçu pour reconstituer
> les écarts de trésorerie et de VE/VEA.

## Ce que le journal répond

| Question | Où |
| --- | --- |
| Qui a fait ça ? | `actorUserId`, `actorRole`, `actorLabel` (figé), `impersonatorId` |
| Depuis où ? | `source` (`http`/`job`/`script`), `route`, `ipAddress`, `userAgent` |
| Quoi exactement ? | `action` (slug dot-case), `details` (charge utile métier) |
| Qu'est-ce qui a changé ? | `changes` (diff champ par champ), `before` |
| **Ça a donné quoi ?** | `after` + `treasury` / `teamValue` / `currentValue` + les deltas |
| Dans quel ordre ? | `correlationId` (= requestId HTTP) + `step` |

## Consulter

- **Coach** : fiche d'équipe → bouton « Journal » (`/me/teams/<id>/journal`).
- **Admin** : `/admin/teams` → colonne d'actions → « Journal » (accès à
  n'importe quelle équipe).
- **Commissaire** : même page, pour les équipes inscrites dans sa ligue.
- **API** : `GET /team/:id/journal?limit=&offset=&action=&actor=&economic=1&since=&until=`

L'UI groupe les étapes par **opération** (une requête = une carte dépliable).
C'est la vue utile : un achat de joueur apparaît comme une opération de deux
étapes — le débit, puis le recalcul de VE — chacune avec son résultat.

## Débugger un écart de trésorerie ou de VE

1. Ouvrir le journal de l'équipe, cocher **« Uniquement l'or et la VE »** :
   ne restent que les étapes qui ont réellement bougé un montant.
2. Lire la colonne de droite : chaque opération affiche sa variation et le
   solde résultant. Le pas où le solde décroche est l'opération fautive.
3. Déplier : chaque étape montre son diff (`400k po → 320k po`), son slug
   d'action, l'état résultant complet et le « Détail technique » (`details`)
   — coût débité, poste acheté, payload de la feuille de match, motif
   commissaire.
4. Le `correlationId` d'une étape est le `X-Request-Id` de la requête : il
   permet de retrouver les logs pino correspondants.

Une étape `…​.failed` signale une mutation qui a levé en cours de route :
c'est souvent là que se cache un état à moitié écrit.

## Instrumenter un nouveau flux

La garde CI `services/team-audit-coverage.test.ts` fait échouer tout module de
`services/` ou `routes/` qui écrit sur `Team` / `TeamPlayer` /
`TeamStarPlayer` sans journaliser. Deux formes :

```ts
// 1. Capture explicite (mutation en plusieurs écritures, transaction…)
const auditDb = prisma as unknown as TeamAuditPrismaLike;
const before = await captureTeamState(auditDb, teamId);
await prisma.$transaction(ops);
await safeRecordTeamAudit(auditDb, {
  teamId,
  action: "team.roster.save",
  before,
  details: { created, updated, deleted },
});

// 2. Wrapper (mutation en un appel)
await withTeamAudit(prisma, { teamId, action: "team.purchase.player" }, () =>
  buyPlayer(teamId, position),
);
```

Règles :

- **Toujours** `safeRecordTeamAudit` / `withTeamAudit` dans le code métier :
  une défaillance du journal ne doit jamais faire échouer une mutation déjà
  committée. `recordTeamAudit` (qui lève) est réservé aux tests.
- **Capturer avant, publier après le commit.** Une lecture faite depuis le
  client global *à l'intérieur* d'une transaction interactive ne verrait pas
  les écritures non committées : envelopper `prisma.$transaction(...)`, jamais
  son intérieur.
- **Ne pas s'intercaler devant les lectures métier.** Certains tests
  assertent l'ordre des appels Prisma : capturer après le chargement du
  service (cf. `league-offline-purchases`).
- **Slug d'action** en dot-case, préfixé par domaine (`team.*`, `league.*`,
  `commissioner.*`). Ajouter son libellé français dans `ACTION_LABELS`
  (`services/team-audit-read.ts`) — sans quoi l'UI affiche le slug brut.
- Un module qui **délègue** à un module journalisant (ex. `player-death` →
  `player-status`) va dans `AUDIT_EXEMPT` avec sa justification. Cette liste
  ne doit que décroître.

## Acteur : le contexte ambiant

`utils/audit-context.ts` porte `{ correlationId, actorUserId, roles, route,
ip, step }` dans un `AsyncLocalStorage`, posé par `middleware/auditContext.ts`
(monté juste après `requestContext()`) et rempli par `authUser`. Aucun service
n'a donc à threader l'identité de l'appelant.

Pour un job ou un script, ouvrir explicitement un contexte, sinon les étapes
sont attribuées à `system` avec une corrélation par étape :

```ts
await runAsAuditJob("league.postmatch.sequence", () => settleMatch(matchId));
```

## Exploitation

- **Coupe-circuit** : `TEAM_AUDIT_DISABLED=1` désactive tout (écritures *et*
  captures d'état). Utile si le surcoût — 1–2 lectures + 1 insert par
  mutation — devenait un problème.
- **Rétention** : aucune purge pour l'instant. La table croît sans plafond ;
  à cadrer quand le volume réel sera connu.
- **Schéma** : additif, appliqué par `prisma db push` (cf.
  `scripts/db-migrate.sh`). Le journal démarre vide, aucun backfill n'est
  nécessaire.
