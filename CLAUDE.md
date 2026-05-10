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
  shared-types/ # Types partages
prisma/         # Schema + migrations
```

Outils : pnpm workspaces, Turbo pour les tasks, Vitest pour les tests
(server + web), Playwright pour E2E.

## Conventions code

### Backend (`apps/server`)
- **Services** : pure logic dans `src/services/*.ts`. Pas d'I/O dans
  les fonctions exportees marquees "pur".
- **Routes** : `src/routes/*.ts` avec handler + Zod schema + middleware
  (`authUser`, `adminOnly`, `validate`).
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

## Historique sessions

- **2026-05-10** : Pro League UI polish, 12 lots/PRs (#728-#742). Voir
  [`docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md`](./docs/roadmap/sessions/2026-05-10-pro-league-ui-polish.md).
