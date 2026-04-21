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
    title: "TODO — Sprints",
    relPath: "TODO.md",
    description: "Backlog priorisé par sprints et phases",
  },
  {
    id: "phases",
    title: "Roadmap — Phases détaillées",
    relPath: "docs/roadmap/phases.md",
    description: "Toutes les tâches par phase (A à O)",
  },
  {
    id: "sprint-0",
    title: "Sprint 0 — Bugfixes & sécurité",
    relPath: "docs/roadmap/sprint-0.md",
    description: "Bugs critiques et failles de sécurité",
  },
  {
    id: "sprint-2",
    title: "Sprint 2 — Game engine",
    relPath: "docs/sprints/SPRINT-2-game-engine-stabilization.md",
  },
  {
    id: "sprint-3",
    title: "Sprint 3 — Frontend",
    relPath: "docs/sprints/SPRINT-3-frontend-stabilization.md",
  },
  {
    id: "sprint-4",
    title: "Sprint 4 — Server & sécurité",
    relPath: "docs/sprints/SPRINT-4-server-security.md",
  },
  {
    id: "sprint-5",
    title: "Sprint 5 — Tests & dette",
    relPath: "docs/sprints/SPRINT-5-test-infrastructure.md",
  },
  {
    id: "sprint-6",
    title: "Sprint 6 — Badges (foundation)",
    relPath: "docs/sprints/SPRINT-6-badges-foundation.md",
  },
  {
    id: "sprint-7",
    title: "Sprint 7 — Badges (match & cup)",
    relPath: "docs/sprints/SPRINT-7-badges-match-cup-triggers.md",
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
