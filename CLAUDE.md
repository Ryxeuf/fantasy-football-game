# CLAUDE.md — Memoire / patterns Nuffle Arena

> Fichier de memoire long-terme pour Claude Code. Documente les
> conventions du repo et les patterns recurrents decouverts au fil
> des sessions. A relire avant de demarrer du travail non-trivial.

## Layout monorepo

```
apps/
  server/       # Express + Prisma (PostgreSQL prod, SQLite tests)
  web/          # Next.js 14 app router
  mobile/       # Expo React Native
packages/
  sim-engine/   # Sim Pro League (TS, pur)
  game-engine/  # Match engine BB en ligne (TS, pur)
  nfl-mapper/   # @bb/nfl-mapper — mapping NFL→BB (race/poste/SPP, pseudonymize, pur)
  shared-types/ # Types partages
  ui/           # @bb/ui — composants UI partages
  config/       # Config partagee (tsconfig, lint…)
prisma/         # Schema + migrations
```

Outils : pnpm workspaces, Turbo pour les tasks, Vitest pour les tests
(server + web), Playwright pour E2E.

> **Module NFL Fantasy** (axe additionnel, pas un remplacement de BB) :
> mode MPG-like sur stats NFL reelles skinnees Blood Bowl. Services
> `apps/server/src/services/nfl-fantasy-*.ts` + `nfl-ingest*.ts`, package
> pur `@bb/nfl-mapper`, ~14 modeles Prisma `Nfl*`, pages
> `apps/web/app/nfl-fantasy/*` + `app/admin/nfl-fantasy/*`. Doc dediee :
> [`docs/nfl-fantasy/README.md`](./docs/nfl-fantasy/README.md).

## Conventions code

### Backend (`apps/server`)
- **Services** : pure logic dans `src/services/*.ts`. Pas d'I/O dans
  les fonctions exportees marquees "pur".
- **Routes** : `src/routes/*.ts` avec handler + Zod schema + middleware
  (`authUser`, `adminOnly`, `validate`).
- **Validation des entrees** : toute route mutante qui lit `req.body`
  DOIT passer par `validate(schema)` (idem `validateQuery` /
  `validateParams`, cf. `middleware/validate.ts`). Le handler NE recaste
  PAS `req.body as { ... }` : il type via le schema
  (`const body: z.infer<typeof schema> = req.body`, ou un
  `export type XInput = z.infer<...>` pose a cote du schema) pour que
  tout drift schema/handler echoue a `tsc`. Garde CI :
  `routes/no-raw-body-cast.test.ts` interdit tout `req.body as` dans
  `routes/` (migration complete, denylist vide — tout nouveau cast brut
  fait echouer le test).
- **Erreurs typees** : prefere `class XxxError extends Error` avec un
  `code` enum string plutot que des chaines. Le handler match sur
  `instanceof` pour mapper le status HTTP.
- **Prisma** : preferer `select` (vs include) pour cap les colonnes
  remontees. Pour les agregats multi-rows, **toujours `groupBy`** au
  lieu de N+1.
- **TestSqlite vs Postgres** : les tests utilisent SQLite (`TEST_SQLITE=1`).
  Les colonnes JSON peuvent etre array natif (PG) ou string serialisee
  (sqlite mirror). Toujours faire un parser tolerant aux deux.

### Frontend (`apps/web`)
- Next.js 14 app router, `"use client"` au top pour les pages
  interactives.
- `apiRequest<T>(path, init?)` dans `app/lib/api-client.ts` pour les
  fetchs. `ApiClientError` pour les status non-2xx.
- i18n via `useLanguage()` (`app/contexts/LanguageContext.tsx`) +
  `app/i18n/translations.ts`. Pour les pages polish jetable, OK de
  hardcoder le francais.
- `data-testid` parlants : `roster-toolbar`, `top-earner-1`,
  `wallet-tx-bet`. Stables vs text selectors.

## Patterns recurrents

### Caps server-side plus stricts que CLI (J)
Un wrapper d'un CLI offline doit avoir des caps Zod plus stricts pour
eviter de saturer l'event loop prod.

```ts
// CLI accepte matches ≤ 1000, subscribers ≤ 5000
// Route admin accepte matches ≤ 50, subscribers ≤ 1000
export const loadtestSchema = z.object({
  matches: z.number().int().min(1).max(50),
  subscribers: z.number().int().min(1).max(1000),
  events: z.number().int().min(1).max(200),
});
```

### Aggregation `groupBy` au lieu de N+1 (I, M)
Pour les agregats par groupe (ex: TV par team), un seul round-trip :

```ts
const tvAggregates = await prisma.proTeamRoster.groupBy({
  by: ["teamId"],
  where: { teamId: { in: teamIds }, status: "active" },
  _sum: { tvCached: true },
});
const tvByTeamId = new Map<string, number>();
for (const a of tvAggregates) {
  tvByTeamId.set(a.teamId, a._sum.tvCached ?? 0);
}
```

### Reuse de logique pure pour mining read-only (L)
Quand un service applique une regle (ex: `attributeSpp` calcule les
SPP per-match), on peut le rappeler en mode read-only sur les replays
existants pour reconstituer un historique sans nouvelle table.

```ts
// `attributeSpp` est pur ⇒ on le rappelle pour chaque replay archive
const { rewards } = attributeSpp({ seed, events, casualties, ... });
const own = rewards.find((r) => r.rosterId === playerId);
```

### Fallback retired/dead via teamId (L)
Pour les services filtrant `status='active'`, prevoir un fallback si
le rosterId vise est desormais retired/dead :

```ts
if (!homeIds.has(playerId) && !awayIds.has(playerId)) {
  if (playerTeamId === match.homeTeamId) homeIds.add(playerId);
  else if (playerTeamId === match.awayTeamId) awayIds.add(playerId);
}
```

### Flag brut + flag computed (K)
Quand l'API expose une valeur computed pour cacher un lag (ex:
`level = max(rawDb, computed)`), il faut **aussi** exposer un flag
brut (`readyToLevelUp`) pour signaliser cote UI l'etat "en attente".

```ts
const rawDbLevel = (r.level as number | null) ?? 1;
const computedLevel = levelForSpp(spp);
const level = Math.max(rawDbLevel, computedLevel);
const readyToLevelUp = computedLevel > rawDbLevel; // flag brut
```

### `Promise.all([detail, optional])` (L)
Charger un endpoint principal + un endpoint optionnel en parallele
dans le meme `useEffect`. Catch sur l'optionnel ⇒ `[]` au lieu de
bloquer l'affichage du detail.

```ts
Promise.all([
  apiRequest<PlayerDetail>(`/api/pro-league/players/${id}`),
  apiRequest<HistoryResponse>(`/api/pro-league/players/${id}/history`)
    .catch(() => ({ matches: [] }) as HistoryResponse),
]).then(([d, h]) => { setData(d); setHistory(h.matches); });
```

### Backwards-compat sur champs API ajoutes (K)
Ajouter un champ optionnel `?` cote UI quand l'API change. Permet de
deployer le frontend avant la prochaine PR serveur.

```ts
interface RosterProgression {
  readonly level: number;
  readonly spp: number;
  /** Lot K — applier en retard. Optionnel pour retro-compat pre-K. */
  readonly readyToLevelUp?: boolean;
  readonly tv: number;
}
```

### Kill-switch flag ≠ feature flag (O.B.1)
Quand un flag implemente une logique de **blocage** (validation,
maintenance, rate-limit strict) plutot que d'activation feature, l'env
`FEATURE_FLAGS_FORCE_ENABLED` (utilise en CI) ne doit **pas** le
force-ON. Sinon les E2E qui assument le comportement par defaut
cassent. Le bypass admin doit aussi etre desactive.

```ts
const KILL_SWITCH_FLAGS = new Set<string>([
  REGISTRATION_REQUIRES_VALIDATION_FLAG,
]);

export async function isEnabled(key, userId?, context?) {
  const isKillSwitch = KILL_SWITCH_FLAGS.has(key);
  if (!isKillSwitch && isForceEnabled()) return true;
  if (!isKillSwitch && isAdmin(context)) return true;
  // ... DB lookup normale
}
```

### Provider global avec hook no-op fallback (O.C.3)
Pour un systeme de notifications transversal (toast badge unlock),
monter un `Provider` dans un layout client + exposer un hook qui est
**no-op gracieux** hors provider. Permet de tester les composants
individuellement sans wrapper.

```ts
export function useBadgeNotify(): BadgeToastContextValue {
  const ctx = useContext(BadgeToastContext);
  if (!ctx) {
    return { notifyAndEvaluate: async () => {} }; // no-op
  }
  return ctx;
}
```

### LocalStorage dismiss par couple (entityId, recordId) (O.C.2)
Pour qu'un banner "Dernier X" ne re-affiche pas le meme record apres
dismiss, utiliser une cle composite plutot qu'une cle globale.

```ts
function dismissKey(teamId: string, matchId: string): string {
  return `match_report_dismissed:${teamId}:${matchId}`;
}
```

### Convention Next.js `opengraph-image.tsx` (O.D)
Pour generer une OG image dynamique d'une page App Router, creer
`opengraph-image.tsx` au meme niveau que `page.tsx`. Next.js le
detecte automatiquement et l'expose a `/{route}/opengraph-image`.
Ajouter `generateMetadata` dans un `layout.tsx` voisin si la page est
client-side ("use client").

```
app/pro-league/matches/[id]/
  ├── page.tsx (use client)
  ├── layout.tsx (server, generateMetadata + openGraph + twitter)
  └── opengraph-image.tsx (server, ImageResponse 1200×630)
```

### BB Season 2/3 : apothecary AVANT regeneration (O.A.1)
Bug regressif piegeur : l'ordre regen → apothecary est **inverse** de
la regle BB officielle. Pattern fix :

1. Sur KO/Casualty, set `pendingApothecary` avec
   `fallbackToRegeneration: hasRegen`.
2. Coach decline apothecary → trigger regen en cascade dans
   `applyApothecaryChoice`.
3. Pas d'apothecary disponible → regen directe en fallback path.

### Snapshot lazy compute avec staleness window (Q.A.1+Q.A.2)
Pour un compute couteux (scan replays + attributeSpp), persister un
modele `Snapshot` 1-1 (`@unique playerId`) avec un timestamp
`recomputedAt`. Au read, si `Date.now() - recomputedAt >= STALE_WINDOW_MS`
(ou snapshot inexistant), declenche le recompute synchrone et upsert.
Pas de cron — l'utilisateur "paye" le recompute en ouvrant la page.

```ts
const STALE_WINDOW_MS = 60 * 60 * 1000;
export async function getCareerSnapshot(playerId: string) {
  const existing = await prisma.proPlayerCareerSnapshot.findUnique({
    where: { playerId },
  });
  const isStale = !existing ||
    Date.now() - existing.recomputedAt.getTime() >= STALE_WINDOW_MS;
  if (isStale) return recomputeCareerSnapshot(playerId);
  return mapToView(existing);
}
```

### Hook post-settlement encapsule (Q.D.1, Q.D.2, Q.B.3)
Quand `settleMarketsForMatch` doit aussi settle d'autres entites
(picks, survivor entries, fan predictions), chaque call est dans un
`try/catch` isole pour ne pas faire echouer le bet settlement principal :

```ts
try {
  await settlePicksForMatch({ matchId, result: match.outcome as PickSelection });
} catch (e) {
  serverLog.error(`[pro-prediction-leagues] settle failed for match ${matchId}`, e);
}
```

Le service externe doit etre idempotent (skip si deja settled).

### Blocklist regex auto-flag pour user-generated text (Q.B.2)
Pour moderer les inputs texte sans Perspective API, un array de regex
case-insensitive verifie a la creation. Si match, `flaggedAt` +
`flagReason='blocklist:<pattern>'` set automatiquement. `listComments`
filtre alors selon perspective (auteur+admin voient flagged, autres non).

```ts
const BLOCKLIST_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: "slur-1", regex: /\bn[\W_]*i[\W_]*g[\W_]*g[\W_]*(?:e[\W_]*r|a)\b/i },
];
export function detectBlocklist(body: string): string | null {
  for (const { name, regex } of BLOCKLIST_PATTERNS) {
    if (regex.test(body)) return name;
  }
  return null;
}
```

### Heuristique scoring pure pour user-generated text (Q.B.3)
Pour scorer une prediction texte fan vs resultat reel : regex parsing
du score "X-Y" + substring case-insensitive du slug/nom equipe.
Accepte les 2 ordres (home-away ET away-home). `"perfect"` si team +
score, `"winner"` si team seul, `"wrong"` sinon. 100% pur, testable
en unit sans Prisma.

### Window post-action avec auto-close cote service (Q.B.1)
Pour les actions valides N heures apres un event (vote MVP 24h),
check `Date.now() - completedAt.getTime() > WINDOW_MS` au submit.
Cote UI, calculer `windowClosesAt` et disable les boutons. Pas
besoin de cron pour close si on accepte "silent close" — l'API
rejette, l'UI affiche fermee.

### Settle progressif multi-match round (Q.D.2)
Pour le Survivor : chaque entry reference un round (pas un match
specifique). Au fil des matches completed d'un round, on appelle
`settleSurvivorRound(roundId)` qui :
1. Charge entries pending du round
2. Pour chaque entry, cherche le match ou la team piquee a joue
3. Si `match.outcome` existe → settle (alive/eliminated)
4. Sinon → skip, l'entry reste pending pour le prochain call

Evite un trigger explicite "round completed", marche par accumulation.

### Séquence de fin de match BB : l'ORDRE des étapes est une règle

Livre p.68 : 1/ consigner résultats et gains — 2/ fans dévoués —
3/ **AMÉLIORATION DE JOUEURS** — 4/ **EMBAUCHES puis RENVOIS** —
5/ erreurs coûteuses. Ce n'est pas cosmétique :

- une compétence gagnée à l'étape 3 **change le prix de recrutement** d'un
  journalier (et la VE de l'équipe au moment des achats) ;
- les embauches précèdent les renvois : s'il n'y a pas la place pour un
  positionnel, il faut attendre le match suivant ;
- un joueur **mort** est retiré AVANT toute autre action d'après-match : sa
  place (et son numéro) sont libres pour un recrutement.

`recordOfflineLeagueResult` joue l'étape 3 via un hook injecté
(`applyAdvancements`) plutôt qu'après coup — c'est le seul point où la
feuille de match peut s'insérer au bon endroit de la séquence.

```ts
const outcome = await recordOfflineLeagueResult({
  ...offlineInput,
  applyAdvancements, // joué entre PSP/blessures et achats
});
```

Piège associé : compter les joueurs « vivants » en JS (`!p.dead`) sans
filtrer `firedAt` laisse un licencié occuper un des 16 emplacements. Le
filtre canonique `ACTIVE_PLAYER_WHERE` s'applique aussi aux caps de roster.

### Joueurs SYNTHÉTIQUES de feuille de match (journaliers, Star Players)

Deux familles de joueurs jouent le match sans exister au roster :
journaliers (`journeyman-<side>-<n>`) et Star Players engagés en coup de
pouce (`star-<side>-<slug>`). Ils sont **dérivés** à la lecture de la
feuille (jamais persistés), acceptés par `LeagueMatchEvent` (pas de FK sur
`actorPlayerId`/`targetPlayerId`) et exclus de toute persistance post-match
via `isSyntheticSheetPlayerId` — SPP, blessures, SPP bonus, licenciements.

Corollaire : tout nouveau flux « roster réel » doit filtrer par cette
fonction, et tout nouveau picker d'évènement doit les PROPOSER (sinon on ne
peut pas leur attribuer un TD ou le titre de Joueur du Match).

Un journalier peut être **recruté** en fin de match (`kind: "journeyman"`) :
il perd Solitaire, garde ses PSP et l'évolution de l'étape 3. La saisie ne
porte que l'id du journalier — le serveur redérive prix, poste, PSP
officiels et évolution (`enrichJourneymanPurchases` + `buildJourneymanHire`).

Le poste se choisit **par journalier**, pas par équipe. La colonne
`journeymenHome/Away` porte les deux formes — `{ position }` (choix global,
historique) et `{ positions: [slug | null] }` (rang → poste) — et le PATCH
d'avant-match les FUSIONNE : écrire l'une sans l'autre effacerait le choix
déjà posé. Un rang absent/inconnu retombe sur le choix global puis sur le
Trois-quart de base, ce qui rend une feuille antérieure lisible sans backfill
et préserve les choix quand le contingent grossit. Les quatre dérivations de
la feuille passent par `journeymenChoiceInput`, sinon elles divergent.

Éligibilité : le seul seuil « 0-12 ou plus » rate les Trois-quarts à quota
réduit (Orques : Trois-quart Gobelin, 0-4), donc le choix que la règle
publiée annonce. Un poste est retenu s'il est 0-12+ **ou** si ses Mots-clés
déclarent « Trois-quart » (base d'abord, repli `KEYWORDS_SEASON3`). Le tri
reste `max` décroissant : le 0-16 est toujours le DÉFAUT.

### Gel « version du match » : tout, dès l'OUVERTURE de la feuille

Un gel partiel (en-tête seul) ou tardif (1re soumission) laisse une fenêtre
pendant laquelle les valeurs live bougent — bug observé : TV et cagnotte
différentes entre le brouillon et la feuille validée. `captureMatchSnapshots`
fige l'ÉTAT COMPLET (joueurs, staff, VE/VEA, trésorerie, fans, journaliers)
à `createMatchSheet`, et rattrape les feuilles antérieures **à la lecture**
en PRÉSERVANT les valeurs déjà figées (`parseFrozenTeamValues`).

### `computedSpp` doit couvrir les joueurs SANS stat-line

Le summarizer ne produit une stat-line que pour les joueurs ayant un
évènement. Un **Joueur du Match** sans TD/sortie/passe n'en a donc pas, et
son palier d'évolution n'était pas proposé avant la validation — alors que
la validation lui créditait bien ses PSP. Toute dérivation de PSP doit
ajouter explicitement les JDM (`computeSheetSpp`, partagé entre la lecture
et la validation pour que les deux ne divergent jamais).

### Contenu généré automatiquement ⇒ publication explicite

Le bracket de playoffs est généré par un hook à la clôture de la phase
régulière : les coachs découvraient un bracket provisoire avant que le
commissaire ait corrigé les seeds. Pattern : un flag de publication + un
endpoint de bascule commissaire, et **les deux** lectures concernées gatées
(le bracket ET les rounds `kind=playoff` du calendrier).

Piège de rétro-compat : `prisma/migrations/` est **gitignoré** ici, le
schéma est appliqué en prod par `prisma db push` (cf. `scripts/db-migrate.sh`)
— donc **aucun backfill de migration n'est possible**. Un flag booléen
simple masquerait d'un coup tous les brackets déjà consultés par les
ligues. D'où le **booléen NULLABLE à trois états** :

```prisma
/// null = saison antérieure (VISIBLE), false = généré non publié, true = publié
playoffsPublished Boolean?
```

`db push` pose `null` sur l'existant (donc visible), et c'est
`startPlayoffs` qui écrit le `false` explicite sur les brackets neufs.
Règle générale : toute colonne de gating ajoutée à ce repo doit être
lisible **sans** backfill.

Pour un endpoint public dont la réponse dépend du rôle, utiliser
`optionalAuthUser` (renseigne `req.user` si un token valide est présent,
ne rejette jamais) plutôt que de dupliquer la route.

### Journal d'équipe : chaque étape stocke son RÉSULTAT

`AuditLog` ne trace que l'admin, `appendAudit` (commissaire) est indexé par
admin et par action, `TeamPlayerStatusEvent` ne couvre que morts/licenciements
— et AUCUN ne stocke l'état obtenu. D'où des écarts de trésorerie et de VE
irreconstituables. `TeamAuditEvent` (modèle append-only, jamais d'UPDATE ni de
DELETE) répond aux trois questions : **qui** (`actorUserId` + `actorRole` +
`actorLabel` figé + `impersonatorId`), **quoi** (`action` dot-case, `details`,
`changes`), **quel résultat** (`after` + colonnes dénormalisées `treasury` /
`teamValue` / `currentValue` + deltas).

Le point clé : **une opération = plusieurs étapes**. Un achat de joueur débite
la trésorerie PUIS `updateTeamValues` réécrit la VE. `correlationId`
(= requestId HTTP) les regroupe, `step` les ordonne, et chacune porte son état
résultant — sinon un chiffre faux est indiscernable d'un chiffre juste calculé
sur un état intermédiaire faux.

```ts
// Capturer AVANT, publier APRÈS le commit : une lecture depuis le client
// global À L'INTÉRIEUR d'une transaction interactive ne verrait pas les
// écritures non committées. Envelopper `$transaction`, jamais son intérieur.
const before = await captureTeamState(auditDb, teamId);
await prisma.$transaction(ops);
await safeRecordTeamAudit(auditDb, { teamId, action: "team.roster.save", before });
```

Toujours `safeRecordTeamAudit` / `withTeamAudit` dans le code métier : l'échec
du journal ne doit jamais faire échouer une mutation déjà committée (même
posture que `safeRecordAdminActionFromRequest`). `recordTeamAudit`, qui lève,
est réservé aux tests. `withTeamAudit` écrit en plus une étape `<action>.failed`
avant de propager, puis relance : une mutation qui a planté au milieu est
justement le cas qu'on cherche à reconstituer.

Garde CI `services/team-audit-coverage.test.ts` (ratchet) : tout module de
`services/`/`routes/` qui écrit sur `Team`/`TeamPlayer`/`TeamStarPlayer` sans
journaliser fait échouer les tests, sauf exemption justifiée. Un journal ne
vaut que s'il est exhaustif. Piège associé : le capture d'audit ne doit pas
s'intercaler devant les lectures métier (des tests assertent l'ordre des
appels Prisma — cf. `league-offline-purchases`). Doc :
[`docs/team-audit-journal.md`](./docs/team-audit-journal.md).

### Contexte ambiant AsyncLocalStorage pour l'identité de l'appelant

Threader `{ userId, ip, requestId }` sur les signatures aurait touché des
dizaines de fonctions sans rapport avec l'audit (route → service → service pur
→ prisma), et n'aurait rien donné pour les jobs. `utils/audit-context.ts` pose
un `AsyncLocalStorage` via `middleware/auditContext.ts`, monté juste APRÈS
`requestContext()` (dont il réutilise le requestId comme corrélation) et
AVANT les routes. L'auth étant par route, `authUser`/`optionalAuthUser`
complètent l'acteur a posteriori (`setAuditActor`) — le store est donc mutable
sur l'acteur et le compteur d'étape, immutable sur le reste.

Hors contexte (script, test unitaire), tout dégrade sans lever : `step` = 1,
corrélation neuve. Pour un job, ouvrir le contexte explicitement :
`runAsAuditJob("league.postmatch.sequence", () => settle(matchId))`.

### Soft delete trace + reversion VERIFIEE (morts/licenciements)
Un statut qui retire une entite du perimetre actif (mort, licenciement)
n'est jamais un DELETE : c'est un flag + la **provenance** de qui l'a
pose. La provenance sert a verifier la reversion quand la source est
annulee (invalidation de feuille, annulation de match).

`services/player-status.ts` : `ACTIVE_PLAYER_WHERE` (le filtre canonique
`{ dead: false, firedAt: null }`), `applyPlayerStatus(es)` (idempotent :
skip si deja inactif) et `revertPlayerStatus` qui **refuse** si le statut
courant vient d'une autre source (`status-superseded`). Journal
append-only `TeamPlayerStatusEvent` (au plus 1 event `revertedAt: null`
par joueur).

```ts
const active = await prisma.teamPlayerStatusEvent.findFirst({
  where: { playerId, revertedAt: null }, orderBy: { createdAt: "desc" },
});
if (active.sourceType !== source || active.sourceId !== sourceId) {
  return { skipped: true, reason: "status-superseded" }; // pas de resurrection
}
// puis update CONDITIONNEL : count !== 1 => race => refus
```

Piege associe : filtrer `dead: false` SANS `firedAt: null` (ou l'inverse)
laisse passer la moitie des joueurs sortis. Garde CI :
`services/player-status-filters.test.ts` (ratchet + exceptions justifiees).

### Une colonne de RATTACHEMENT nullable ne peut pas servir de garde-fou

`Match.leagueRoundId` est `String?` avec `onDelete: SetNull`, et
`prisma/migrations/` est gitignoré (prod = `db push`) : elle est NULL sur les
matchs antérieurs à la colonne comme sur ceux dont le round a été supprimé.
Le garde-fou d'invalidation s'en servait pour reconnaître un match de
play-off — d'où « Reversion impossible: playoffs-generated » sur un match de
play-off bien réel. La source fiable est le lien OBLIGATOIRE :
`LeaguePairing.roundId`. Règle : un garde-fou lit la colonne non nullable du
chemin (ici le pairing), la nullable ne servant que de repli.

Corollaire de la même famille : `LeagueRound.kind` a pour défaut `"regular"`,
donc un tour de bracket créé à la main par le commissaire ne se déclare PAS
play-off. `bracketSlot` suffit à le reconnaître.

Piège voisin dans le même service : `advancePlayoffsAfterPairingComplete`
numérotait le tour suivant `round.roundNumber + 1`, or `startPlayoffs` crée
UN round par slot (demi 1 = N, demi 2 = N+1) — la finale visait donc le
numéro du round frère et la contrainte unique `(seasonId, roundNumber)`
faisait échouer sa création en silence. Tout nouveau round de saison doit
s'allouer `max(roundNumber) + 1`.

### Les Prières à Nuffle qui changent le barème de PSP

Deux prières de la table D16 modifient les PSP et sont dérivables de la
feuille : 10 « Passe Parfaite » (Réussite à 2 PSP) et 11 « Réception
Étourdissante » (1 PSP au réceptionneur). Le réceptionneur d'une passe est
saisi dans `targetPlayerId` et compté (`PlayerStatLine.receptions`), mais ne
gagne RIEN par défaut : la Réussite revient au lanceur.

`league-sheet-prayer-spp` (pur) alimente les deux chemins, qui ne peuvent
donc pas diverger : `computeSheetSpp` (PSP affichés, et prix de recrutement
d'un journalier) et `buildOfflineInputFromSummary` (PSP persistés, via le
canal `sppBonus` déjà couvert par la reversion). Chaque côté n'applique que
SES prières. La reconnaissance se fait sur le JET, `prayerId` étant absent
des feuilles anciennes.

### Reglements de tournoi : base d'abord, moteur en repli

Les « rules packs » (NAF World Cup 2027…) sont EDITABLES en base
(`TournamentRuleset` : `slug` unique + `enabled` + `definition` JSON) et
administrables depuis `/admin/data/tournament-rulesets`. Le registre
`@bb/game-engine` (`TOURNAMENT_RULESETS`) reste la transcription de
reference et le REPLI — meme posture que `Roster.regionalRules` /
`effectiveRegionalRules`.

- Toute lecture passe par `services/tournament-ruleset-repository`
  (`listTournamentRulesets`, `getTournamentRulesetDefinition`), asynchrone
  et caché en process. Ne PAS rappeler `getTournamentRuleset` du moteur
  dans du code applicatif : il ignore les editions admin.
- Le JSON stocke est valide par `schemas/tournament-ruleset.schemas`
  (`parseDefinition`) A L'ECRITURE ET A LA LECTURE. Une ligne invalide est
  ignoree (log + repli moteur), jamais servie.
- Deux pieges du stockage JSON, tous deux couverts par le parser :
  `Infinity` n'existe pas en JSON (la tranche de taxe sans borne se stocke
  `null`, cf. `serializeDefinition`), et la colonne remonte en objet natif
  (PG) ou en chaine (miroir SQLite).
- Le slug de la LIGNE fait foi sur celui du JSON (c'est lui que referencent
  `Team`/`League`/`Cup.tournamentRuleset`) et il ne se renomme pas.
- Cote web, plus aucune lecture du registre : `lib/tournament-rulesets`
  consomme `GET /api/tournament-rulesets` et rehydrate la borne ouverte.
- Le seed cree les lignes manquantes SANS ecraser une edition admin
  (`syncTournamentRulesets`, `force: true` pour reinitialiser).

Les fonctions PURES du moteur (bareme de competences, quota de cumul, taxe
Star Players, `validateTournamentSkillPlan`, `resolveTournamentEliteSkills`)
sont inchangees : elles prennent la definition en argument.

### Referentiels « base d'abord » : le catalogue compile est un REPLI

Lot 6 (audit statique vs base) a sorti du code les dernieres donnees de catalogue.
Le patron est TOUJOURS le meme, calque sur `tournament-ruleset-repository` :

| Donnee | Table | Repository | Repli compile |
|---|---|---|---|
| Coups de pouce | `Inducement` | `services/inducement-repository` | `INDUCEMENT_CATALOGUE` |
| Bareme d'avancement | `AdvancementCost` + `CharacteristicValue` + `RulesetConfig` | `services/advancement-schedule-repository` | `DEFAULT_ADVANCEMENT_SCHEDULE` |
| Regles speciales / Ligues | `TeamSpecialRule`, `RegionalLeague` | `services/team-rules-catalogue` | `TEAM_SPECIAL_RULES`, `REGIONAL_LEAGUES` |
| Univers des rosters | `Roster.slug` | `services/roster-catalogue` | `ALLOWED_TEAMS` |

Regles qui vont avec, et qu'il faut respecter pour tout nouveau referentiel :

1. **Le moteur ne lit pas Prisma.** Le serveur RESOUT le catalogue et le PASSE :
   `InducementContext.catalogue`, `AdvancementSchedule` en dernier parametre de
   `getNextAdvancementPspCost` / `surchargeForAdvancement`, `TeamRulesCatalogue` en
   dernier parametre des resolveurs de `public-rosters`. Le defaut de ce parametre
   est le catalogue compile : les fonctions restent PURES et testables sans base.
2. **Pas de fonction dans une definition de catalogue.** Les 4 `canPurchase` des
   coups de pouce (des closures) sont devenues des champs
   (`requiresAnyRule` / `requiresRoster` / `requiresApothecary`) evalues par
   `canPurchaseInducement(def, ctx)` — c'est ce qui les rend stockables.
3. **Une ligne incoherente n'est jamais servie a moitie** : cout negatif, plafond nul,
   bareme a trous ⇒ on ignore la ligne (ou le type entier) et on journalise, sinon un
   avancement devient gratuit ou un coup de pouce disparait du panier sans le dire.
4. **Le slug reste un contrat de code.** Une ligne creee en admin avec un slug inconnu
   du moteur est un pur libelle : elle se paie et s'affiche mais n'a AUCUN effet en
   match. L'API le dit (`wired` / `knownToEngine`), la console l'affiche.
5. **Cache court + `invalidate<X>Cache()`** appele par toutes les routes d'ecriture
   admin (TTL 5 min en prod, 0 ailleurs).
6. **Colonnes nullables, seeds create-if-missing.** `prisma/migrations/` est gitignore
   (`db push` en prod) : aucune colonne ajoutee ne peut etre backfillee. Elle est donc
   nullable et lue avec repli, et le seeder la renseigne SANS jamais ecraser une valeur
   deja posee (`sync-catalogue-columns`, `sync-team-rules`, `sync-inducements`,
   `sync-advancement-costs` ; `force: true` pour reinitialiser depuis le moteur).

Piege associe : `Roster.budget` est le budget **BB11**. Le defaut de construction passe
par `defaultBuildBudgetK(rosterBudgetK, format)` (`@bb/game-engine`, partage serveur ↔
builder web) — pour tout format autre que BB11, c'est le plafond du FORMAT qui gouverne,
sinon une equipe Sevens partirait avec 1000 kpo au lieu de 600.

### Ligues regionales d'un roster : UNE seule source (Roster.regionalRules)

Les Ligues d'un roster existent a deux endroits : la colonne editable
`Roster.regionalRules` (admin, servie par la fiche publique `/teams/[slug]`)
et la table canonique `TEAM_REGIONAL_RULES_BY_RULESET` du moteur. Des qu'un
admin edite la colonne, les deux divergent — bug observe sur les Halflings :
la fiche annoncait 2 Ligues, le selecteur de creation d'equipe en proposait 3.

Regle : `services/roster-regional-rules.effectiveRegionalRules` (base sinon
repli sur le catalogue du moteur) est LA resolution ; tout consommateur en
part. `getRegionalLeagueOptions(roster, ruleset, declaredRules)` accepte cette
liste et s'y limite. `getRosterFromDb` l'expose dans
`RosterPayload.regionalRules` pour les flux qui n'ont que le slug.

```ts
const declaredRules = effectiveRegionalRules(
  row.regionalRules, row.slug, ruleset,
).rules;
getRegionalLeagueOptions(row.slug, ruleset, declaredRules);
```

Restent des REGLES (pas des donnees editables), portees par le moteur :
les alignements conditionnes par la Ligue (`CONDITIONAL_GRANTS` — Nordiques
+ Clash du Chaos ⇒ Favori de Khorne) et les Ligues que la table ne sait pas
exprimer (`IMPLICIT_LEAGUES` — le Clash du Chaos des Nordiques).

### Parser tolerant PG + sqlite pour JSON fields (Q.A.2)
Pour les champs `Json?` qui peuvent etre array natif (PG), string
JSON serialisee (sqlite mirror), null ou undefined :

```ts
export function parseStringArrayJson(raw: unknown): readonly string[] {
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === "string");
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((s): s is string => typeof s === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}
```

### Composant section autonome avec `/auth/me` fetch interne (Q.B.2/Q.B.3)
Pour un composant de section (thread comments, predictions, etc.) qui
doit savoir si l'utilisateur est connecte sans propager `currentUserId`
depuis le parent :

```ts
useEffect(() => {
  apiRequest<MeResponse>("/auth/me")
    .then((m) => setCurrentUserId(m.user?.id ?? null))
    .catch(() => setCurrentUserId(null));
}, []);
```

Permet d'integrer le composant n'importe ou sans refactor parent.

### `vi.resetAllMocks` au lieu de `vi.clearAllMocks` (Q.D.1)
`clearAllMocks` clear seulement les calls/instances/results, **pas** la
queue `mockResolvedValueOnce`. Si les tests utilisent cette queue,
utiliser `resetAllMocks` qui vide aussi la queue. Sinon les valeurs
queue persistent entre tests et contaminent les fixtures suivantes.

```ts
beforeEach(() => {
  vi.resetAllMocks(); // vide aussi mockResolvedValueOnce queue
});
```

### `vi.mock` factory pour service avec class d'erreur typee (Q.D.1/Q.B.1)
Quand on mock un service qui exporte une class d'erreur (`MvpError`,
`SeasonFactoryError`, etc.), la class doit etre **dans la factory**
`vi.mock` — sinon "Cannot access X before initialization" :

```ts
vi.mock("../services/pro-mvp-vote", () => {
  class MvpError extends Error {
    constructor(public readonly code: string, message: string) {
      super(message);
      this.name = "MvpError";
    }
  }
  return { MvpError, submitVote: vi.fn() };
});
```

### `cloneGameState` drop-in pour `structuredClone(state)` (Sprint Perf)
Le clone deep par defaut etait `structuredClone(state) as GameState`,
correct mais cher (serialise tout l'arbre). `packages/game-engine/src/
core/clone-state.ts` fournit `cloneGameState(state)` : shallow spread
de la racine + deep clone selectif des sous-arbres mutables connus
(`players`, `dugouts.zones.*.players`, `matchStats`, `gameLog`, etc.).
Equivalent semantique a `structuredClone` mais ~9-11x plus rapide
(`clone-state.bench.test.ts`). Drop-in : `let next = cloneGameState(state);`.
Si tu ajoutes un champ mutable nested au `GameState`, il faut
l'inclure dans `cloneGameState` ET dans le test d'equivalence
`clone-state.test.ts`.

### WeakMap cache sur `players` array (Sprint Perf)
`packages/game-engine/src/core/state-cache.ts` indexe sur la
reference de `state.players` (stable tant que le state n'est pas
muté). Lazy : ne calcule qu'a la premiere requete. Utilise dans
`evaluator.ts` pour `findPlayerById`, `getActiveTeamPlayers`,
`getBallCarrier`. Les callers ne doivent **pas** muter les arrays
retournes (convention readonly non type-checked).

### Cache `evaluatePosition` per state (Sprint Perf)
WeakMap<GameState, { A?, B? }> cache uniquement le path SANS
`weightsOverride`. La raison : un override est un objet partiel
dont on ne peut pas hasher proprement. Le full driver sim-engine
qui passe des poids tactiques tombera sur le slow path. La majorite
des tests et de gameplay direct ne passe pas de weights -> hot cache.

## Pieges connus

### Une compétence déjà possédée n'est refusée nulle part par défaut

`applyAdvancementChoice` concaténait un doublon dans le CSV `skills` (le
commentaire renvoyait la vérification « au caller », qui ne la faisait pas)
et le pool de l'éditeur proposait les compétences déjà apprises. Seul le
tirage `random-primary` les excluait. Garde en place : refus serveur
`skill-already-owned`, vérifié AVANT tout le reste de la branche compétence.

### `nextLevelSpp(spp)` est **strictement** > spp (K)
La fonction retourne le premier seuil **au-dessus** de `spp`. Donc
`spp >= nextLevelSpp(spp)` est **toujours faux**. Ne **jamais** s'en
servir pour detecter "ready to level-up" — utiliser plutot le flag
brut server-side `levelForSpp(spp) > rawDbLevel`.

### Replay payload est `Buffer` compresse
`replay.payload` est un `Buffer` ; il faut `await decompressEvents(buf)`
(`@bb/sim-engine`) avant de lire les events. Toujours catcher
l'erreur car les replays anciens peuvent avoir un format different.

### Forme JSON sqlite vs postgres
Les colonnes `form`, `skills`, `meta` peuvent etre `string` (sqlite
mirror) ou array/object natif (PG). Parser tolerant obligatoire :

```ts
function parseSkills(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((s) => typeof s === "string");
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return []; }
  }
  return [];
}
```

### CI E2E API force-enable les flags
Le workflow `.github/workflows/e2e.yml` exporte
`FEATURE_FLAGS_FORCE_ENABLED: true`. Toujours penser a cette contrainte
quand on introduit un nouveau flag — soit le flag est coherent avec
un comportement on/on, soit c'est un kill-switch (cf. pattern dedie
ci-dessus) et doit etre liste dans `KILL_SWITCH_FLAGS`.

### Un `|| echo` sur une step de test AVALE tous les echecs

Piege le plus couteux de la vague d'aout 2026 (#1000) : la step « Unit tests »
de `ci.yml` se terminait par `|| echo "..."`, cense tolerer les workspaces e2e
qui n'ont pas leur infra sur le runner. En pratique il noyait le code de sortie
de **toutes** les suites — `@bb/tests` et `@bb/tests-integration` ont derive au
rouge pendant des semaines sans qu'aucune CI ne le signale (27 tests casses au
moment de la decouverte).

Regle : on **exclut par filtre** ce qui ne doit pas tourner, on n'avale jamais
le code de sortie de la commande entiere.

```yaml
# NON — masque aussi les vrais echecs des suites qu'on voulait garder
run: pnpm -w test || echo "certaines suites ne tournent pas ici"

# OUI — les suites restantes gatent la CI
# `--` transmet les filtres a TURBO (le script racine est `turbo run test`)
run: pnpm -w test -- --filter='!@bb/tests-e2e-api' --filter='!@bb/tests-e2e-ui'
```

Le meme defaut subsiste ailleurs, non corrige a ce jour — le jour ou on y
touche, c'est un filtre, pas un fallback :

| Ou | Ligne |
|---|---|
| `ci.yml` step Typecheck | `pnpm -w run typecheck \|\| echo "No explicit typecheck scripts..."` |
| `@bb/server`, `@bb/web`, `@bb/ui` | `"lint": "eslint . \|\| true"` |
| `@bb/mobile` | pas de script `lint` du tout |

### Un merge fait par le GITHUB_TOKEN n'emet pas d'event `push`
`auto-merge.yml` merge les PR avec `secrets.GITHUB_TOKEN`. GitHub
**n'emet volontairement aucun event** (`push`, `pull_request`…) pour les
commits crees par ce token, pour eviter les boucles de workflows. Effet
de bord observe (PR #933 → #935, juillet 2026) : `deploy.yml`, `e2e.yml`
et `semantic-release.yml`, tous declenches sur `push: branches: [main]`,
n'ont plus tourne sur les PR auto-mergees — deploy prod a du etre lance
a la main et aucune release n'est sortie.

Contournement en place : `auto-merge.yml` relance explicitement les
workflows aval via `github.rest.actions.createWorkflowDispatch({ ref:
'main' })` apres un merge reussi. `workflow_dispatch` et
`repository_dispatch` sont les **seuls** events que le GITHUB_TOKEN a le
droit de creer. Necessite `permissions: actions: write`.

Consequence : tout nouveau workflow declenche par `push` sur main doit
etre ajoute a `DOWNSTREAM_WORKFLOWS` dans `auto-merge.yml` **et** exposer
un trigger `workflow_dispatch`, sinon il ne tournera jamais sur les PR
auto-mergees.

### supertest n'est pas dans les deps
Pour tester un Express handler en isolation, utiliser
`http.createServer(express())` + `http.request` natif au lieu de
`supertest`. Pattern dans `apps/server/src/routes/auth-register.test.ts`.

### jsdom n'expose pas `document.execCommand`
Pour tester le fallback clipboard, injecter manuellement la methode :

```ts
Object.defineProperty(document, "execCommand", {
  configurable: true,
  writable: true,
  value: vi.fn().mockReturnValue(true),
});
```

### URLSearchParams encode spaces as `+`
Quand on teste un URL genere par `URLSearchParams`, decoder le `+` en
espace avant le `decodeURIComponent` :

```ts
const decoded = decodeURIComponent(link.href.replace(/\+/g, " "));
```

## Workflow git

### Branches
- Branche par lot : `claude/<scope>-<short-desc>`. Ex :
  `claude/lot-k-applier-audit`, `claude/lot-l-player-match-history`.
- **Toujours** depuis main : `git checkout main && git pull && git
  checkout -b ...`.
- Commit message convention : `feat(scope): description` /
  `fix(scope): description`. Detail en body. Pas de signature
  Claude/Anthropic en footer (desactive globalement).

### PR paralleles depuis main
Plusieurs PR independantes peuvent partir de main et merger en ordre
arbitraire. Conflits possibles sur composants partages (ex: Lot H
modifie la signature de `RosterTable`, Lot G aussi) — rebase trivial.

Quand le risque de conflit est gros : sequencer.

### Webhooks PR
- `subscribe_pr_activity` apres `create_pull_request` ⇒ on recoit les
  events merge / CI / review en webhook.
- **Ne pas poller** avec `sleep` — attendre les webhooks.

## Spec-driven & journal de decisions (OpenSpec)

OpenSpec est en place (`openspec/`, skills `openspec-*`, commandes
`/opsx:*` + `/ideas`). Il sert de **journal de decisions versionne** :
chaque change capture le *quoi/pourquoi* et le *comment* **avant** le
code. C'est notre substitut d'ADR — pas de dossier `docs/decisions/`
separe, la decision vit dans le change.

### Chaine de travail

```
/ideas              → backlog d'idees priorisees (ancre dans le repo)
/opsx:explore "X"   → reflexion, clarification des exigences
/opsx:propose "X"   → genere proposal.md + design.md + specs/ + tasks.md
/opsx:apply         → implementation des taches
/opsx:sync          → delta-specs → specs/ principales
/opsx:archive       → change termine → openspec/changes/archive/
```

### Regles

- **Tout change non-trivial passe par un proposal OpenSpec.** Le
  `proposal.md` documente la decision (quoi + pourquoi), le `design.md`
  les alternatives et tradeoffs. C'est ca, le "pourquoi" versionne.
- **Les artefacts OpenSpec sont commits avec la PR** qui les realise.
  Branche et commit suivent les memes conventions que la section
  "Workflow git" ci-dessus.
- **Idees** : capturees via `/ideas` puis, si retenues sans suite
  immediate, ajoutees a `docs/roadmap/backlog/future-ideas.md`.
- **Apres merge** : `/opsx:sync` **puis** `/opsx:archive`. Le sync verse la
  delta-spec dans `openspec/specs/<capability>/spec.md` (`## ADDED
  Requirements` → `## Requirements`, description → `## Purpose`) ; l'archive
  deplace le change dans `openspec/changes/archive/YYYY-MM-DD-<nom>/`. Le
  recit de session reste dans `docs/roadmap/sessions/` comme avant.
- **Ne PAS enterrer les suites en archivant.** Les taches d'un change
  marquees « hors perimetre » / « hors lot » / « suites possibles » partent
  avec lui dans l'archive. Elles se remontent dans
  [`docs/roadmap/backlog/openspec-suites.md`](./docs/roadmap/backlog/openspec-suites.md)
  — distinct de `future-ideas.md`, qui porte une gate de reactivation liee
  aux KPI Pro League et ne s'applique PAS a ces suites.
- Les fixes triviaux (typo, bump deps) n'ont pas besoin d'un change.

## Tests

### Coverage cible
- 80% min globalement, enforce dans common rules.
- Tests unitaires + integration + E2E (Playwright) selon le scope.

### Mock pattern Prisma
```ts
vi.mock("../prisma", () => ({
  prisma: {
    proTeamRoster: { findUnique: vi.fn(), groupBy: vi.fn() },
  },
}));
```

Le mock doit declarer **toutes** les methodes utilisees, sinon
`TypeError: Cannot read properties of undefined`.

### Mock services purs reutilises
Si un service A re-utilise B (ex: Lot L reutilise `attributeSpp` de
`pro-roster-spp`), mock le module B pour eviter de tester deux fois
les regles :

```ts
vi.mock("./pro-roster-spp", () => ({
  attributeSpp: vi.fn(),
}));
```

## Compendium des regles BB (docs .md <-> web .json)

Les regles Blood Bowl 2025 (saison 3) existent en DEUX representations
au role DIFFERENT, a garder coherentes **dans le meme commit** :

- **Reference fidele (NON publiee)** : `docs/regles-bb-2025/*.md` =
  transcription mot a mot des photos du livre (une page = un fichier +
  `README.md`). Sert de source d'exactitude. ATTENTION juridique : c'est une
  reproduction litterale (PI Games Workshop) — a NE PAS exposer telle quelle
  sur le site public ; la garder comme reference interne.
- **Contenu publie (REECRIT)** : `apps/web/app/compendium/data/rules-bb-2025.json`
  = resumes REFORMULES avec nos propres mots (anti-contrefacon), fluff/lore
  et exemples nominatifs SUPPRIMES, donnees factuelles conservees (des, seuils,
  couts, caracteristiques). Objet `Compendium` = `meta` + `chapters[]`
  (`slug`, `title`, `summary`, `sourcePages[]`, `blocks[]` typés —
  heading/paragraph/list/table/callout ; PAS de callout "info"/"example" sur
  le contenu publie). Importe statiquement par `apps/web/app/compendium/`
  (index + `[slug]`, SSG `generateStaticParams`, ISR 3600s). Pas de DB.
  Disclaimer de non-affiliation rendu dans `layout.tsx`.

- **Regles cablees dans le moteur (3e representation)** : quand une regle
  transcrite est aussi implementee, le code est la 3e representation a
  garder alignee. Cas connu : la table 2D6 de coup d'envoi vit dans
  `packages/game-engine/src/mechanics/kickoff-events.ts`
  (`KICKOFF_EVENTS`), qui alimente le moteur ET la liste deroulante de
  saisie des feuilles de match de ligue
  (`apps/web/app/leagues/pairings/[id]/sheet`). Le garde-fou est
  `apps/web/app/compendium/kickoff-table-consistency.test.ts` (les 11
  `nameFr` du moteur == les 11 lignes publiees).

**Regle** : le `.json` ne recopie PAS les phrases du `.md` (sinon le risque
PI revient). Toute evolution d'une regle (correction, nouvelle edition,
ajout/retrait de chapitre) se repercute sur le `.md` (transcription) ET sur
le `.json` (version reformulee) ET sur le code du moteur s'il implemente la
regle, en gardant la MEME structure (chapitres, `sourcePages`) et le meme
SENS — mais des formulations distinctes. Bumper `meta.version`. Apres
edition du `.json`, `pnpm --filter web typecheck` +
`pnpm --filter web vitest run app/compendium` doivent passer.

> Piege verifie (aout 2026) : le compendium publie peut etre juste alors
> que le moteur sert encore la table de l'edition precedente. Les
> identifiants d'evenement etant persistes dans les feuilles de match
> (`LeagueMatchEvent.meta.kickoffEvent`), tout renommage doit passer par
> `LEGACY_KICKOFF_EVENT_IDS` pour que l'historique reste lisible.

## Historique sessions

- **2026-05-10** : Pro League UI polish, 12 lots/PRs (#728-#742). Voir
  [`docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md`](./docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md).
- **2026-05-11** : Sprint O — Bug fixes engine + deblocage acquisition,
  7 lots/PRs (#745-#751) + docs sprints O/P/Q/R (#744). Audit 7 agents
  → fixes regen/apothecary BB order, onboarding modal, daily bonus,
  badge toast, OG image, share buttons, match report banner. Voir
  [`docs/roadmap/sessions/2026-05-11-sprint-O.md`](./docs/roadmap/sessions/2026-05-11-sprint-O.md).
- **2026-05-12** : Sprint Q (Differenciation fan), 12 PRs (#772-#784).
  Q.A complete (career page + rivalries + Gazette narrative),
  Q.B complete (vote MVP + commentaires + fan predictions), Q.D
  complete (mini-leagues prediction + Survivor). Q.C (clips MP4)
  differe. 8 nouveaux modeles Prisma. Voir
  [`docs/roadmap/sessions/2026-05-12-sprint-Q.md`](./docs/roadmap/sessions/2026-05-12-sprint-Q.md).
- **2026-05 (post-Q)** : **NFL Fantasy** — nouvel axe MPG-like sur stats
  NFL reelles skinnees BB (axe additionnel, pas un remplacement). Package
  pur `@bb/nfl-mapper` (team→race, poste→BB, stats→SPP, pseudonymize),
  ingestion nflverse + ESPN, league CRUD + roster/lineup + scoring +
  mercato, orchestrateur cron 5min, admin data explorer, frontend
  `/nfl-fantasy/*` + console `/admin/nfl-fantasy/*`, Gazette LLM par
  matchup (Haiku), backfill saisons 2023+2024, bootstrap prod. ~14
  modeles Prisma `Nfl*`. Doc vivante :
  [`docs/nfl-fantasy/README.md`](./docs/nfl-fantasy/README.md).
- **2026-06-06** : Gestion des Ligues (audit "Liste de course Nuffle
  Arena"), 3 PRs (#886-#888). Lots A/B/C/D/E/F (invitations, withdraw
  guard, multi-poules + scheduler, override PO, points bonus, saisie
  manuelle), G/H (feuille de match v2 : events + summarizer pur +
  validation branchee offline + alerte commissaire), I/J (edition
  ex-post commissaire + classements joueurs), polish (auto-tresorerie,
  panneaux pre/post-match, fenetre d'invalidation). 5 migrations. Gating
  par un flag UNIQUE `league` (les 7 sous-flags `league_*` ont ete
  fusionnes le 2026-06-30 — voir memoire `nuffle-arena ligue = flag
  unique`). Voir
  [`docs/roadmap/sessions/2026-06-06-league-management.md`](./docs/roadmap/sessions/2026-06-06-league-management.md)
  + guide rollout
  [`docs/roadmap/league-feature-flags-rollout.md`](./docs/roadmap/league-feature-flags-rollout.md).
- **2026-06-08** : Ligues — modeles `LeaguePool` + `LeagueMatch` avec
  config de points bonus + fonctionnalite "participant de test" (v1.172-
  1.173).
- **2026-08-17→09-01** : **Vague « gestion d'equipe & feuille de match »**
  (#938-#1006). 69 PR, 859 fichiers, ~123 500 lignes, 197 nouveaux fichiers
  de test, 6 modeles Prisma (`TournamentRuleset`, `Inducement`,
  `AdvancementCost`, `CharacteristicValue`, `RulesetConfig`,
  `TeamAuditEvent`). Quatre chantiers : **feuille de match conforme au
  livre** (sequence de fin de match p.68, gel a l'ouverture, journaliers
  panachables, PSP de reception, invalidation d'un match de play-off,
  catalogue d'embauche) ; **valeur d'equipe** (separation or/valeur, Fans
  Devoues hors VE/VEA, « Trois-quarts a vil prix » en VEA, surcout des
  competences d'Elite) ; **referentiels « base d'abord »** (audit + lots 1→6) ;
  **journal d'equipe** (`TeamAuditEvent`). Plus la correction de la CI qui
  **avalait les echecs de test** depuis des semaines (#1000, 27 tests
  repares). Recit complet :
  [`docs/roadmap/sessions/2026-09-02-vague-gestion-equipe-et-feuille-de-match.md`](./docs/roadmap/sessions/2026-09-02-vague-gestion-equipe-et-feuille-de-match.md).
  Les regles et pieges qui en sortent sont consignes dans les sections
  « Conventions code » et « Pieges connus » ci-dessus.
- **2026-08-27** : Audit « statique vs base » + **lot 6** (modele de donnees
  « base d'abord ») : `Inducement`, `AdvancementCost`/`CharacteristicValue`/
  `RulesetConfig`, colonnes `pairWithSlug`/`maxBigGuys`/`displayNameEn`,
  categorie `StarPlayerRule`, `TeamSpecialRule`/`RegionalLeague` branchees,
  `ALLOWED_TEAMS` → `Roster`, budget par defaut `Roster.budget`. Voir
  [`docs/audit-statique-vs-bdd-2026-08-27.md`](./docs/audit-statique-vs-bdd-2026-08-27.md)
  et [`docs/lot6-modele-de-donnees-2026-08-27.md`](./docs/lot6-modele-de-donnees-2026-08-27.md).
- **2026-06-13→15** : Vague acquisition/retention web (#890-#897).
  Refonte home Nuffle dans l'esprit BB + accueil personnalise (coach
  connecte vs marketing deconnecte) + SEO competences + stats live +
  partage roster ; comparateur de rosters + pages de comparaison SSR +
  tier-list (#893) ; notifications de re-engagement (Web Push persistant
  + digest e-mail hebdo, #894) ; assistant onboarding "Cree ton equipe
  en 60 secondes" (#895) ; OpenSpec workflow skills + commands (#897).
