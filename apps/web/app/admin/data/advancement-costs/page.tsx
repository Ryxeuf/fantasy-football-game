"use client";

/**
 * Console admin — barème d'avancement par édition (lot 6.2).
 *
 * La table vivait dans `utils/advancements.ts` et décrivait la seule
 * Saison 3 : une équipe Saison 2 payait ses compétences aux coûts PSP de la
 * Saison 3 et voyait sa VE augmenter selon les surcoûts S3. La grille est
 * maintenant éditable, PAR ÉDITION.
 *
 * Une édition sans grille retombe sur le barème compilé : « Amorcer depuis
 * le moteur » est la sortie explicite pour la poser.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../auth-client";
import { RULESET_OPTIONS, type Ruleset } from "../ruleset-utils";

const KINDS = [
  { key: "primary", label: "Principale choisie" },
  { key: "secondary", label: "Secondaire choisie" },
  { key: "random_primary", label: "Principale au hasard" },
  { key: "random_secondary", label: "Secondaire au hasard (S2)" },
  { key: "characteristic", label: "Caractéristique" },
] as const;

const STATS = ["ma", "st", "ag", "pa", "av"] as const;
const STEPS = [1, 2, 3, 4, 5, 6] as const;

interface CostRow {
  kind: string;
  step: number;
  sppCost: number;
  teamValueSurcharge: number;
}

interface CharacteristicRow {
  stat: string;
  surcharge: number;
}

async function request(path: string, init?: RequestInit) {
  const token =
    typeof window === "undefined" ? null : localStorage.getItem("auth_token");
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: token ? `Bearer ${token}` : "",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Erreur ${res.status}`);
  }
  return res.json();
}

export default function AdminAdvancementCostsPage() {
  const [ruleset, setRuleset] = useState<Ruleset>("season_3");
  const [costs, setCosts] = useState<CostRow[]>([]);
  const [characteristics, setCharacteristics] = useState<CharacteristicRow[]>(
    [],
  );
  const [elite, setElite] = useState<number>(10000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await request(
        `/admin/data/advancement-costs?ruleset=${ruleset}`,
      );
      setCosts(Array.isArray(data.costs) ? data.costs : []);
      setCharacteristics(
        Array.isArray(data.characteristics) ? data.characteristics : [],
      );
      const config = Array.isArray(data.configs) ? data.configs[0] : null;
      setElite(
        typeof config?.eliteSkillSurcharge === "number"
          ? config.eliteSkillSurcharge
          : 10000,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, [ruleset]);

  useEffect(() => {
    void load();
  }, [load]);

  const costByKey = useMemo(() => {
    const map = new Map<string, CostRow>();
    for (const row of costs) map.set(`${row.kind}:${row.step}`, row);
    return map;
  }, [costs]);

  const charByStat = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of characteristics) map.set(row.stat, row.surcharge);
    return map;
  }, [characteristics]);

  const setCost = (
    kind: string,
    step: number,
    field: "sppCost" | "teamValueSurcharge",
    value: number,
  ) => {
    setCosts((prev) => {
      const idx = prev.findIndex((r) => r.kind === kind && r.step === step);
      const base = prev[idx] ?? {
        kind,
        step,
        sppCost: 0,
        teamValueSurcharge: 0,
      };
      const next = { ...base, [field]: value };
      if (idx < 0) return [...prev, next];
      return prev.map((r, i) => (i === idx ? next : r));
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await request("/admin/data/advancement-costs", {
        method: "PUT",
        body: JSON.stringify({
          ruleset,
          costs,
          characteristics: STATS.map((stat) => ({
            stat,
            surcharge: charByStat.get(stat) ?? 0,
          })),
          eliteSkillSurcharge: elite,
        }),
      });
      setNotice("Barème enregistré.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (
      !window.confirm(
        "Réécrire le barème de cette édition depuis le moteur ? Les valeurs éditées ici seront perdues.",
      )
    )
      return;
    setError(null);
    setNotice(null);
    try {
      await request("/admin/data/advancement-costs/reset", {
        method: "POST",
        body: JSON.stringify({ ruleset }),
      });
      setNotice("Barème amorcé depuis le moteur.");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-advancement-costs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-heading font-bold text-nuffle-anthracite mb-1">
            📈 Barème d'avancement
          </h1>
          <p className="text-sm text-gray-600">
            Coûts en PSP et surcoûts de valeur d'équipe, PAR ÉDITION. Sans
            grille, le barème compilé du moteur s'applique.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={ruleset}
            data-testid="admin-advancement-costs-ruleset"
            onChange={(e) => setRuleset(e.target.value as Ruleset)}
            className="border border-gray-300 rounded-lg px-4 py-2.5"
          >
            {RULESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            onClick={reset}
            data-testid="admin-advancement-costs-reset"
            className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium"
          >
            Amorcer depuis le moteur
          </button>
        </div>
      </div>

      {error && (
        <div
          data-testid="admin-advancement-costs-error"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          ⚠️ {error}
        </div>
      )}
      {notice && (
        <div
          data-testid="admin-advancement-costs-notice"
          className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800"
        >
          ✅ {notice}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Chargement…</p>
      ) : (
        <>
          {costs.length === 0 && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
              Aucune grille pour cette édition : le barème compilé du moteur
              s'applique. « Amorcer depuis le moteur » la matérialise.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-600">
                  <th className="py-2 pr-4">Type</th>
                  {STEPS.map((step) => (
                    <th key={step} className="py-2 pr-3">
                      {step}ᵉ (PSP)
                    </th>
                  ))}
                  <th className="py-2">Surcoût VE (po)</th>
                </tr>
              </thead>
              <tbody>
                {KINDS.map(({ key, label }) => (
                  <tr key={key} className="border-t">
                    <td className="py-2 pr-4 font-medium">{label}</td>
                    {STEPS.map((step) => (
                      <td key={step} className="py-2 pr-3">
                        <input
                          type="number"
                          data-testid={`advancement-cost-${key}-${step}`}
                          value={costByKey.get(`${key}:${step}`)?.sppCost ?? ""}
                          onChange={(e) =>
                            setCost(key, step, "sppCost", Number(e.target.value))
                          }
                          className="w-16 border border-gray-300 rounded px-2 py-1"
                        />
                      </td>
                    ))}
                    <td className="py-2">
                      <input
                        type="number"
                        data-testid={`advancement-surcharge-${key}`}
                        disabled={key === "characteristic"}
                        value={
                          costByKey.get(`${key}:1`)?.teamValueSurcharge ?? ""
                        }
                        onChange={(e) => {
                          // Le surcoût de VE ne dépend pas du palier : on le
                          // recopie sur les 6 lignes du type, sinon la grille
                          // partirait incohérente en base.
                          const value = Number(e.target.value);
                          for (const step of STEPS) {
                            setCost(key, step, "teamValueSurcharge", value);
                          }
                        }}
                        className="w-24 border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-gray-500 mt-2">
              Le surcoût de VE d'une amélioration de caractéristique dépend de
              la caractéristique : il se règle ci-dessous.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-4">
            <h2 className="font-heading font-semibold text-lg mb-3">
              Surcoût de VE par caractéristique (po)
            </h2>
            <div className="grid gap-3 sm:grid-cols-5">
              {STATS.map((stat) => (
                <label key={stat} className="text-sm">
                  <span className="block text-gray-600 mb-1 uppercase">
                    {stat}
                  </span>
                  <input
                    type="number"
                    data-testid={`characteristic-surcharge-${stat}`}
                    value={charByStat.get(stat) ?? ""}
                    onChange={(e) =>
                      setCharacteristics((prev) => {
                        const value = Number(e.target.value);
                        const idx = prev.findIndex((r) => r.stat === stat);
                        if (idx < 0) return [...prev, { stat, surcharge: value }];
                        return prev.map((r, i) =>
                          i === idx ? { ...r, surcharge: value } : r,
                        );
                      })
                    }
                    className="w-full border border-gray-300 rounded px-2 py-1"
                  />
                </label>
              ))}
            </div>
            <label className="text-sm block mt-4 max-w-xs">
              <span className="block text-gray-600 mb-1">
                Surcoût VE d'une compétence Élite (po)
              </span>
              <input
                type="number"
                data-testid="elite-skill-surcharge"
                value={elite}
                onChange={(e) => setElite(Number(e.target.value))}
                className="w-full border border-gray-300 rounded px-2 py-1"
              />
            </label>
          </div>

          <button
            onClick={save}
            disabled={saving}
            data-testid="admin-advancement-costs-save"
            className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer le barème"}
          </button>
        </>
      )}
    </div>
  );
}
