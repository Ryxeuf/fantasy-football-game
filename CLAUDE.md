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
- **Apres merge** : `/opsx:archive` deplace le change dans
  `openspec/changes/archive/` (historique permanent versionne). Le
  recit de session reste dans `docs/roadmap/sessions/` comme avant.
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

**Regle** : le `.json` ne recopie PAS les phrases du `.md` (sinon le risque
PI revient). Toute evolution d'une regle (correction, nouvelle edition,
ajout/retrait de chapitre) se repercute sur le `.md` (transcription) ET sur
le `.json` (version reformulee), en gardant la MEME structure (chapitres,
`sourcePages`) et le meme SENS — mais des formulations distinctes. Bumper
`meta.version`. Apres edition du `.json`, `pnpm --filter web typecheck` +
`pnpm --filter web vitest run app/compendium/data.test.ts` doivent passer.

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
- **2026-06-13→15** : Vague acquisition/retention web (#890-#897).
  Refonte home Nuffle dans l'esprit BB + accueil personnalise (coach
  connecte vs marketing deconnecte) + SEO competences + stats live +
  partage roster ; comparateur de rosters + pages de comparaison SSR +
  tier-list (#893) ; notifications de re-engagement (Web Push persistant
  + digest e-mail hebdo, #894) ; assistant onboarding "Cree ton equipe
  en 60 secondes" (#895) ; OpenSpec workflow skills + commands (#897).
