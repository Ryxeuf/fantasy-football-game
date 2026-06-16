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
  /**
   * Flux en deux temps : le bouton principal lance un DRY-RUN (POST
   * `{ write: false }`) qui renvoie le diff, puis un bouton "Appliquer"
   * apparait pour confirmer l'ecriture (POST `{ write: true }`). Utile pour
   * les utilitaires destructifs (purge de positions orphelines, ...).
   */
  readonly supportsDryRun?: boolean;
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
  {
    key: "reimport-season3-access",
    icon: "📒",
    title: "Réimporter les accès Saison 3",
    description:
      "Réécrit les accès Primaire/Secondaire de compétences (Général, Agilité, Force, Passe, Mutation, Sournoiserie) sur toutes les positions Saison 3, depuis la source officielle BB2025. " +
      "Idempotent (écrit uniquement les accès, ne touche ni aux équipes ni aux compétences). À relancer après mise à jour des données de positionnels.",
    endpoint: "/admin/utilities/reimport-season3-access",
    riskLevel: "low",
  },
  {
    key: "sync-rosters",
    icon: "🔄",
    title: "Synchroniser les rosters",
    description:
      "Applique les données de roster du code (noms, stats, coût, accès, compétences) à la base : purge les positions orphelines, met à jour les positions existantes, recrée les liens de compétences. " +
      "À relancer après un déploiement qui modifie un roster (ex: renommage Blitzer Haut Elfe → Lion Blanc). Aperçu (dry-run) d'abord, puis application confirmée.",
    buttonLabel: "Prévisualiser (dry-run)",
    endpoint: "/admin/utilities/sync-rosters",
    riskLevel: "medium",
    supportsDryRun: true,
  },
];

interface PrunedPosition {
  roster: string;
  ruleset: string;
  slug: string;
  displayName: string;
}

interface UtilityResult {
  ok?: boolean;
  message?: string;
  error?: string;
  durationMs?: number;
  /** Présent sur sync-rosters : false = dry-run, true = écriture appliquée. */
  write?: boolean;
  upserted?: number;
  pruned?: number;
  prunedPositions?: PrunedPosition[];
  [key: string]: unknown;
}

async function postJSON(
  path: string,
  body: Record<string, unknown> = {},
): Promise<UtilityResult> {
  const token = localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
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

  const exec = async (util: UtilityDef, body: Record<string, unknown>) => {
    setLoading(util.key);
    setErrors((prev) => ({ ...prev, [util.key]: "" }));
    try {
      const res = await postJSON(util.endpoint, body);
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

  // Bouton principal : dry-run pour les utilitaires en deux temps, sinon
  // execution directe (body vide).
  const run = async (util: UtilityDef) => {
    if (util.confirmMessage && !confirm(util.confirmMessage)) return;
    await exec(util, util.supportsDryRun ? { write: false } : {});
  };

  // Second temps : applique reellement apres un dry-run reussi.
  const apply = async (util: UtilityDef) => {
    const preview = results[util.key];
    const pruned = preview?.pruned ?? 0;
    const upserted = preview?.upserted ?? 0;
    if (
      !confirm(
        `Appliquer la synchronisation ?\n\n${upserted} position(s) seront mises à jour, ${pruned} purgée(s) définitivement.`,
      )
    ) {
      return;
    }
    await exec(util, { write: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
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
                  {result.write === false ? "🔍" : "✅"}{" "}
                  {result.message ??
                    `Termine en ${result.durationMs ?? 0}ms`}
                </div>
              )}

              {/* Diff dry-run : liste des positions qui seraient purgees. */}
              {result?.ok &&
                util.supportsDryRun &&
                (result.prunedPositions?.length ?? 0) > 0 && (
                  <div
                    data-testid={`utility-prune-list-${util.key}`}
                    className="mt-2 p-3 bg-white border border-orange-200 rounded-lg text-xs text-orange-900"
                  >
                    <p className="font-semibold mb-1">
                      🗑️ {result.prunedPositions!.length} position(s) à purger :
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {result.prunedPositions!.map((p) => (
                        <li key={`${p.ruleset}/${p.roster}/${p.slug}`}>
                          {p.displayName}{" "}
                          <span className="text-gray-500">
                            ({p.roster}/{p.ruleset})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              {/* Bouton de confirmation apres un dry-run reussi. */}
              {result?.ok && util.supportsDryRun && result.write === false && (
                <button
                  onClick={() => apply(util)}
                  disabled={isRunning}
                  data-testid={`utility-apply-${util.key}`}
                  className="mt-3 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 bg-orange-600 hover:bg-orange-700"
                >
                  {isRunning ? "Application…" : "✍️ Appliquer les changements"}
                </button>
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
