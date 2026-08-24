"use client";
/**
 * Formulaire partagé création/édition d'un règlement de tournoi.
 * État contrôlé (les maps/arrays sont édités par sous-éditeurs dédiés) ;
 * le parent gère l'appel API et la navigation. Le slug est saisi à la
 * création uniquement (immuable ensuite : référencé par les équipes,
 * ligues et coupes).
 */

import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../../../auth-client";
import {
  FORM_DEFAULTS,
  type InducementValue,
  type RosterRuleValue,
  type TaxBracketValue,
  type TournamentRulesetFormValues,
} from "../api";

interface RosterOption {
  slug: string;
  name: string;
}

interface TournamentRulesetFormProps {
  mode: "create" | "edit";
  initial?: Partial<TournamentRulesetFormValues>;
  submitting: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (values: TournamentRulesetFormValues) => void;
}

const STACKING_LABELS: Record<RosterRuleValue["skillStacking"], string> = {
  none: "Aucun cumul",
  one_player: "2 compét. sur 1 joueur",
  two_players: "2 compét. sur 2 joueurs",
};

const DEFAULT_ROSTER_RULE: RosterRuleValue = {
  goldBudget: 1100,
  sppBudget: 50,
  skillStacking: "none",
  starPlayersAllowed: false,
};

const inputCls = "w-full border rounded px-3 py-2";
const smallInputCls = "w-24 border rounded px-2 py-1 text-sm";
const labelCls = "block text-sm font-medium mb-1";

function csvToList(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function TournamentRulesetForm({
  mode,
  initial,
  submitting,
  error,
  submitLabel,
  onSubmit,
}: TournamentRulesetFormProps) {
  const [form, setForm] = useState<TournamentRulesetFormValues>({
    ...FORM_DEFAULTS,
    ...initial,
  });
  // Champs CSV : édités en texte libre, parsés au submit.
  const [eliteSkillsText, setEliteSkillsText] = useState(
    (initial?.eliteSkills ?? []).join(", "),
  );
  const [bannedText, setBannedText] = useState(
    (initial?.bannedStarPlayers ?? []).join(", "),
  );
  const [rosters, setRosters] = useState<RosterOption[]>([]);
  const [loadingRosters, setLoadingRosters] = useState(true);

  const set = <K extends keyof TournamentRulesetFormValues>(
    key: K,
    value: TournamentRulesetFormValues[K],
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  // Rosters de l'édition choisie — pilotent la table des règles par roster.
  useEffect(() => {
    let cancelled = false;
    setLoadingRosters(true);
    fetch(`${API_BASE}/api/rosters?lang=fr&ruleset=${form.edition}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = (data.rosters || []).map(
          (r: { slug: string; name: string }) => ({
            slug: r.slug,
            name: r.name,
          }),
        );
        setRosters(list);
        setLoadingRosters(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingRosters(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.edition]);

  // Un changement d'édition retire les rosters qui n'y existent pas
  // (la validation serveur les refuserait).
  useEffect(() => {
    if (loadingRosters || rosters.length === 0) return;
    const known = new Set(rosters.map((r) => r.slug));
    setForm((prev) => {
      const kept = Object.fromEntries(
        Object.entries(prev.rosterRules).filter(([slug]) => known.has(slug)),
      );
      return Object.keys(kept).length === Object.keys(prev.rosterRules).length
        ? prev
        : { ...prev, rosterRules: kept };
    });
  }, [rosters, loadingRosters]);

  const allowedCount = Object.keys(form.rosterRules).length;

  const toggleRoster = (slug: string) => {
    setForm((prev) => {
      const next = { ...prev.rosterRules };
      if (next[slug]) {
        delete next[slug];
      } else {
        next[slug] = { ...DEFAULT_ROSTER_RULE };
      }
      return { ...prev, rosterRules: next };
    });
  };

  const setRosterRule = (
    slug: string,
    patch: Partial<RosterRuleValue>,
  ) => {
    setForm((prev) => ({
      ...prev,
      rosterRules: {
        ...prev.rosterRules,
        [slug]: { ...prev.rosterRules[slug], ...patch },
      },
    }));
  };

  const setBracket = (index: number, patch: Partial<TaxBracketValue>) => {
    set(
      "starPlayerSppTax",
      form.starPlayerSppTax.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );
  };

  const setInducement = (index: number, patch: Partial<InducementValue>) => {
    set(
      "allowedInducements",
      form.allowedInducements.map((ind, i) =>
        i === index ? { ...ind, ...patch } : ind,
      ),
    );
  };

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (mode === "create" && !/^[a-z0-9_]+$/.test(form.slug)) return false;
    if (!form.nameFr.trim() || !form.nameEn.trim()) return false;
    if (!form.shortLabel.trim() || !form.version.trim()) return false;
    return allowedCount > 0;
  }, [submitting, mode, form, allowedCount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      ...form,
      eliteSkills: csvToList(eliteSkillsText),
      bannedStarPlayers: csvToList(bannedText),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error ? (
        <div
          data-testid="tournament-ruleset-form-error"
          className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
        >
          {error}
        </div>
      ) : null}

      {/* Identité */}
      <section className="bg-white p-6 border rounded shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          Identité
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Slug (immuable)</label>
            <input
              className={`${inputCls} font-mono text-sm disabled:bg-gray-100 disabled:text-gray-500`}
              value={form.slug}
              onChange={(e) => set("slug", e.target.value)}
              disabled={mode === "edit"}
              placeholder="ex : naf_world_cup_2027"
              data-testid="pack-slug-input"
            />
            {mode === "create" && (
              <p className="text-xs text-gray-500 mt-1">
                Minuscules, chiffres, underscores. Référencé par les équipes :
                non modifiable après création.
              </p>
            )}
          </div>
          <div>
            <label className={labelCls}>Version</label>
            <input
              className={inputCls}
              value={form.version}
              onChange={(e) => set("version", e.target.value)}
              placeholder="V2.1"
            />
          </div>
          <div>
            <label className={labelCls}>Nom (FR)</label>
            <input
              className={inputCls}
              value={form.nameFr}
              onChange={(e) => set("nameFr", e.target.value)}
              data-testid="pack-name-fr-input"
            />
          </div>
          <div>
            <label className={labelCls}>Nom (EN)</label>
            <input
              className={inputCls}
              value={form.nameEn}
              onChange={(e) => set("nameEn", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Libellé court (badges)</label>
            <input
              className={inputCls}
              value={form.shortLabel}
              onChange={(e) => set("shortLabel", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>Édition</label>
              <select
                className={inputCls}
                value={form.edition}
                onChange={(e) =>
                  set("edition", e.target.value as "season_2" | "season_3")
                }
              >
                <option value="season_3">Saison 3 (2025)</option>
                <option value="season_2">Saison 2 (2020)</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Format</label>
              <select
                className={inputCls}
                value={form.format}
                onChange={(e) =>
                  set("format", e.target.value as "bb11" | "sevens")
                }
              >
                <option value="bb11">Blood Bowl à 11</option>
                <option value="sevens">Blood Bowl à Sept</option>
              </select>
            </div>
          </div>
        </div>
        <div>
          <label className={labelCls}>Description (FR)</label>
          <textarea
            className={inputCls}
            rows={3}
            maxLength={2000}
            value={form.descriptionFr}
            onChange={(e) => set("descriptionFr", e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.resurrection}
              onChange={(e) => set("resurrection", e.target.checked)}
            />
            Tournoi résurrection (pas de SPP en jeu, blessures non conservées)
          </label>
          <label className="flex items-center gap-2 text-sm">
            Joueurs réguliers min. avant Star Players
            <input
              type="number"
              min={0}
              max={16}
              className={smallInputCls}
              value={form.minRegularPlayersBeforeStars}
              onChange={(e) =>
                set(
                  "minRegularPlayersBeforeStars",
                  Math.max(0, Math.min(16, Number(e.target.value) || 0)),
                )
              }
            />
          </label>
        </div>
      </section>

      {/* Règles par roster */}
      <section className="bg-white p-6 border rounded shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Règles par roster ({allowedCount} autorisé{allowedCount > 1 ? "s" : ""})
          </h2>
          <p className="text-xs text-gray-500">
            Un roster décoché est interdit par le règlement. Budgets en kpo.
          </p>
        </div>
        {loadingRosters ? (
          <p className="text-sm text-gray-500">Chargement des rosters…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm" data-testid="pack-roster-rules-table">
              <thead className="bg-gradient-to-r from-nuffle-gold/10 to-nuffle-gold/5">
                <tr>
                  <th className="text-left px-3 py-2">Roster</th>
                  <th className="text-left px-3 py-2">Budget or (kpo)</th>
                  <th className="text-left px-3 py-2">Budget SPP</th>
                  <th className="text-left px-3 py-2">Cumul de compétences</th>
                  <th className="text-left px-3 py-2">Star Players</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rosters.map((roster) => {
                  const rule = form.rosterRules[roster.slug];
                  return (
                    <tr key={roster.slug} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={Boolean(rule)}
                            onChange={() => toggleRoster(roster.slug)}
                            data-testid={`pack-roster-toggle-${roster.slug}`}
                          />
                          {roster.name}
                        </label>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={100}
                          max={3000}
                          className={smallInputCls}
                          value={rule?.goldBudget ?? ""}
                          disabled={!rule}
                          onChange={(e) =>
                            setRosterRule(roster.slug, {
                              goldBudget: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          min={0}
                          max={300}
                          className={smallInputCls}
                          value={rule?.sppBudget ?? ""}
                          disabled={!rule}
                          onChange={(e) =>
                            setRosterRule(roster.slug, {
                              sppBudget: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={rule?.skillStacking ?? "none"}
                          disabled={!rule}
                          onChange={(e) =>
                            setRosterRule(roster.slug, {
                              skillStacking: e.target
                                .value as RosterRuleValue["skillStacking"],
                            })
                          }
                        >
                          {Object.entries(STACKING_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="checkbox"
                          checked={rule?.starPlayersAllowed ?? false}
                          disabled={!rule}
                          onChange={(e) =>
                            setRosterRule(roster.slug, {
                              starPlayersAllowed: e.target.checked,
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Barème de compétences + scoring */}
      <section className="bg-white p-6 border rounded shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          Barème d&apos;achat de compétences (SPP)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(
            [
              ["firstPrimary", "1re primaire"],
              ["firstSecondary", "1re secondaire"],
              ["secondPrimary", "2e primaire"],
              ["secondSecondary", "2e secondaire"],
              ["eliteSurcharge", "Surcoût Élite"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className={labelCls}>{label}</label>
              <input
                type="number"
                min={0}
                max={100}
                className={inputCls}
                value={form.skillCosts[key]}
                onChange={(e) =>
                  set("skillCosts", {
                    ...form.skillCosts,
                    [key]: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          ))}
        </div>
        <div>
          <label className={labelCls}>
            Compétences Élite du pack (slugs, séparés par des virgules)
          </label>
          <input
            className={`${inputCls} font-mono text-sm`}
            value={eliteSkillsText}
            onChange={(e) => setEliteSkillsText(e.target.value)}
            placeholder="ex : block, dodge"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(
            [
              ["win", "Victoire"],
              ["draw", "Nul"],
              ["loss", "Défaite"],
              ["concession", "Concession"],
            ] as const
          ).map(([key, label]) => (
            <div key={key}>
              <label className={labelCls}>Points — {label}</label>
              <input
                type="number"
                min={-100}
                max={100}
                className={inputCls}
                value={form.scoring[key]}
                onChange={(e) =>
                  set("scoring", {
                    ...form.scoring,
                    [key]: Number(e.target.value) || 0,
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* Star Players : bannis + taxe */}
      <section className="bg-white p-6 border rounded shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-nuffle-anthracite">
          Star Players
        </h2>
        <div>
          <label className={labelCls}>
            Star Players bannis (slugs, séparés par des virgules)
          </label>
          <textarea
            className={`${inputCls} font-mono text-sm`}
            rows={3}
            value={bannedText}
            onChange={(e) => setBannedText(e.target.value)}
            placeholder="ex : morg_n_thorg, griff_oberwald"
            data-testid="pack-banned-stars-input"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className={labelCls}>
              Taxe SPP par tranche de coût cumulé des stars (kpo)
            </label>
            <button
              type="button"
              className="text-sm text-nuffle-bronze hover:underline"
              onClick={() =>
                set("starPlayerSppTax", [
                  ...form.starPlayerSppTax,
                  { maxTotalCostK: null, spp: 0 },
                ])
              }
            >
              + Ajouter une tranche
            </button>
          </div>
          {form.starPlayerSppTax.length === 0 ? (
            <p className="text-xs text-gray-500">Aucune taxe.</p>
          ) : (
            form.starPlayerSppTax.map((bracket, index) => (
              <div key={index} className="flex items-center gap-3 text-sm">
                <span>Jusqu&apos;à</span>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className={smallInputCls}
                  value={bracket.maxTotalCostK ?? ""}
                  placeholder="∞"
                  onChange={(e) =>
                    setBracket(index, {
                      maxTotalCostK:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
                <span>kpo →</span>
                <input
                  type="number"
                  min={0}
                  max={300}
                  className={smallInputCls}
                  value={bracket.spp}
                  onChange={(e) =>
                    setBracket(index, { spp: Number(e.target.value) || 0 })
                  }
                />
                <span>SPP</span>
                <button
                  type="button"
                  className="text-red-600 hover:underline"
                  onClick={() =>
                    set(
                      "starPlayerSppTax",
                      form.starPlayerSppTax.filter((_, i) => i !== index),
                    )
                  }
                >
                  Retirer
                </button>
              </div>
            ))
          )}
          <p className="text-xs text-gray-500">
            Borne vide = tranche ouverte (∞), à placer en dernier. Tranches
            strictement croissantes.
          </p>
        </div>
      </section>

      {/* Inducements autorisés */}
      <section className="bg-white p-6 border rounded shadow-sm space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-nuffle-anthracite">
            Inducements autorisés (liste fermée)
          </h2>
          <button
            type="button"
            className="text-sm text-nuffle-bronze hover:underline"
            onClick={() =>
              set("allowedInducements", [
                ...form.allowedInducements,
                { slug: "", cost: 0 },
              ])
            }
          >
            + Ajouter un inducement
          </button>
        </div>
        {form.allowedInducements.length === 0 ? (
          <p className="text-xs text-gray-500">
            Aucun inducement listé (aucun autorisé par le règlement).
          </p>
        ) : (
          form.allowedInducements.map((inducement, index) => (
            <div
              key={index}
              className="grid grid-cols-1 md:grid-cols-[1fr_120px_90px_2fr_auto] gap-2 items-center text-sm"
            >
              <input
                className="border rounded px-2 py-1 font-mono"
                placeholder="slug (ex : bribe)"
                value={inducement.slug}
                onChange={(e) => setInducement(index, { slug: e.target.value })}
              />
              <input
                type="number"
                min={0}
                className="border rounded px-2 py-1"
                placeholder="coût (po)"
                value={inducement.cost}
                onChange={(e) =>
                  setInducement(index, { cost: Number(e.target.value) || 0 })
                }
              />
              <input
                type="number"
                min={1}
                max={20}
                className="border rounded px-2 py-1"
                placeholder="max"
                value={inducement.max ?? ""}
                onChange={(e) =>
                  setInducement(index, {
                    max:
                      e.target.value === ""
                        ? undefined
                        : Number(e.target.value),
                  })
                }
              />
              <input
                className="border rounded px-2 py-1"
                placeholder="note (FR)"
                value={inducement.noteFr ?? ""}
                onChange={(e) =>
                  setInducement(index, {
                    noteFr: e.target.value || undefined,
                  })
                }
              />
              <button
                type="button"
                className="text-red-600 hover:underline"
                onClick={() =>
                  set(
                    "allowedInducements",
                    form.allowedInducements.filter((_, i) => i !== index),
                  )
                }
              >
                Retirer
              </button>
            </div>
          ))
        )}
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="pack-submit"
          className="px-5 py-2.5 bg-nuffle-gold text-white rounded-lg font-medium hover:bg-nuffle-gold/90 shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
        {allowedCount === 0 && !loadingRosters ? (
          <span className="text-xs text-red-600">
            Autorise au moins un roster pour enregistrer.
          </span>
        ) : null}
      </div>
    </form>
  );
}
