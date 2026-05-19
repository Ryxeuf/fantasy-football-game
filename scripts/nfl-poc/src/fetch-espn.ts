import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "..", "fixtures");

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

interface EspnCompetitor {
  readonly id: string;
  readonly homeAway: "home" | "away";
  readonly team?: { readonly abbreviation?: string; readonly displayName?: string };
  readonly score?: string;
  readonly winner?: boolean;
}

interface EspnEvent {
  readonly id: string;
  readonly date: string;
  readonly name: string;
  readonly shortName?: string;
  readonly status?: { readonly type?: { readonly completed?: boolean; readonly description?: string } };
  readonly competitions?: ReadonlyArray<{ readonly competitors?: readonly EspnCompetitor[] }>;
}

interface EspnScoreboard {
  readonly events?: readonly EspnEvent[];
  readonly week?: { readonly number?: number };
  readonly season?: { readonly year?: number; readonly type?: number };
}

async function fetchJson<T>(url: string): Promise<T> {
  console.log(`[espn] GET ${url}`);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`[espn] fetch failed ${res.status} ${res.statusText} — url=${url}`);
  }
  return (await res.json()) as T;
}

async function saveFixture(name: string, data: unknown): Promise<string> {
  await mkdir(FIXTURES_DIR, { recursive: true });
  const path = join(FIXTURES_DIR, name);
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
  return path;
}

export async function fetchScoreboard(dateYmd: string): Promise<EspnScoreboard> {
  const url = `${ESPN_BASE}/scoreboard?dates=${dateYmd}`;
  return fetchJson<EspnScoreboard>(url);
}

export async function fetchSummary(eventId: string): Promise<unknown> {
  const url = `${ESPN_BASE}/summary?event=${eventId}`;
  return fetchJson<unknown>(url);
}

function formatEvent(evt: EspnEvent): string {
  const status = evt.status?.type?.description ?? "?";
  const competitors = evt.competitions?.[0]?.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  const homeStr = `${home?.team?.abbreviation ?? "?"} ${home?.score ?? "-"}`;
  const awayStr = `${away?.team?.abbreviation ?? "?"} ${away?.score ?? "-"}`;
  return `${evt.id.padEnd(12)} ${awayStr.padStart(8)} @ ${homeStr.padEnd(8)} [${status}] — ${evt.date}`;
}

export async function runEspnPoc(dateYmd: string): Promise<void> {
  console.log(`[espn] === poll scoreboard ${dateYmd} ===`);
  const scoreboard = await fetchScoreboard(dateYmd);
  const sbPath = await saveFixture(`espn-scoreboard-${dateYmd}.json`, scoreboard);
  console.log(`[espn] saved scoreboard → ${sbPath}`);

  const events = scoreboard.events ?? [];
  console.log(
    `[espn] season=${scoreboard.season?.year ?? "?"} type=${scoreboard.season?.type ?? "?"} week=${scoreboard.week?.number ?? "?"} events=${events.length}`
  );

  if (events.length === 0) {
    console.log("[espn] no events for this date — try another date (off-season ?)");
    return;
  }

  for (const evt of events) {
    console.log(`  ${formatEvent(evt)}`);
  }

  const sample = events[0];
  if (!sample) return;
  console.log(`\n[espn] fetching summary for event ${sample.id}…`);
  const summary = await fetchSummary(sample.id);
  const sumPath = await saveFixture(`espn-summary-${sample.id}.json`, summary);
  console.log(`[espn] saved summary → ${sumPath}`);

  const summaryAsRecord = summary as Record<string, unknown>;
  const topKeys = Object.keys(summaryAsRecord).slice(0, 20);
  console.log(`[espn] summary top-level keys (${Object.keys(summaryAsRecord).length}): ${topKeys.join(", ")}`);
}
