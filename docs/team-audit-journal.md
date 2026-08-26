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

## Chercher à travers TOUTES les équipes (admin)

`/admin/team-journal` — l'outil d'enquête quand on ne sait pas encore quelle
équipe est en cause. Les mêmes filtres pilotent les trois vues : on affine à
l'écran, on lit les agrégats, on exporte ce qu'on voit.

| Filtre | Sert à |
| --- | --- |
| Recherche libre (`q`) | action, coach, note, route, id d'entité, corrélation |
| « aussi dans les charges utiles » (`deep`) | étend `q` à `details` / `changes` — retrouve un poste acheté, un motif commissaire, un montant |
| Équipe (nom) / propriétaire | restreindre à une écurie ou à un coach |
| Action, rôle, source, entité | listes alimentées par les valeurs RÉELLEMENT présentes (`/facets`) |
| Δ trésorerie ≥ N kpo | ne garder que les gros mouvements, **dans les deux sens** — un crédit de 200k est aussi suspect qu'un débit |
| Échecs uniquement | les étapes `<action>.failed` |
| En impersonation | ce qu'un admin a fait « en tant que » un coach |
| Du / Au | fenêtre temporelle (la borne de fin inclut la journée entière) |

Tri disponible : plus récent, plus ancien, **impact trésorerie**, **impact VE**
— les deux derniers font remonter les sauts aberrants sans les chercher.

Cliquer une ligne déplie sa charge utile ; « Voir toute l'opération » rebascule
la recherche sur le `correlationId` et affiche les étapes sœurs.

### Export machine

Deux formats, mêmes filtres, plafonnés à 10 000 lignes (au-delà : resserrer ou
paginer — le serveur refuse plutôt que de tronquer en silence) :

- **CSV** — pour un tableur. BOM UTF-8 (sans lui Excel lit « Trésorerie » en
  Latin-1), montants en **po bruts** (un export sert à calculer, pas à lire),
  colonnes texte protégées contre l'injection de formule.
- **NDJSON** — une ligne JSON complète par étape, snapshots inclus. Se lit en
  streaming, se rejoue dans n'importe quel outil :

```bash
# Les 10 plus gros mouvements de trésorerie du fichier exporté
jq -s 'sort_by(.treasuryDelta) | .[0:10] | .[] | {action, treasuryDelta, team: .team.teamName}' export.ndjson
```

Les en-têtes `X-Total-Count` / `X-Returned-Count` disent si l'export est
complet.

### API

Trois endpoints admin partagent le même jeu de filtres :

```
GET /admin/team-journal          # page enrichie (équipe + coach)
GET /admin/team-journal/stats    # agrégats par action / rôle / équipe
GET /admin/team-journal/export   # CSV ou NDJSON (?format=)
GET /admin/team-journal/facets   # valeurs de filtre réellement présentes
```

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

## Pièges de portabilité (recherche)

Deux différences Postgres / miroir sqlite sont traitées dans
`services/team-audit-search.ts`, via des capacités **injectées** plutôt que
déduites au fond du code (le constructeur de requête reste pur et testable
dans les deux configurations) :

- `mode: "insensitive"` n'existe **que** sur Postgres ; le passer à sqlite
  fait échouer la requête.
- `details` / `changes` sont `Json` en PG et `String` en sqlite. Comme
  `recordTeamAudit` y écrit toujours une **chaîne** JSON, la recherche
  profonde utilise `string_contains` (PG) ou `contains` (sqlite).

Toute nouvelle clause qui touche ces colonnes doit passer par
`ProviderCapabilities`, sinon elle marchera dans les tests et cassera en prod
(ou l'inverse).

## Exploitation

- **Coupe-circuit** : `TEAM_AUDIT_DISABLED=1` désactive tout (écritures *et*
  captures d'état). Utile si le surcoût — 1–2 lectures + 1 insert par
  mutation — devenait un problème.
- **Rétention** : aucune purge pour l'instant. La table croît sans plafond ;
  à cadrer quand le volume réel sera connu.
- **Schéma** : additif, appliqué par `prisma db push` (cf.
  `scripts/db-migrate.sh`). Le journal démarre vide, aucun backfill n'est
  nécessaire.
