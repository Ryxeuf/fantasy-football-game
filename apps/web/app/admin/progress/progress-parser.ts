export type TaskStatus = "done" | "in_progress" | "pending";

export interface ProgressTask {
  id: string;
  text: string;
  status: TaskStatus;
  tag?: string;
  detail?: string;
}

export interface ProgressSection {
  title: string;
  tasks: ProgressTask[];
  totals: ProgressTotals;
}

export interface ProgressTotals {
  total: number;
  done: number;
  inProgress: number;
  pending: number;
  percent: number;
}

export interface ProgressSource {
  id: string;
  title: string;
  path: string;
  sections: ProgressSection[];
  totals: ProgressTotals;
}

export interface ProgressReport {
  sources: ProgressSource[];
  totals: ProgressTotals;
  generatedAt: string;
}

const STATUS_MAP: Record<string, TaskStatus> = {
  x: "done",
  X: "done",
  "~": "in_progress",
  " ": "pending",
  "": "pending",
};

function statusFromChar(ch: string): TaskStatus {
  return STATUS_MAP[ch] ?? "pending";
}

function emptyTotals(): ProgressTotals {
  return { total: 0, done: 0, inProgress: 0, pending: 0, percent: 0 };
}

function addToTotals(totals: ProgressTotals, status: TaskStatus): ProgressTotals {
  const next: ProgressTotals = {
    total: totals.total + 1,
    done: totals.done + (status === "done" ? 1 : 0),
    inProgress: totals.inProgress + (status === "in_progress" ? 1 : 0),
    pending: totals.pending + (status === "pending" ? 1 : 0),
    percent: 0,
  };
  next.percent = next.total === 0 ? 0 : Math.round((next.done / next.total) * 100);
  return next;
}

function mergeTotals(a: ProgressTotals, b: ProgressTotals): ProgressTotals {
  const total = a.total + b.total;
  const done = a.done + b.done;
  return {
    total,
    done,
    inProgress: a.inProgress + b.inProgress,
    pending: a.pending + b.pending,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  };
}

const TABLE_ROW_STATUS_RE = /\[( |x|X|~)\]/;
const CHECKBOX_LINE_RE = /^\s*-\s*\[( |x|X|~)\]\s*(.+?)\s*$/;
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  const inner = trimmed.replace(/^\|/, "").replace(/\|$/, "");
  return inner.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return false;
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed);
}

function parseTableRowTask(cells: string[]): ProgressTask | null {
  const statusCellIndex = cells.findIndex((c) => TABLE_ROW_STATUS_RE.test(c));
  if (statusCellIndex === -1) return null;
  const statusMatch = cells[statusCellIndex].match(TABLE_ROW_STATUS_RE);
  if (!statusMatch) return null;
  const status = statusFromChar(statusMatch[1]);

  const id = cells[0] || "";
  const textCells = cells.slice(1, statusCellIndex).filter((c) => c.length > 0);
  const text = textCells[0] || cells[1] || id || "(sans titre)";
  const tag = textCells.length > 1 ? textCells[textCells.length - 1] : undefined;
  const detail = cells.slice(statusCellIndex + 1).join(" | ").trim() || undefined;

  return {
    id: id || text.slice(0, 40),
    text,
    status,
    tag,
    detail: detail && detail.length > 0 ? detail : undefined,
  };
}

function parseCheckboxLine(line: string): ProgressTask | null {
  const m = line.match(CHECKBOX_LINE_RE);
  if (!m) return null;
  const status = statusFromChar(m[1]);
  const text = m[2];
  const idMatch = text.match(/^([A-Z0-9]+(?:\.[A-Z0-9]+)*)\s*[—–-]\s*(.+)$/);
  if (idMatch) {
    return { id: idMatch[1], text: idMatch[2], status };
  }
  return { id: text.slice(0, 40), text, status };
}

/**
 * Parse a markdown document with sections (##/###) that contain either
 * GFM tables with a status column ([ ], [x], [~]) or checkbox lists.
 */
export function parseMarkdown(content: string): ProgressSection[] {
  const lines = content.split(/\r?\n/);
  const sections: ProgressSection[] = [];

  let currentTitle = "Général";
  let currentTasks: ProgressTask[] = [];
  let currentTotals = emptyTotals();

  const flush = () => {
    if (currentTasks.length > 0) {
      sections.push({
        title: currentTitle,
        tasks: currentTasks,
        totals: currentTotals,
      });
    }
    currentTasks = [];
    currentTotals = emptyTotals();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      if (level === 2 || level === 3) {
        flush();
        currentTitle = heading[2];
      }
      continue;
    }

    if (line.trim().startsWith("|")) {
      if (isTableSeparator(line)) continue;
      const cells = splitTableRow(line);
      if (cells.length === 0) continue;
      const task = parseTableRowTask(cells);
      if (task) {
        currentTasks.push(task);
        currentTotals = addToTotals(currentTotals, task.status);
      }
      continue;
    }

    const cb = parseCheckboxLine(line);
    if (cb) {
      currentTasks.push(cb);
      currentTotals = addToTotals(currentTotals, cb.status);
    }
  }

  flush();
  return sections;
}

export function summariseSource(
  id: string,
  title: string,
  path: string,
  sections: ProgressSection[],
): ProgressSource {
  const totals = sections.reduce<ProgressTotals>(
    (acc, section) => mergeTotals(acc, section.totals),
    emptyTotals(),
  );
  return { id, title, path, sections, totals };
}

export function summariseReport(sources: ProgressSource[]): ProgressReport {
  const totals = sources.reduce<ProgressTotals>(
    (acc, source) => mergeTotals(acc, source.totals),
    emptyTotals(),
  );
  return {
    sources,
    totals,
    generatedAt: new Date().toISOString(),
  };
}
