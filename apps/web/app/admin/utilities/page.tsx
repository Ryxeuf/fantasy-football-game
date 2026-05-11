"use client";

/**
 * Page admin "Utilitaires" — regroupe les actions de maintenance manuelle
 * (seed, cache invalidation, regeneration de donnees de reference, etc.).
 *
 * Architecture extensible : chaque utilitaire est une `UtilityCard` avec
 * un `endpoint` POST a hit + un `description`. Pour ajouter un nouvel
 * utilitaire, ajouter une entree dans `UTILITIES` ci-dessous + l'endpoint
 * cote serveur (admin-utilities.ts).
 *
 * Chaque action est traceable cote audit log via le router serveur.
 */

import { useState } from "react";
import { API_BASE } from "../../auth-client";

interface UtilityDef {
  readonly key: string;
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  /** Texte du bouton (par defaut "Executer"). */
  readonly buttonLabel?: string;
  readonly endpoint: string;
  /** Risque : low = bouton vert, medium = orange, high = rouge. */
  readonly riskLevel: "low" | "medium" | "high";
  /** Confirmation supplementaire avant execution si elevee. */
  readonly confirmMessage?: string;
}

const UTILITIES: ReadonlyArray<UtilityDef> = [
  {
    key: "seed-pro-league",
    icon: "🌱",
    title: "Reseed Pro League",
    description:
      "Reapplique le seed de la Pro League : 16 equipes officielles, branding, roster generator. Idempotent (upsert sur slug). " +
      "A relancer si la table ProTeam a ete videe (ex: dump/restore) ou si les meta des equipes ont change.",
    endpoint: "/admin/utilities/seed/pro-league",
    riskLevel: "low",
  },
];

interface UtilityResult {
  ok?: boolean;
  message?: string;
  error?: string;
  durationMs?: number;
  [key: string]: unknown;
}

async function postJSON(path: string): Promise<UtilityResult> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  const json: UtilityResult = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Erreur ${res.status}`);
  }
  return json;
}

const RISK_STYLES: Record<
  UtilityDef["riskLevel"],
  { bg: string; border: string; btn: string }
> = {
  low: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    btn: "bg-emerald-600 hover:bg-emerald-700",
  },
  medium: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    btn: "bg-orange-600 hover:bg-orange-700",
  },
  high: {
    bg: "bg-red-50",
    border: "border-red-200",
    btn: "bg-red-600 hover:bg-red-700",
  },
};

export default function AdminUtilitiesPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, UtilityResult>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const run = async (util: UtilityDef) => {
    if (util.confirmMessage && !confirm(util.confirmMessage)) return;
    setLoading(util.key);
    setErrors((prev) => ({ ...prev, [util.key]: "" }));
    try {
      const res = await postJSON(util.endpoint);
      setResults((prev) => ({ ...prev, [util.key]: res }));
    } catch (e: any) {
      setErrors((prev) => ({
        ...prev,
        [util.key]: e.message || "Erreur inconnue",
      }));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
          🛠️ Utilitaires
        </h1>
        <p className="text-sm text-gray-600">
          Actions de maintenance manuelle. Chaque execution est tracee dans
          le journal d&apos;audit admin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {UTILITIES.map((util) => {
          const style = RISK_STYLES[util.riskLevel];
          const isRunning = loading === util.key;
          const result = results[util.key];
          const error = errors[util.key];
          return (
            <div
              key={util.key}
              data-testid={`utility-${util.key}`}
              className={`p-5 rounded-xl border ${style.bg} ${style.border} shadow-sm`}
            >
              <div className="flex items-start gap-3 mb-3">
                <span className="text-2xl">{util.icon}</span>
                <div className="flex-1">
                  <h2 className="font-semibold text-nuffle-anthracite">
                    {util.title}
                  </h2>
                  <p className="text-sm text-gray-700 mt-1">
                    {util.description}
                  </p>
                </div>
              </div>

              <button
                onClick={() => run(util)}
                disabled={isRunning}
                data-testid={`utility-run-${util.key}`}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 ${style.btn}`}
              >
                {isRunning ? "Execution…" : util.buttonLabel ?? "Executer"}
              </button>

              {result?.ok && (
                <div
                  data-testid={`utility-success-${util.key}`}
                  className="mt-3 p-3 bg-white border border-emerald-200 rounded-lg text-sm text-emerald-800"
                >
                  ✅{" "}
                  {result.message ??
                    `Termine en ${result.durationMs ?? 0}ms`}
                </div>
              )}

              {error && (
                <div
                  data-testid={`utility-error-${util.key}`}
                  className="mt-3 p-3 bg-white border border-red-200 rounded-lg text-sm text-red-800"
                >
                  ❌ {error}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
