import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { jwtVerify } from "jose";
import {
  parseMarkdown,
  summariseReport,
  summariseSource,
  type ProgressSource,
} from "../../../admin/progress/progress-parser";

export const dynamic = "force-dynamic";

let _cachedSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (_cachedSecret) return _cachedSecret;
  const raw = process.env.JWT_SECRET;
  if (!raw && process.env.NODE_ENV === "production") {
    throw new Error(
      'FATAL: Missing required environment variable "JWT_SECRET".',
    );
  }
  _cachedSecret = new TextEncoder().encode(raw || "dev-secret-change-me");
  return _cachedSecret;
}

async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token =
    request.cookies.get("auth_token")?.value ||
    request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const roles = Array.isArray(payload.roles)
      ? (payload.roles as string[])
      : payload.role
        ? [payload.role as string]
        : [];
    return roles.includes("admin");
  } catch {
    return false;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the repository root by walking up from `process.cwd()` until we find
 * a `pnpm-workspace.yaml` file. Falls back to `process.cwd()` if not found.
 */
async function resolveRepoRoot(): Promise<string> {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (await fileExists(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

interface SourceConfig {
  id: string;
  title: string;
  relPath: string;
  description?: string;
}

const SOURCE_CONFIGS: SourceConfig[] = [
  {
    id: "todo",
    title: "TODO — Backlog",
    relPath: "TODO.md",
    description: "Backlog actif post-v1.73 (Sprints 0-23 archives)",
  },
  {
    id: "phases",
    title: "Roadmap v2 — Phases R+",
    relPath: "docs/roadmap/phases.md",
    description: "Nouvelle feuille de route, page blanche prete a remplir",
  },
  {
    id: "follow-up-b01",
    title: "Suivi qualite — Skill registry (B0.1)",
    relPath: "docs/roadmap/follow-up-b01.md",
    description: "Hardcodes residuels a refactorer (blocking, movement, foul)",
  },
];

async function loadSource(
  root: string,
  config: SourceConfig,
): Promise<ProgressSource | null> {
  const full = path.join(root, config.relPath);
  if (!(await fileExists(full))) return null;
  const content = await fs.readFile(full, "utf-8");
  const sections = parseMarkdown(content);
  const source = summariseSource(config.id, config.title, config.relPath, sections);
  return source;
}

export async function GET(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const root = await resolveRepoRoot();
    const sources: ProgressSource[] = [];
    for (const cfg of SOURCE_CONFIGS) {
      const source = await loadSource(root, cfg);
      if (source) sources.push(source);
    }
    const report = summariseReport(sources);
    return NextResponse.json(report);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
