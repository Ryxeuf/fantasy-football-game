/**
 * Lot 4 « évolution persistée » — helpers PURS du coach IA d'une ProTeam.
 *
 * Tout ce qui se dérive sans base : le nom du coach (déterministe par
 * équipe), sa philosophie (lue dans le profil), la relecture tolérante des
 * colonnes JSON (objet natif en PG, chaîne sérialisée sur le miroir SQLite)
 * et le résumé lisible d'une évolution pour la Gazette.
 */

import {
  DEFAULT_TACTICAL_PROFILE,
  EMPTY_COACH_MEMORY,
  safeParseTacticalProfile,
  type CoachMemory,
  type DriveRecord,
  type ProfileChange,
  type TacticalProfile,
} from "@bb/sim-engine";

const FIRST_NAMES = [
  "Grishnak", "Borrin", "Elanor", "Thrud", "Mordecai", "Vexa", "Harald",
  "Sylvara", "Ugluk", "Petra", "Dagmar", "Ravenna", "Oswin", "Zoltan",
  "Brunhild", "Kael",
] as const;

const LAST_NAMES = [
  "Ironjaw", "Stonebeard", "Swiftleaf", "Bonecrusher", "Blackquill",
  "Thornfield", "Skullsplitter", "Moonshadow", "Gutripper", "Hardcastle",
  "Frostmane", "Nightbloom", "Ashworth", "Fangmoor", "Oakenshield", "Vale",
] as const;

/** FNV-1a 32 bits — même famille que `personalityFor` côté sim-engine. */
export function hashSlug(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Nom de coach déterministe pour une équipe (stable entre deux seeds). */
export function coachNameFor(teamSlug: string): string {
  const h = hashSlug(`coach:${teamSlug}`);
  const first = FIRST_NAMES[h % FIRST_NAMES.length];
  const last = LAST_NAMES[Math.floor(h / FIRST_NAMES.length) % LAST_NAMES.length];
  return `${first} ${last}`;
}

interface Trait {
  readonly parameter: keyof TacticalProfile;
  readonly high: string;
  readonly low: string;
}

const TRAITS: readonly Trait[] = [
  { parameter: "bashIndex", high: "Cogneur", low: "Technicien" },
  { parameter: "passingFrequency", high: "Aérien", low: "Terrien" },
  { parameter: "riskAppetite", high: "Joueur", low: "Prudent" },
  { parameter: "cageAffinity", high: "Bâtisseur de cage", low: "Adepte du jeu ouvert" },
  { parameter: "pace", high: "Pressé", low: "Posé" },
  { parameter: "foulFrequency", high: "Vicieux", low: "Correct" },
  { parameter: "stallTendency", high: "Temporisateur", low: "Franc-tireur" },
  { parameter: "pressingDefense", high: "Presseur", low: "Défenseur de zone" },
  { parameter: "patience", high: "Patient", low: "Impulsif" },
  { parameter: "breakawayInstinct", high: "Amateur d'échappées", low: "Collectif" },
];

/**
 * Philosophie en deux traits, lus sur les paramètres les plus marqués
 * (écart à 50). « Équilibré » quand rien ne dépasse 10 points d'écart.
 */
export function describePhilosophy(profile: TacticalProfile): string {
  const ranked = TRAITS.map((t) => ({ t, gap: profile[t.parameter] - 50 }))
    .filter((x) => Math.abs(x.gap) > 10)
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 2);
  if (ranked.length === 0) return "Équilibré";
  const words = ranked.map((x, i) => {
    const label = x.gap > 0 ? x.t.high : x.t.low;
    return i === 0 ? label : label.toLowerCase();
  });
  return words.join(", ");
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function parseJsonArray(raw: unknown): readonly unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Profil tactique relu depuis une colonne JSON ; `fallback` si illisible. */
export function parseStoredProfile(
  raw: unknown,
  fallback: TacticalProfile = DEFAULT_TACTICAL_PROFILE,
): TacticalProfile {
  const obj = parseJsonObject(raw);
  if (!obj) return fallback;
  const parsed = safeParseTacticalProfile(obj);
  return parsed.success ? parsed.data : fallback;
}

/** Mémoire du coach relue depuis une colonne JSON ; vide si illisible. */
export function parseStoredMemory(raw: unknown): CoachMemory {
  const obj = parseJsonObject(raw);
  const strategies = obj ? parseJsonObject(obj.strategies) : null;
  if (!strategies) return EMPTY_COACH_MEMORY;
  const out: Record<string, { ema: number; samples: number }> = {};
  for (const [key, value] of Object.entries(strategies)) {
    const entry = parseJsonObject(value);
    if (!entry) continue;
    const ema = Number(entry.ema);
    const samples = Number(entry.samples);
    if (Number.isFinite(ema) && Number.isInteger(samples) && samples >= 0) {
      out[key] = { ema, samples };
    }
  }
  return { strategies: out } as CoachMemory;
}

/** `ProfileChange[]` relu depuis une colonne JSON. */
export function parseStoredChanges(raw: unknown): readonly ProfileChange[] {
  return parseJsonArray(raw).flatMap((item) => {
    const obj = parseJsonObject(item);
    if (!obj) return [];
    const { parameter, before, after, reason } = obj;
    if (typeof parameter !== "string" || typeof before !== "number" || typeof after !== "number") return [];
    return [{ parameter: parameter as ProfileChange["parameter"], before, after, reason: typeof reason === "string" ? reason : "" }];
  });
}

/** Résumé lisible de l'évolution d'un match (Gazette, console admin). */
export function summarizeEvolution(
  drives: readonly DriveRecord[],
  changes: readonly ProfileChange[],
): string {
  const tds = drives.filter((d) => d.outcome === "td").length;
  const conceded = drives.filter((d) => d.outcome === "conceded").length;
  const turnovers = drives.reduce((acc, d) => acc + d.turnovers, 0);
  const head = `${drives.length} drive${drives.length > 1 ? "s" : ""}, ${tds} TD marqué${tds > 1 ? "s" : ""}, ${conceded} encaissé${conceded > 1 ? "s" : ""}, ${turnovers} turnover${turnovers > 1 ? "s" : ""}.`;
  const learned = changes.filter((c) => !c.reason.startsWith("rappel"));
  if (learned.length === 0) {
    return `${head} Le coach ne retient rien de nouveau.`;
  }
  const top = [...learned]
    .sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before))
    .slice(0, 3)
    .map((c) => `${c.parameter} ${c.after > c.before ? "+" : "−"}${Math.abs(c.after - c.before)}`);
  return `${head} Le coach ajuste : ${top.join(", ")}.`;
}
