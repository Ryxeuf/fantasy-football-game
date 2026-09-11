/**
 * Compétences « version du match » : celles que chaque joueur portait au
 * COUP D'ENVOI, relues dans le snapshot gelé de la feuille.
 *
 * Une feuille passée ne doit pas bouger quand le roster bouge. Or les
 * dérivations de PSP partaient du roster LIVE : une compétence gagnée à
 * l'étape 3 de la séquence de fin de match (livre p.68) se rétro-appliquait
 * à TOUTES les feuilles du joueur. Cas observé : « Innovateur Violent »
 * ajoutait +2 PSP affichés sur chaque élimination par Action Spéciale déjà
 * consignée — un écart d'affichage pur (les PSP persistés, eux, sont justes),
 * mais qui rend la feuille illisible.
 *
 * Le snapshot ne stocke pas l'id des joueurs (cf. `SnapshotPlayer`) : le
 * rapprochement se fait sur l'identité affichée (numéro + nom), avec deux
 * replis pour absorber un renommage ou un changement de numéro postérieur.
 *
 * Module PUR : aucune I/O, testable sans Prisma.
 */

/** Joueur live, tel que la feuille le charge (`MatchSheetPlayer`). */
export interface LivePlayer {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly skills: string | null;
}

/** Entrée de joueur figée dans le snapshot de roster. */
interface FrozenEntry {
  readonly number: number;
  readonly name: string;
  readonly skills: string;
}

function normalizeName(name: unknown): string {
  return typeof name === "string" ? name.trim().toLowerCase() : "";
}

/**
 * Snapshot « en-tête seul » : les valeurs (VE/VEA/trésorerie/fans) sont
 * figées mais le roster ne l'est PAS. Il ne renseigne donc rien sur les
 * compétences du coup d'envoi.
 */
function isHeaderOnly(obj: Record<string, unknown>): boolean {
  return obj.headerOnly === true;
}

/**
 * Joueurs figés d'un snapshot, ou `null` si le snapshot est absent,
 * illisible ou « en-tête seul ». Tolérant PG (objet natif) + sqlite
 * (chaîne JSON), cf. CLAUDE.md « Parser tolerant PG + sqlite ».
 */
export function parseFrozenPlayers(raw: unknown): FrozenEntry[] | null {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (isHeaderOnly(o)) return null;
  if (!Array.isArray(o.players)) return null;
  const out: FrozenEntry[] = [];
  for (const item of o.players) {
    if (!item || typeof item !== "object") continue;
    const p = item as Record<string, unknown>;
    if (typeof p.number !== "number" || !Number.isFinite(p.number)) continue;
    out.push({
      number: p.number,
      name: typeof p.name === "string" ? p.name : "",
      skills: typeof p.skills === "string" ? p.skills : "",
    });
  }
  return out;
}

/** Indexe les entrées uniques d'une clé (les doublons sont écartés). */
function uniqueIndex<K>(
  entries: readonly FrozenEntry[],
  key: (e: FrozenEntry) => K,
): Map<K, FrozenEntry> {
  const seen = new Map<K, FrozenEntry | null>();
  for (const e of entries) {
    const k = key(e);
    seen.set(k, seen.has(k) ? null : e);
  }
  const out = new Map<K, FrozenEntry>();
  for (const [k, v] of seen) if (v) out.set(k, v);
  return out;
}

/**
 * Compétences du COUP D'ENVOI, par id de joueur live.
 *
 * - Snapshot complet ⇒ le gel FAIT FOI : un joueur qu'il ne connaît pas
 *   n'a aucune compétence du match (il n'a pas joué cette rencontre-là).
 * - Snapshot absent ou « en-tête seul » (feuilles antérieures au gel
 *   complet, feuille encore en saisie) ⇒ repli sur les compétences live,
 *   qui restent la meilleure approximation disponible.
 *
 * Le rapprochement essaie, dans l'ordre : (numéro + nom), puis le numéro
 * seul s'il est unique dans le snapshot, puis le nom seul s'il est unique.
 * Un joueur renommé OU renuméroté depuis le match reste donc reconnu.
 */
export function frozenSkillsByPlayerId(
  players: readonly LivePlayer[],
  frozenSnapshot: unknown,
): Map<string, string> {
  const out = new Map<string, string>();
  const frozen = parseFrozenPlayers(frozenSnapshot);
  if (!frozen) {
    for (const p of players) out.set(p.id, p.skills ?? "");
    return out;
  }
  const byNumberAndName = new Map<string, FrozenEntry>();
  for (const e of frozen) {
    byNumberAndName.set(`${e.number}|${normalizeName(e.name)}`, e);
  }
  const byNumber = uniqueIndex(frozen, (e) => e.number);
  const byName = uniqueIndex(frozen, (e) => normalizeName(e.name));
  for (const p of players) {
    const match =
      byNumberAndName.get(`${p.number}|${normalizeName(p.name)}`) ??
      byNumber.get(p.number) ??
      byName.get(normalizeName(p.name));
    out.set(p.id, match?.skills ?? "");
  }
  return out;
}

/** Compétence « Innovateur Violent » : PSP d'une Élimination sur Action Spéciale. */
export const VIOLENT_INNOVATOR_SLUG = "violent-innovator";
/** Compétence « Vol Fatal » : PSP d'une Élimination en atterrissant sur un adversaire. */
export const FATAL_FLIGHT_SLUG = "fatal-flight";

/**
 * Ids des joueurs portant `slug` AU COUP D'ENVOI (cf. `frozenSkillsByPlayerId`).
 * Les CSV de compétences viennent de sources multiples (seed, admin,
 * évolution) : la variante à underscore et la casse sont acceptées, mais
 * une compétence dont le nom CONTIENT le slug (« violent-innovator-plus »)
 * n'est pas retenue.
 */
export function frozenSkillHolders(
  players: readonly LivePlayer[],
  frozenSnapshot: unknown,
  slug: string,
): Set<string> {
  const wanted = new Set([slug, slug.replace(/-/g, "_")]);
  const skillsById = frozenSkillsByPlayerId(players, frozenSnapshot);
  const out = new Set<string>();
  for (const p of players) {
    const slugs = (skillsById.get(p.id) ?? "")
      .split(",")
      .map((sk) => sk.trim().toLowerCase());
    if (slugs.some((sk) => wanted.has(sk))) out.add(p.id);
  }
  return out;
}
