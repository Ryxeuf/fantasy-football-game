/**
 * Smoke test DISTANT, en lecture seule, authentifié par une clé API
 * d'administration (change OpenSpec `admin-api-keys`, doc
 * `docs/admin-api-keys.md`).
 *
 *   NUFFLE_API_URL=https://api.nufflearena.fr \
 *   NUFFLE_API_KEY=nak_… \
 *   pnpm smoke:remote            # rapport lisible, code 1 si un échec
 *   pnpm smoke:remote -- --json  # rapport JSON
 *
 * Ne dépend NI de Prisma NI des routes `/__test/*` : il vise un serveur
 * déployé (prod, recette). Aucune vérification n'écrit quoi que ce soit —
 * la seule requête non-GET est un garde-fou qui DOIT être refusée (une clé
 * ne crée pas de clé). Le secret n'est jamais affiché : toute sortie passe
 * par `redact`.
 *
 * Sans `NUFFLE_API_KEY`, les vérifications authentifiées sont tout de même
 * jouées (un proxy peut injecter l'en-tête lui-même) et rapportées
 * « ignorées » si le serveur répond 401.
 *
 * Le `fetch` natif de Node ne suit `HTTPS_PROXY` qu'avec
 * `NODE_USE_ENV_PROXY=1` (posé par le script racine `smoke:remote`) — c'est
 * le cas des environnements cloud de Claude Code.
 */

export const DEFAULT_API_URL = "https://api.nufflearena.fr";
const REQUEST_TIMEOUT_MS = 15_000;

export type SmokeAuth = "none" | "key";

export interface SmokeCheck {
  readonly name: string;
  readonly method: "GET" | "POST";
  readonly path: string;
  readonly auth: SmokeAuth;
  readonly expectStatus: number;
  /** Contrôle du corps : message d'échec, ou `null` si conforme. */
  readonly validate?: (body: unknown) => string | null;
}

export type SmokeOutcome = "pass" | "fail" | "skip";

export interface SmokeResult {
  readonly name: string;
  readonly method: string;
  readonly path: string;
  readonly outcome: SmokeOutcome;
  readonly httpStatus: number | null;
  readonly durationMs: number;
  readonly detail: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `GET /auth/me` doit décrire un ADMIN authentifié PAR CLÉ. */
export function validateIdentity(body: unknown): string | null {
  const user = isRecord(body) && isRecord(body.user) ? body.user : null;
  if (!user) return "réponse sans `user`";
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (!roles.includes("admin")) return "le propriétaire de la clé n'est pas admin";
  if (!isRecord(user.apiKey)) {
    return "requête non reconnue comme authentifiée par clé (serveur antérieur aux clés API ?)";
  }
  return null;
}

export const SMOKE_CHECKS: readonly SmokeCheck[] = [
  { name: "Serveur vivant", method: "GET", path: "/health", auth: "none", expectStatus: 200 },
  { name: "Base joignable", method: "GET", path: "/health/ready", auth: "none", expectStatus: 200 },
  {
    name: "Flags publics",
    method: "GET",
    path: "/api/feature-flags/me",
    auth: "none",
    expectStatus: 200,
  },
  { name: "Rosters publics", method: "GET", path: "/api/rosters", auth: "none", expectStatus: 200 },
  {
    name: "Règlements de tournoi",
    method: "GET",
    path: "/api/tournament-rulesets",
    auth: "none",
    expectStatus: 200,
  },
  {
    name: "Identité de la clé",
    method: "GET",
    path: "/auth/me",
    auth: "key",
    expectStatus: 200,
    validate: validateIdentity,
  },
  { name: "Admin — statistiques", method: "GET", path: "/admin/stats", auth: "key", expectStatus: 200 },
  {
    name: "Admin — feature flags",
    method: "GET",
    path: "/admin/feature-flags",
    auth: "key",
    expectStatus: 200,
  },
  {
    name: "Admin — journal d'audit",
    method: "GET",
    path: "/admin/audit-log?limit=1",
    auth: "key",
    expectStatus: 200,
  },
  { name: "Ligues", method: "GET", path: "/leagues", auth: "key", expectStatus: 200 },
  { name: "Coupes", method: "GET", path: "/cup", auth: "key", expectStatus: 200 },
  {
    // Garde-fou : refusé AVANT tout traitement, que la clé soit en lecture
    // seule (403 api_key_read_only) ou en écriture (403
    // interactive_session_required). Rien n'est jamais créé.
    name: "Garde-fou — une clé ne crée pas de clé",
    method: "POST",
    path: "/admin/api-keys",
    auth: "key",
    expectStatus: 403,
  },
];

/** Masque le secret partout où il pourrait réapparaître. */
export function redact(text: string, secret: string | null): string {
  if (!secret) return text;
  return text.split(secret).join("nak_***");
}

export function normalizeBaseUrl(raw: string | undefined): string {
  const value = (raw ?? "").trim() || DEFAULT_API_URL;
  return value.replace(/\/+$/, "");
}

type FetchLike = (
  input: string,
  init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<{ status: number; text: () => Promise<string> }>;

export interface RunSmokeOptions {
  readonly baseUrl: string;
  readonly apiKey: string | null;
  readonly fetchImpl?: FetchLike;
  readonly checks?: readonly SmokeCheck[];
  readonly now?: () => number;
}

function parseBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function excerpt(body: unknown): string {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  return raw && raw.length > 160 ? `${raw.slice(0, 160)}…` : raw ?? "";
}

async function runCheck(
  check: SmokeCheck,
  options: RunSmokeOptions,
  fetchImpl: FetchLike,
  now: () => number,
): Promise<SmokeResult> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (check.auth === "key" && options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }
  let body: string | undefined;
  if (check.method !== "GET") {
    headers["Content-Type"] = "application/json";
    body = "{}";
  }
  const base = { name: check.name, method: check.method, path: check.path };
  const started = now();
  try {
    const response = await fetchImpl(`${options.baseUrl}${check.path}`, {
      method: check.method,
      headers,
      body,
      signal:
        typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(REQUEST_TIMEOUT_MS)
          : undefined,
    });
    const parsed = parseBody(await response.text());
    const durationMs = now() - started;
    const result = (outcome: SmokeOutcome, detail: string | null): SmokeResult => ({
      ...base,
      outcome,
      httpStatus: response.status,
      durationMs,
      detail: detail === null ? null : redact(detail, options.apiKey),
    });

    if (check.auth === "key" && !options.apiKey && response.status === 401) {
      return result("skip", "aucune clé fournie (NUFFLE_API_KEY)");
    }
    if (response.status !== check.expectStatus) {
      return result(
        "fail",
        `HTTP ${response.status} au lieu de ${check.expectStatus} — ${excerpt(parsed)}`,
      );
    }
    const problem = check.validate ? check.validate(parsed) : null;
    return problem ? result("fail", problem) : result("pass", null);
  } catch (err) {
    return {
      ...base,
      outcome: "fail",
      httpStatus: null,
      durationMs: now() - started,
      detail: redact(err instanceof Error ? err.message : String(err), options.apiKey),
    };
  }
}

/** Joue les vérifications l'une après l'autre (sous le rate limit). */
export async function runSmoke(options: RunSmokeOptions): Promise<SmokeResult[]> {
  const fetchImpl: FetchLike =
    options.fetchImpl ?? ((input, init) => fetch(input, init));
  const now = options.now ?? Date.now;
  const results: SmokeResult[] = [];
  for (const check of options.checks ?? SMOKE_CHECKS) {
    results.push(await runCheck(check, options, fetchImpl, now));
  }
  return results;
}

const ICONS: Record<SmokeOutcome, string> = { pass: "✅", fail: "❌", skip: "⏭️" };

export function formatReport(
  results: readonly SmokeResult[],
  context: { readonly baseUrl: string; readonly hasKey: boolean },
): string {
  const lines = [
    `Smoke test distant — ${context.baseUrl} (${context.hasKey ? "clé fournie" : "sans clé"})`,
    "",
  ];
  for (const r of results) {
    const status = r.httpStatus === null ? "—" : String(r.httpStatus);
    lines.push(
      `${ICONS[r.outcome]} ${r.name} — ${r.method} ${r.path} → ${status} (${r.durationMs} ms)`,
    );
    if (r.detail) lines.push(`   ${r.detail}`);
  }
  const count = (o: SmokeOutcome) => results.filter((r) => r.outcome === o).length;
  lines.push("", `Total : ${count("pass")} réussie(s), ${count("fail")} échec(s), ${count("skip")} ignorée(s)`);
  return lines.join("\n");
}

export function hasFailure(results: readonly SmokeResult[]): boolean {
  return results.some((r) => r.outcome === "fail");
}

async function main(): Promise<void> {
  const baseUrl = normalizeBaseUrl(process.env.NUFFLE_API_URL);
  const apiKey = process.env.NUFFLE_API_KEY?.trim() || null;
  const results = await runSmoke({ baseUrl, apiKey });
  const output = process.argv.includes("--json")
    ? redact(JSON.stringify({ baseUrl, hasKey: apiKey !== null, results }, null, 2), apiKey)
    : formatReport(results, { baseUrl, hasKey: apiKey !== null });
  process.stdout.write(`${output}\n`);
  if (hasFailure(results)) process.exitCode = 1;
}

// Exécution directe uniquement (le module reste importable par les tests).
if (process.argv[1]?.includes("remote-smoke")) {
  main().catch((err: unknown) => {
    process.stderr.write(`[remote-smoke] échec : ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
