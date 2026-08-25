"use client";

/**
 * Sections de l'éditeur de règlement de tournoi.
 *
 * Le règlement est une donnée dense (identité, 30+ tiers de roster, barèmes,
 * listes de slugs, classement). Plutôt qu'un long formulaire, chaque famille
 * de règles a sa section, avec le vocabulaire du livre plutôt que celui du
 * JSON : « budget d'or », « cumul de compétences », « taxe Star Players ».
 */

import { useMemo, useState } from "react";
import {
  INDUCEMENT_CATALOGUE,
  TEAM_ROSTERS_BY_RULESET,
  type Ruleset,
} from "@bb/game-engine";
import type { EditableDefinition } from "../_lib/client";
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  ToggleField,
} from "./fields";

type Errors = ReadonlyMap<string, string>;

interface SectionProps {
  readonly def: EditableDefinition;
  readonly errors: Errors;
  readonly onChange: (patch: Partial<EditableDefinition>) => void;
}

const STACKING_OPTIONS = [
  { value: "none" as const, label: "Aucun cumul (1 compétence / joueur)" },
  { value: "one_player" as const, label: "1 joueur à 2 compétences" },
  { value: "two_players" as const, label: "2 joueurs à 2 compétences" },
];

/** Carte de section, titre + aide. */
export function SectionCard({
  title,
  hint,
  children,
  testId,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
  readonly testId?: string;
}) {
  return (
    <section
      data-testid={testId}
      className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5"
    >
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-gray-600">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Identité du règlement + règles générales. */
export function IdentitySection({ def, errors, onChange }: SectionProps) {
  return (
    <SectionCard
      title="Identité"
      hint="Ce que voient les coachs dans les listes de création."
      testId="section-identity"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Nom (FR)"
          path="nameFr"
          errors={errors}
          value={def.nameFr}
          onChange={(nameFr) => onChange({ nameFr })}
        />
        <TextField
          label="Nom (EN)"
          path="nameEn"
          errors={errors}
          value={def.nameEn}
          onChange={(nameEn) => onChange({ nameEn })}
        />
        <TextField
          label="Libellé court"
          path="shortLabel"
          errors={errors}
          hint="Affiché dans les badges (fiches d'équipe, de ligue, de coupe)."
          value={def.shortLabel}
          onChange={(shortLabel) => onChange({ shortLabel })}
        />
        <TextField
          label="Version"
          path="version"
          errors={errors}
          hint="Version du pack officiel, ex. « V2.1 »."
          value={def.version}
          onChange={(version) => onChange({ version })}
        />
        <SelectField
          label="Édition requise"
          path="edition"
          errors={errors}
          hint="Les équipes devront être créées dans cette édition."
          value={def.edition}
          onChange={(edition) => onChange({ edition })}
          options={[
            { value: "season_2" as const, label: "Saison 2" },
            { value: "season_3" as const, label: "Saison 3" },
          ]}
        />
        <SelectField
          label="Format requis"
          path="format"
          errors={errors}
          value={def.format}
          onChange={(format) => onChange({ format })}
          options={[
            { value: "bb11" as const, label: "Blood Bowl à 11" },
            { value: "sevens" as const, label: "Blood Bowl à Sept" },
          ]}
        />
      </div>
      <TextAreaField
        label="Description"
        path="descriptionFr"
        errors={errors}
        value={def.descriptionFr}
        onChange={(descriptionFr) => onChange({ descriptionFr })}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <ToggleField
          label="Tournoi résurrection"
          hint="Aucun PSP gagné en jeu, blessures et morts non conservées."
          value={def.resurrection}
          onChange={(resurrection) => onChange({ resurrection })}
          testId="toggle-resurrection"
        />
        <ToggleField
          label="Choix de la Ligue régionale"
          hint="Décochez si le règlement neutralise l'axe régional."
          value={def.regionalLeagueChoice ?? true}
          onChange={(v) => onChange({ regionalLeagueChoice: v })}
          testId="toggle-regional-league"
        />
      </div>
      <NumberField
        label="Joueurs réguliers avant un Star Player"
        path="minRegularPlayersBeforeStars"
        errors={errors}
        hint="0 = aucune exigence."
        min={0}
        max={16}
        value={def.minRegularPlayersBeforeStars}
        onChange={(v) => onChange({ minRegularPlayersBeforeStars: v })}
      />
    </SectionCard>
  );
}

/** Tiers par roster : la table la plus dense du règlement. */
export function RosterRulesSection({ def, errors, onChange }: SectionProps) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState("");

  // Rosters de l'édition retenue : on choisit dans une liste au lieu de
  // saisir un slug à la main (une faute de frappe = un roster interdit).
  const knownRosters = useMemo(() => {
    const map = TEAM_ROSTERS_BY_RULESET[def.edition as Ruleset] ?? {};
    return Object.entries(map)
      .map(([slug, r]) => ({ slug, name: (r as { name?: string }).name ?? slug }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [def.edition]);

  const rosterName = (slug: string) =>
    knownRosters.find((r) => r.slug === slug)?.name ?? slug;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.entries(def.rosterRules)
      .filter(([slug]) =>
        q ? `${slug} ${rosterName(slug)}`.toLowerCase().includes(q) : true,
      )
      .sort(([a], [b]) => rosterName(a).localeCompare(rosterName(b), "fr"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.rosterRules, search, knownRosters]);

  const missing = knownRosters.filter((r) => !(r.slug in def.rosterRules));

  const patchRow = (
    slug: string,
    patch: Partial<EditableDefinition["rosterRules"][string]>,
  ) => {
    onChange({
      rosterRules: {
        ...def.rosterRules,
        [slug]: { ...def.rosterRules[slug], ...patch },
      },
    });
  };

  const removeRow = (slug: string) => {
    const next = { ...def.rosterRules };
    delete next[slug];
    onChange({ rosterRules: next });
  };

  const addRow = (slug: string) => {
    if (!slug || slug in def.rosterRules) return;
    onChange({
      rosterRules: {
        ...def.rosterRules,
        [slug]: {
          goldBudget: 1000,
          sppBudget: 0,
          skillStacking: "none",
          starPlayersAllowed: false,
        },
      },
    });
    setAdding("");
  };

  return (
    <SectionCard
      title={`Tiers par roster (${Object.keys(def.rosterRules).length})`}
      hint="Un roster ABSENT de cette liste est interdit par le règlement."
      testId="section-roster-rules"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrer un roster…"
          aria-label="Filtrer un roster"
          data-testid="roster-rules-search"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm sm:flex-1"
        />
        <span className="flex gap-2">
          <select
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            aria-label="Roster à ajouter"
            data-testid="roster-rules-add-select"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Ajouter un roster…</option>
            {missing.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addRow(adding)}
            disabled={!adding}
            data-testid="roster-rules-add"
            className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white disabled:bg-gray-300"
          >
            Ajouter
          </button>
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          Aucun roster. Un règlement sans roster interdit toutes les équipes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="py-2 pr-3 font-semibold">Roster</th>
                <th className="py-2 pr-3 font-semibold">Or (kpo)</th>
                <th className="py-2 pr-3 font-semibold">PSP</th>
                <th className="py-2 pr-3 font-semibold">Cumul</th>
                <th className="py-2 pr-3 font-semibold">Stars</th>
                <th className="py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map(([slug, rules]) => {
                const base = `rosterRules.${slug}`;
                const rowError = [...errors.keys()].some((k) =>
                  k.startsWith(base),
                );
                return (
                  <tr
                    key={slug}
                    data-testid={`roster-row-${slug}`}
                    className={`border-b border-gray-100 ${rowError ? "bg-red-50" : ""}`}
                  >
                    <td className="py-2 pr-3">
                      <span className="block font-medium text-gray-900">
                        {rosterName(slug)}
                      </span>
                      <code className="text-[11px] text-gray-400">{slug}</code>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        aria-label={`Budget d'or ${slug}`}
                        value={rules.goldBudget}
                        onChange={(e) =>
                          patchRow(slug, { goldBudget: Number(e.target.value) })
                        }
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        aria-label={`Pool de PSP ${slug}`}
                        value={rules.sppBudget}
                        onChange={(e) =>
                          patchRow(slug, { sppBudget: Number(e.target.value) })
                        }
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        aria-label={`Cumul ${slug}`}
                        value={rules.skillStacking}
                        onChange={(e) =>
                          patchRow(slug, {
                            skillStacking: e.target
                              .value as typeof rules.skillStacking,
                          })
                        }
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      >
                        {STACKING_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="checkbox"
                        aria-label={`Star Players autorisés ${slug}`}
                        checked={rules.starPlayersAllowed}
                        onChange={(e) =>
                          patchRow(slug, { starPlayersAllowed: e.target.checked })
                        }
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(slug)}
                        aria-label={`Retirer ${rosterName(slug)}`}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        retirer
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/** Barème de compétences + compétences Élite. */
export function SkillsSection({
  def,
  errors,
  onChange,
  eliteCatalog,
}: SectionProps & {
  /** Compétences Élite du référentiel, pour l'aide à la saisie. */
  readonly eliteCatalog: ReadonlyArray<{ slug: string; nameFr: string }>;
}) {
  const toggleElite = (slug: string) => {
    const has = def.eliteSkills.includes(slug);
    onChange({
      eliteSkills: has
        ? def.eliteSkills.filter((s) => s !== slug)
        : [...def.eliteSkills, slug],
    });
  };

  return (
    <SectionCard
      title="Compétences"
      hint="Coût en PSP des compétences achetées à la création."
      testId="section-skills"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          label="1re compétence — Principale"
          path="skillCosts.firstPrimary"
          errors={errors}
          suffix="PSP"
          value={def.skillCosts.firstPrimary}
          onChange={(v) =>
            onChange({ skillCosts: { ...def.skillCosts, firstPrimary: v } })
          }
        />
        <NumberField
          label="1re compétence — Secondaire"
          path="skillCosts.firstSecondary"
          errors={errors}
          suffix="PSP"
          value={def.skillCosts.firstSecondary}
          onChange={(v) =>
            onChange({ skillCosts: { ...def.skillCosts, firstSecondary: v } })
          }
        />
        <NumberField
          label="2e compétence — Principale"
          path="skillCosts.secondPrimary"
          errors={errors}
          suffix="PSP"
          value={def.skillCosts.secondPrimary}
          onChange={(v) =>
            onChange({ skillCosts: { ...def.skillCosts, secondPrimary: v } })
          }
        />
        <NumberField
          label="2e compétence — Secondaire"
          path="skillCosts.secondSecondary"
          errors={errors}
          suffix="PSP"
          value={def.skillCosts.secondSecondary}
          onChange={(v) =>
            onChange({ skillCosts: { ...def.skillCosts, secondSecondary: v } })
          }
        />
      </div>
      <NumberField
        label="Surcoût par compétence Élite"
        path="skillCosts.eliteSurcharge"
        errors={errors}
        suffix="PSP"
        hint="0 = le règlement ne facture pas l'Élite en PSP."
        value={def.skillCosts.eliteSurcharge}
        onChange={(v) =>
          onChange({ skillCosts: { ...def.skillCosts, eliteSurcharge: v } })
        }
      />
      <div>
        <p className="text-sm font-medium text-gray-700">
          Compétences Élite désignées par le règlement
        </p>
        <p className="text-xs text-gray-500">
          Aucune sélection = ce sont les compétences Élite de l&apos;édition
          (référentiel) qui portent le surcoût.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {eliteCatalog.map((s) => {
            const active = def.eliteSkills.includes(s.slug);
            return (
              <button
                key={s.slug}
                type="button"
                onClick={() => toggleElite(s.slug)}
                aria-pressed={active}
                data-testid={`elite-${s.slug}`}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-gray-300 bg-white text-gray-600 hover:border-amber-400"
                }`}
              >
                {s.nameFr}
              </button>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}

/** Star Players : bannis + taxe SPP par tranche. */
export function StarPlayersSection({
  def,
  errors,
  onChange,
  starCatalog,
}: SectionProps & {
  readonly starCatalog: ReadonlyArray<{ slug: string; name: string }>;
}) {
  const [search, setSearch] = useState("");
  const banned = new Set(def.bannedStarPlayers);
  const shown = starCatalog.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || s.slug.includes(q);
  });

  const toggleBan = (slug: string) => {
    onChange({
      bannedStarPlayers: banned.has(slug)
        ? def.bannedStarPlayers.filter((s) => s !== slug)
        : [...def.bannedStarPlayers, slug],
    });
  };

  const patchBracket = (
    index: number,
    patch: Partial<EditableDefinition["starPlayerSppTax"][number]>,
  ) => {
    onChange({
      starPlayerSppTax: def.starPlayerSppTax.map((b, i) =>
        i === index ? { ...b, ...patch } : b,
      ),
    });
  };

  return (
    <SectionCard
      title="Star Players"
      hint="Recrutements interdits et taxe en PSP prélevée sur le pool."
      testId="section-star-players"
    >
      <div>
        <p className="text-sm font-medium text-gray-700">
          Taxe par coût cumulé des Star Players recrutés
        </p>
        <div className="mt-2 space-y-2">
          {def.starPlayerSppTax.map((bracket, i) => (
            <div
              key={i}
              data-testid={`tax-bracket-${i}`}
              className="flex flex-wrap items-end gap-2 rounded-lg border border-gray-200 p-2"
            >
              <label className="text-xs text-gray-600">
                Jusqu&apos;à (kpo)
                <input
                  type="number"
                  aria-label={`Borne haute tranche ${i + 1}`}
                  value={bracket.maxTotalCostK ?? ""}
                  placeholder="sans borne"
                  onChange={(e) =>
                    patchBracket(i, {
                      maxTotalCostK:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="mt-0.5 block w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600">
                Taxe
                <input
                  type="number"
                  aria-label={`Taxe tranche ${i + 1}`}
                  value={bracket.spp}
                  onChange={(e) =>
                    patchBracket(i, { spp: Number(e.target.value) })
                  }
                  className="mt-0.5 block w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <span className="text-xs text-gray-400">
                {bracket.maxTotalCostK === null
                  ? "dernière tranche (sans borne haute)"
                  : ""}
              </span>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    starPlayerSppTax: def.starPlayerSppTax.filter(
                      (_, idx) => idx !== i,
                    ),
                  })
                }
                className="ml-auto rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              >
                retirer
              </button>
            </div>
          ))}
          {errors.get("starPlayerSppTax") && (
            <p role="alert" className="text-xs font-medium text-red-600">
              {errors.get("starPlayerSppTax")}
            </p>
          )}
          <button
            type="button"
            data-testid="tax-bracket-add"
            onClick={() =>
              onChange({
                starPlayerSppTax: [
                  ...def.starPlayerSppTax,
                  { maxTotalCostK: null, spp: 0 },
                ],
              })
            }
            className="rounded-lg border border-dashed border-indigo-300 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
          >
            + Ajouter une tranche
          </button>
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-gray-700">
          Star Players interdits ({def.bannedStarPlayers.length})
        </p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un Star Player…"
          aria-label="Rechercher un Star Player"
          data-testid="star-search"
          className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-100">
          {shown.map((s) => (
            <label
              key={s.slug}
              className="flex cursor-pointer items-center gap-2 border-b border-gray-50 px-3 py-1.5 text-sm last:border-0 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={banned.has(s.slug)}
                onChange={() => toggleBan(s.slug)}
                className="h-4 w-4"
              />
              <span className={banned.has(s.slug) ? "text-red-700" : ""}>
                {s.name}
              </span>
            </label>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

/** Coups de pouce : liste fermée avec prix et quantités imposés. */
export function InducementsSection({ def, errors, onChange }: SectionProps) {
  const chosen = new Map(def.allowedInducements.map((r) => [r.slug, r]));
  const catalogue = INDUCEMENT_CATALOGUE.filter((d) => d.slug !== "star_player");

  const toggle = (slug: string, cost: number) => {
    onChange({
      allowedInducements: chosen.has(slug)
        ? def.allowedInducements.filter((r) => r.slug !== slug)
        : [...def.allowedInducements, { slug, cost }],
    });
  };

  const patch = (
    slug: string,
    p: Partial<EditableDefinition["allowedInducements"][number]>,
  ) => {
    onChange({
      allowedInducements: def.allowedInducements.map((r) =>
        r.slug === slug ? { ...r, ...p } : r,
      ),
    });
  };

  return (
    <SectionCard
      title={`Coups de pouce autorisés (${def.allowedInducements.length})`}
      hint="Liste FERMÉE : un coup de pouce non coché est interdit par le règlement. Les prix saisis priment sur le catalogue officiel."
      testId="section-inducements"
    >
      {errors.get("allowedInducements") && (
        <p role="alert" className="text-xs font-medium text-red-600">
          {errors.get("allowedInducements")}
        </p>
      )}
      <div className="space-y-1.5">
        {catalogue.map((d) => {
          const rule = chosen.get(d.slug);
          return (
            <div
              key={d.slug}
              data-testid={`inducement-${d.slug}`}
              className={`rounded-lg border p-2 ${rule ? "border-indigo-200 bg-indigo-50/50" : "border-gray-200"}`}
            >
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(rule)}
                  onChange={() => toggle(d.slug, d.baseCost)}
                  className="h-4 w-4"
                />
                <span className="text-sm font-medium text-gray-900">
                  {d.displayNameFr}
                </span>
                <code className="text-[11px] text-gray-400">{d.slug}</code>
              </label>
              {rule && (
                <div className="mt-2 flex flex-wrap items-end gap-2 pl-6">
                  <label className="text-xs text-gray-600">
                    Coût (po)
                    <input
                      type="number"
                      aria-label={`Coût ${d.slug}`}
                      value={rule.cost}
                      onChange={(e) =>
                        patch(d.slug, { cost: Number(e.target.value) })
                      }
                      className="mt-0.5 block w-32 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs text-gray-600">
                    Quantité max
                    <input
                      type="number"
                      aria-label={`Quantité max ${d.slug}`}
                      value={rule.max ?? ""}
                      placeholder="catalogue"
                      onChange={(e) =>
                        patch(d.slug, {
                          max:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      className="mt-0.5 block w-28 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="min-w-[12rem] flex-1 text-xs text-gray-600">
                    Précision affichée
                    <input
                      type="text"
                      aria-label={`Précision ${d.slug}`}
                      value={rule.noteFr ?? ""}
                      onChange={(e) =>
                        patch(d.slug, { noteFr: e.target.value || undefined })
                      }
                      className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

/** Barème de classement du tournoi. */
export function ScoringSection({ def, errors, onChange }: SectionProps) {
  const set = (patch: Partial<EditableDefinition["scoring"]>) =>
    onChange({ scoring: { ...def.scoring, ...patch } });
  return (
    <SectionCard
      title="Classement"
      hint="Points de résultat imposés aux ligues et coupes jouées sous ce règlement."
      testId="section-scoring"
    >
      <div className="grid gap-4 sm:grid-cols-4">
        <NumberField
          label="Victoire"
          path="scoring.win"
          errors={errors}
          value={def.scoring.win}
          onChange={(win) => set({ win })}
        />
        <NumberField
          label="Nul"
          path="scoring.draw"
          errors={errors}
          value={def.scoring.draw}
          onChange={(draw) => set({ draw })}
        />
        <NumberField
          label="Défaite"
          path="scoring.loss"
          errors={errors}
          value={def.scoring.loss}
          onChange={(loss) => set({ loss })}
        />
        <NumberField
          label="Concession"
          path="scoring.concession"
          errors={errors}
          value={def.scoring.concession}
          onChange={(concession) => set({ concession })}
        />
      </div>
    </SectionCard>
  );
}
