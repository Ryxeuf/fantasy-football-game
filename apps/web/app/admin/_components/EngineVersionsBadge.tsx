"use client";

import { useEffect, useState } from "react";
import { API_BASE } from "../../auth-client";

interface EngineVersions {
  readonly gameEngine: string;
  readonly simEngine: string;
}

interface Props {
  /** Variant `sidebar` = compact monoligne ; `inline` = badge horizontal. */
  readonly variant?: "sidebar" | "inline";
}

/**
 * Affiche les versions actives de `@bb/game-engine` et `@bb/sim-engine`.
 * Self-fetch via `/admin/engine-versions` (pattern composant autonome,
 * cf. CLAUDE.md). Le composant cache la requête côté state local —
 * non sensible aux re-render parents.
 */
export default function EngineVersionsBadge({ variant = "sidebar" }: Props) {
  const [v, setV] = useState<EngineVersions | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${API_BASE}/admin/engine-versions`, {
      headers: { Authorization: token ? `Bearer ${token}` : "" },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((json: EngineVersions) => setV(json))
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return null;

  if (variant === "inline") {
    return (
      <div
        data-testid="engine-versions-badge"
        className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-mono text-gray-600 shadow-sm"
      >
        <span className="text-gray-400">⚙️</span>
        <span>
          game-engine{" "}
          <span className="font-semibold text-gray-800">
            {v?.gameEngine ?? "…"}
          </span>
        </span>
        <span className="text-gray-300">·</span>
        <span>
          sim-engine{" "}
          <span className="font-semibold text-gray-800">
            {v?.simEngine ?? "…"}
          </span>
        </span>
      </div>
    );
  }

  return (
    <div
      data-testid="engine-versions-badge"
      className="px-4 py-3 mt-2 border-t border-gray-200 text-xs text-gray-500 font-mono space-y-0.5"
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">
        Moteurs
      </div>
      <div className="flex items-center justify-between">
        <span>game-engine</span>
        <span className="font-semibold text-gray-700">
          {v?.gameEngine ?? "…"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span>sim-engine</span>
        <span className="font-semibold text-gray-700">
          {v?.simEngine ?? "…"}
        </span>
      </div>
    </div>
  );
}
