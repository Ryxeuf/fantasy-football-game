import { Router } from "express";
import type { Request, Response } from "express";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { adminOnly } from "../middleware/adminOnly";
import { authUser } from "../middleware/authUser";
import {
  isValidReplayFilename,
  parseReplayContent,
  parseReplayFilename,
  type ParsedReplay,
  type ReplayFileMetadata,
} from "../utils/replay-parser";
import { serverLog } from "../utils/server-log";

/**
 * Admin endpoints qui exposent les replays panel BB (sprint Pro League
 * 0.E.2 / 0.E.3) pour la validation C6-C9 du gate Phase 0 → Phase 1
 * (cf. `docs/roadmap/sprints/pro-league-gate.md`).
 *
 * Les fichiers `.txt` vivent dans
 * `docs/roadmap/sprints/pro-league-panel/replays/` à la racine du repo.
 * On les lit en lecture seule, on parse les méta-données (header,
 * scores, totaux) pour permettre à l'UI admin de :
 *  - lister les 50 replays avec un résumé tableau,
 *  - filtrer/trier (race, score, touchdowns, casualties),
 *  - afficher le contenu narratif complet d'un replay donné.
 *
 * Aucun écriture, aucun side-effect : ce sont les fichiers source du
 * kit panel, pas une donnée applicative.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Chemin vers le dossier des replays. Override possible via env
 * `PRO_LEAGUE_REPLAYS_DIR` (utile pour les tests + déploiements
 * exotiques où le repo n'est pas mounted en entier).
 *
 * Le fallback grimpe depuis `apps/server/src/routes/` jusqu'à la
 * racine du repo (4 niveaux), puis pointe sur le sous-dossier panel.
 */
const DEFAULT_REPLAYS_DIR = path.resolve(
  __dirname,
  "../../../..",
  "docs/roadmap/sprints/pro-league-panel/replays",
);

export function getReplaysDir(): string {
  return process.env.PRO_LEAGUE_REPLAYS_DIR ?? DEFAULT_REPLAYS_DIR;
}

/** Résumé d'un replay listé (méta-fichier + parsing rapide du contenu). */
export interface ReplaySummary extends ReplayFileMetadata {
  parsed: ParsedReplay;
  /** Taille du fichier en octets (info utile en UI). */
  sizeBytes: number;
}

async function listReplayFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir);
  return entries.filter(isValidReplayFilename).sort();
}

/** Handler `GET /admin/sim/replays` — liste + parsing résumé. */
export async function handleListReplays(
  _req: Request,
  res: Response,
): Promise<void> {
  const dir = getReplaysDir();
  let filenames: string[];
  try {
    filenames = await listReplayFiles(dir);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      res.json({ replays: [], dir, missing: true });
      return;
    }
    serverLog.error("[admin-sim-replays] readdir failed", err);
    res.status(500).json({ error: "Failed to read replays directory" });
    return;
  }

  const replays: ReplaySummary[] = await Promise.all(
    filenames.map(async (filename) => {
      const fullPath = path.join(dir, filename);
      const [content, stat] = await Promise.all([
        fs.readFile(fullPath, "utf8"),
        fs.stat(fullPath),
      ]);
      return {
        ...parseReplayFilename(filename),
        parsed: parseReplayContent(content),
        sizeBytes: stat.size,
      };
    }),
  );

  res.json({ replays, dir, missing: false });
}

/** Handler `GET /admin/sim/replays/:filename` — texte brut + parsing. */
export async function handleGetReplay(
  req: Request,
  res: Response,
): Promise<void> {
  const filename = req.params.filename ?? "";
  if (!isValidReplayFilename(filename)) {
    res.status(400).json({ error: "Invalid replay filename" });
    return;
  }

  const dir = getReplaysDir();
  const fullPath = path.join(dir, filename);
  // Defense-in-depth : s'assurer que le chemin résolu reste sous `dir`
  // même si une regex pathologique laissait passer un nom hostile.
  const resolved = path.resolve(fullPath);
  if (!resolved.startsWith(path.resolve(dir) + path.sep)) {
    res.status(400).json({ error: "Invalid replay filename" });
    return;
  }

  let content: string;
  try {
    content = await fs.readFile(resolved, "utf8");
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      res.status(404).json({ error: "Replay not found" });
      return;
    }
    serverLog.error("[admin-sim-replays] readFile failed", err);
    res.status(500).json({ error: "Failed to read replay" });
    return;
  }

  res.json({
    file: parseReplayFilename(filename),
    parsed: parseReplayContent(content),
    content,
  });
}

const router = Router();

router.use(authUser, adminOnly);

router.get("/", handleListReplays);
router.get("/:filename", handleGetReplay);

export default router;
