/**
 * Parser pour les replays narratifs Pro League (sprint 0.E.2).
 *
 * Les fichiers replays sont produits par `pnpm sim:replay` (cf.
 * `packages/sim-engine/scripts/replay.ts`) et stockes dans
 * `docs/roadmap/sprints/pro-league-panel/replays/`. Format texte plat,
 * voir un exemple dans le meme dossier (header `=== MATCH ... ===`,
 * lignes `Half X • Turn Y`, ligne finale `FINAL: H - A` + ligne de
 * compteurs `Touchdowns | Casualties | Turnovers | Nuffle`).
 *
 * On expose un parser pur (entree string, sortie objet) pour pouvoir
 * fournir aux interfaces admin une vue indexable (tri, recherche,
 * filtres) sans refaire ce travail cote frontend.
 */

const HEADER_REGEX =
  /^===\s*MATCH\s*#(\d+)\s*—\s*(.+?)\s*\((.+?)\)\s*vs\s*(.+?)\s*\((.+?)\)\s*===$/;

const FINAL_SCORE_REGEX = /^FINAL:\s*(\d+)\s*-\s*(\d+)(?:\s*\((draw|home win|away win)\))?/i;

const TOTALS_REGEX =
  /^Touchdowns:\s*(\d+)\s*\|\s*Casualties:\s*(\d+)\s*\|\s*Turnovers:\s*(\d+)\s*\|\s*Nuffle:\s*(\d+)/;

const ENGINE_REGEX = /^engine\s+(\S+)/;

// Restreint aux caractères que `slugForFile` (cf.
// `packages/sim-engine/scripts/replay.ts`) émet : `[a-z0-9-]`. Cela
// élimine d'office les segments `..` ou les séparateurs de chemin.
const FILENAME_REGEX = /^replay-(\d{3})-([a-z0-9-]+)-vs-([a-z0-9-]+)-seed(\d+)\.txt$/;

/**
 * Champs structurés extraits d'un replay narratif.
 *
 * - `matchIndex` : numéro affiché dans le header (1..N).
 * - `homeName` / `awayName` : nom commercial (ex: "Soaring Hawks").
 * - `homeRace` / `awayRace` : race BB (ex: "Wood Elf").
 * - `engineVer` : version sim-engine (ex: "0.12.0").
 * - `homeScore` / `awayScore` : touchdowns finaux.
 * - `outcome` : "home" si home gagne, "away" si away gagne, "draw" sinon.
 *   Calculé sur les TDs si l'annotation `(draw|home win|away win)`
 *   manque (legacy).
 * - `totals` : compteurs récapitulatifs en fin de match.
 * - `totalLines` : taille du replay en nombre de lignes (utile pour
 *   l'UI : afficher un badge "court / long").
 */
export interface ParsedReplay {
  matchIndex: number | null;
  homeName: string | null;
  homeRace: string | null;
  awayName: string | null;
  awayRace: string | null;
  engineVer: string | null;
  homeScore: number | null;
  awayScore: number | null;
  outcome: "home" | "away" | "draw" | null;
  totals: {
    touchdowns: number | null;
    casualties: number | null;
    turnovers: number | null;
    nuffle: number | null;
  };
  totalLines: number;
}

/**
 * Champs déduits du nom de fichier (fallback quand le contenu ne donne
 * pas l'info, et clé de tri dans la liste).
 */
export interface ReplayFileMetadata {
  filename: string;
  /** Index padded sur 3 chiffres (ex: "001"). */
  index: string | null;
  /** Slug équipe domicile (ex: "kc-soaring-hawks"). */
  homeId: string | null;
  /** Slug équipe visiteur (ex: "min-frostraiders"). */
  awayId: string | null;
  /** Seed PRNG utilisée pour reproduire le match. */
  seed: number | null;
}

function deriveOutcome(
  homeScore: number | null,
  awayScore: number | null,
): "home" | "away" | "draw" | null {
  if (homeScore === null || awayScore === null) return null;
  if (homeScore > awayScore) return "home";
  if (awayScore > homeScore) return "away";
  return "draw";
}

function normalizeOutcome(
  raw: string | undefined,
  homeScore: number | null,
  awayScore: number | null,
): "home" | "away" | "draw" | null {
  if (raw) {
    const lower = raw.toLowerCase();
    if (lower === "draw") return "draw";
    if (lower === "home win") return "home";
    if (lower === "away win") return "away";
  }
  return deriveOutcome(homeScore, awayScore);
}

/**
 * Extrait les méta-données structurées d'un replay narratif. Tolerant :
 * une ligne manquante n'invalide pas le parsing — les champs absents
 * sortent à `null`.
 */
export function parseReplayContent(content: string): ParsedReplay {
  const lines = content.split(/\r?\n/);

  const result: ParsedReplay = {
    matchIndex: null,
    homeName: null,
    homeRace: null,
    awayName: null,
    awayRace: null,
    engineVer: null,
    homeScore: null,
    awayScore: null,
    outcome: null,
    totals: {
      touchdowns: null,
      casualties: null,
      turnovers: null,
      nuffle: null,
    },
    totalLines: lines.length,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const headerMatch = HEADER_REGEX.exec(trimmed);
    if (headerMatch && result.matchIndex === null) {
      result.matchIndex = Number.parseInt(headerMatch[1], 10);
      result.homeName = headerMatch[2];
      result.homeRace = headerMatch[3];
      result.awayName = headerMatch[4];
      result.awayRace = headerMatch[5];
      continue;
    }

    const engineMatch = ENGINE_REGEX.exec(trimmed);
    if (engineMatch && result.engineVer === null) {
      result.engineVer = engineMatch[1];
      continue;
    }

    const finalMatch = FINAL_SCORE_REGEX.exec(trimmed);
    if (finalMatch) {
      result.homeScore = Number.parseInt(finalMatch[1], 10);
      result.awayScore = Number.parseInt(finalMatch[2], 10);
      result.outcome = normalizeOutcome(
        finalMatch[3],
        result.homeScore,
        result.awayScore,
      );
      continue;
    }

    const totalsMatch = TOTALS_REGEX.exec(trimmed);
    if (totalsMatch) {
      result.totals = {
        touchdowns: Number.parseInt(totalsMatch[1], 10),
        casualties: Number.parseInt(totalsMatch[2], 10),
        turnovers: Number.parseInt(totalsMatch[3], 10),
        nuffle: Number.parseInt(totalsMatch[4], 10),
      };
      continue;
    }
  }

  if (result.outcome === null) {
    result.outcome = deriveOutcome(result.homeScore, result.awayScore);
  }
  return result;
}

/**
 * Décompose le nom de fichier `replay-001-kc-soaring-hawks-vs-min-frostraiders-seed2026.txt`
 * pour récupérer les méta-données qui n'apparaissent pas toujours dans
 * le contenu (notamment la seed et les ids slug).
 */
export function parseReplayFilename(filename: string): ReplayFileMetadata {
  const match = FILENAME_REGEX.exec(filename);
  if (!match) {
    return { filename, index: null, homeId: null, awayId: null, seed: null };
  }
  const [, index, homeId, awayId, seed] = match;
  return {
    filename,
    index,
    homeId,
    awayId,
    seed: Number.parseInt(seed, 10),
  };
}

/**
 * Vérifie qu'un nom de fichier est un replay panel valide. Sert de
 * garde-fou anti path-traversal côté API : on n'accepte que des noms
 * matchant strictement le pattern.
 */
export function isValidReplayFilename(filename: string): boolean {
  return FILENAME_REGEX.test(filename);
}
