"use client";
import { useEffect, useMemo, useState } from "react";
import type {
  ProgressReport,
  ProgressSource,
  ProgressTask,
  ProgressTotals,
  TaskStatus,
} from "./progress-parser";

type StatusFilter = "all" | TaskStatus;

const STATUS_LABEL: Record<TaskStatus, string> = {
  done: "Terminé",
  in_progress: "En cours",
  pending: "À faire",
};

const STATUS_COLOR: Record<TaskStatus, string> = {
  done: "bg-green-100 text-green-800 border-green-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  pending: "bg-gray-100 text-gray-700 border-gray-200",
};

function barColor(percent: number): string {
  if (percent >= 80) return "bg-green-500";
  if (percent >= 50) return "bg-blue-500";
  if (percent >= 20) return "bg-amber-500";
  return "bg-gray-400";
}

function ProgressBar({ totals }: { totals: ProgressTotals }) {
  if (totals.total === 0) {
    return <div className="text-xs text-gray-500">Aucune tâche</div>;
  }
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          {totals.done} / {totals.total} tâches
        </span>
        <span className="font-semibold text-gray-800">{totals.percent}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 transition-all duration-500 ${barColor(totals.percent)}`}
          style={{ width: `${totals.percent}%` }}
          role="progressbar"
          aria-valuenow={totals.percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span>✅ {totals.done} terminées</span>
        {totals.inProgress > 0 && <span>🚧 {totals.inProgress} en cours</span>}
        <span>⏳ {totals.pending} à faire</span>
      </div>
    </div>
  );
}

function filterTasks(tasks: ProgressTask[], filter: StatusFilter): ProgressTask[] {
  if (filter === "all") return tasks;
  return tasks.filter((t) => t.status === filter);
}

function SectionCard({
  section,
  filter,
}: {
  section: ProgressReport["sources"][number]["sections"][number];
  filter: StatusFilter;
}) {
  const visibleTasks = filterTasks(section.tasks, filter);
  if (visibleTasks.length === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
      <div className="flex items-start justify-between gap-4 mb-3">
        <h4 className="text-base font-semibold text-gray-900">{section.title}</h4>
        <span className="text-xs font-medium text-gray-600 shrink-0">
          {section.totals.done}/{section.totals.total} · {section.totals.percent}%
        </span>
      </div>
      <div className="mb-3">
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 ${barColor(section.totals.percent)}`}
            style={{ width: `${section.totals.percent}%` }}
          />
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {visibleTasks.map((task, index) => (
          <li
            key={`${task.id}-${index}`}
            className="flex items-start gap-3 py-2 text-sm"
          >
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border shrink-0 ${STATUS_COLOR[task.status]}`}
            >
              {STATUS_LABEL[task.status]}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-xs text-gray-500 shrink-0">
                  {task.id}
                </span>
                <span className="text-gray-900">{task.text}</span>
                {task.tag && (
                  <span className="text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                    {task.tag}
                  </span>
                )}
              </div>
              {task.detail && (
                <div className="text-xs text-gray-500 mt-0.5">{task.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SourceBlock({
  source,
  filter,
  expanded,
  onToggle,
}: {
  source: ProgressSource;
  filter: StatusFilter;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <section className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-md border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-heading font-semibold text-nuffle-anthracite">
              {source.title}
            </h3>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{source.path}</p>
          </div>
          <span className="text-gray-400 text-xl shrink-0" aria-hidden="true">
            {expanded ? "▾" : "▸"}
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar totals={source.totals} />
        </div>
      </button>
      {expanded && source.sections.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50/50 p-4 space-y-3">
          {source.sections.map((section) => (
            <SectionCard
              key={section.title}
              section={section}
              filter={filter}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function AdminProgressPage() {
  const [report, setReport] = useState<ProgressReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/api/admin/progress", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Erreur ${response.status}`);
      }
      const data: ProgressReport = await response.json();
      setReport(data);
      // Expand the first source by default
      if (data.sources.length > 0) {
        setExpanded({ [data.sources[0].id]: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReport();
  }, []);

  const toggleSource = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => {
    if (!report) return;
    const next: Record<string, boolean> = {};
    for (const s of report.sources) next[s.id] = true;
    setExpanded(next);
  };

  const collapseAll = () => setExpanded({});

  const generatedAt = useMemo(() => {
    if (!report) return null;
    try {
      return new Date(report.generatedAt).toLocaleString("fr-FR");
    } catch {
      return report.generatedAt;
    }
  }, [report]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-nuffle-gold mb-4"></div>
          <p className="text-gray-600">Lecture des fichiers de roadmap…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            🗺️ Avancement
          </h1>
          <p className="text-sm text-gray-600">
            Agrégation des fichiers de roadmap et de sprints
            {generatedAt && <> · généré le {generatedAt}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={loadReport}
          className="px-4 py-2 bg-nuffle-gold text-white rounded-lg text-sm font-medium hover:bg-nuffle-gold/90 shadow-sm transition-colors"
        >
          🔄 Rafraîchir
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
          <span aria-hidden="true">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {report && (
        <>
          <section className="bg-white rounded-xl shadow-md border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-heading font-semibold text-nuffle-anthracite">
                📊 Avancement global
              </h2>
              <span className="text-2xl font-bold text-nuffle-gold">
                {report.totals.percent}%
              </span>
            </div>
            <ProgressBar totals={report.totals} />
          </section>

          <section className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "in_progress", "done"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                    filter === value
                      ? "bg-nuffle-anthracite text-white border-nuffle-anthracite"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {value === "all" ? "Toutes" : STATUS_LABEL[value]}
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Tout déplier
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Tout replier
              </button>
            </div>
          </section>

          <div className="space-y-4">
            {report.sources.length === 0 ? (
              <div className="p-6 bg-white rounded-xl border border-gray-200 text-center text-gray-500">
                Aucun fichier de roadmap trouvé.
              </div>
            ) : (
              report.sources.map((source) => (
                <SourceBlock
                  key={source.id}
                  source={source}
                  filter={filter}
                  expanded={Boolean(expanded[source.id])}
                  onToggle={() => toggleSource(source.id)}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
