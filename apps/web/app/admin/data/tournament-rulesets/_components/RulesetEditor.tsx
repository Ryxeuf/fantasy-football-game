"use client";

/**
 * Éditeur de règlement de tournoi, partagé entre la création et l'édition.
 *
 * Trois partis pris d'UX :
 *  - **onglets par famille de règles** plutôt qu'un formulaire fleuve — un
 *    règlement, c'est 30+ tiers de roster en plus de six barèmes ;
 *  - **une seule vérité de validation** : le bouton « Vérifier » appelle la
 *    route serveur de validation à blanc, et les erreurs sont affichées AU
 *    PIED du champ concerné (le serveur renvoie le chemin) ;
 *  - **onglet JSON** pour coller un pack entier ou relire la donnée brute,
 *    sans quitter l'éditeur.
 */

import { useMemo, useState } from "react";
import {
  RulesetApiError,
  issuesByPath,
  validateRuleset,
  type DefinitionIssue,
  type EditableDefinition,
} from "../_lib/client";
import { IssuesSummary, ToggleField } from "./fields";
import {
  IdentitySection,
  InducementsSection,
  RosterRulesSection,
  ScoringSection,
  SectionCard,
  SkillsSection,
  StarPlayersSection,
} from "./sections";

type TabId =
  | "identity"
  | "rosters"
  | "skills"
  | "stars"
  | "inducements"
  | "scoring"
  | "json";

const TABS: ReadonlyArray<{ id: TabId; label: string }> = [
  { id: "identity", label: "Identité" },
  { id: "rosters", label: "Tiers" },
  { id: "skills", label: "Compétences" },
  { id: "stars", label: "Star Players" },
  { id: "inducements", label: "Coups de pouce" },
  { id: "scoring", label: "Classement" },
  { id: "json", label: "JSON" },
];

/** Préfixe de chemin couvert par chaque onglet (pour signaler les erreurs). */
const TAB_PREFIXES: Record<TabId, readonly string[]> = {
  identity: [
    "slug",
    "nameFr",
    "nameEn",
    "shortLabel",
    "version",
    "edition",
    "format",
    "descriptionFr",
    "resurrection",
    "minRegularPlayersBeforeStars",
    "regionalLeagueChoice",
  ],
  rosters: ["rosterRules"],
  skills: ["skillCosts", "eliteSkills"],
  stars: ["starPlayerSppTax", "bannedStarPlayers"],
  inducements: ["allowedInducements"],
  scoring: ["scoring"],
  json: [],
};

export interface RulesetEditorProps {
  readonly initial: EditableDefinition;
  readonly initialEnabled: boolean;
  /** Édition d'un règlement existant : le slug est verrouillé. */
  readonly slugLocked: boolean;
  readonly eliteCatalog: ReadonlyArray<{ slug: string; nameFr: string }>;
  readonly starCatalog: ReadonlyArray<{ slug: string; name: string }>;
  readonly onSave: (
    definition: EditableDefinition,
    enabled: boolean,
  ) => Promise<void>;
  readonly saveLabel: string;
}

export default function RulesetEditor({
  initial,
  initialEnabled,
  slugLocked,
  eliteCatalog,
  starCatalog,
  onSave,
  saveLabel,
}: RulesetEditorProps) {
  const [def, setDef] = useState<EditableDefinition>(initial);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [tab, setTab] = useState<TabId>("identity");
  const [issues, setIssues] = useState<readonly DefinitionIssue[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);

  const errors = useMemo(() => issuesByPath(issues), [issues]);

  const patch = (p: Partial<EditableDefinition>) => {
    setDef((prev) => ({ ...prev, ...p }));
    setStatus(null);
  };

  /** Onglets portant au moins une erreur — pastille rouge sur l'onglet. */
  const tabsWithIssues = useMemo(() => {
    const out = new Set<TabId>();
    for (const issue of issues) {
      for (const t of TABS) {
        if (
          TAB_PREFIXES[t.id].some(
            (p) => issue.path === p || issue.path.startsWith(`${p}.`),
          )
        ) {
          out.add(t.id);
        }
      }
    }
    return out;
  }, [issues]);

  const check = async (): Promise<boolean> => {
    setError(null);
    try {
      await validateRuleset(def);
      setIssues([]);
      setStatus("Définition valide.");
      return true;
    } catch (e: unknown) {
      if (e instanceof RulesetApiError) {
        setIssues(e.issues);
        setError(
          e.issues.length > 0
            ? `${e.issues.length} champ(s) à corriger.`
            : e.message,
        );
        return false;
      }
      setError(e instanceof Error ? e.message : "Échec de la validation");
      return false;
    }
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await onSave(def, enabled);
      setIssues([]);
      setStatus("Enregistré.");
    } catch (e: unknown) {
      if (e instanceof RulesetApiError) {
        setIssues(e.issues);
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Échec de l'enregistrement");
      }
    } finally {
      setSaving(false);
    }
  };

  const applyJson = () => {
    if (jsonDraft === null) return;
    try {
      const parsed = JSON.parse(jsonDraft) as EditableDefinition;
      setDef(parsed);
      setJsonDraft(null);
      setStatus("JSON appliqué — pensez à vérifier puis enregistrer.");
      setError(null);
    } catch {
      setError("JSON illisible");
    }
  };

  const sectionProps = { def, errors, onChange: patch };
  const shownPaths = new Set(
    Object.values(TAB_PREFIXES)
      .flat()
      .concat([...errors.keys()].filter((k) => k.includes("."))),
  );

  return (
    <div className="space-y-4">
      {/* Barre d'action : toujours accessible, l'éditeur est long. */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={check}
          data-testid="ruleset-check"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Vérifier
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          data-testid="ruleset-save"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-gray-300"
        >
          {saving ? "Enregistrement…" : saveLabel}
        </button>
        <span className="ml-auto flex items-center gap-3">
          {status && (
            <span
              data-testid="ruleset-status"
              className="text-xs font-medium text-emerald-700"
            >
              {status}
            </span>
          )}
          {error && (
            <span
              role="alert"
              data-testid="ruleset-error"
              className="text-xs font-medium text-red-700"
            >
              {error}
            </span>
          )}
        </span>
      </div>

      <ToggleField
        label="Proposé à la création"
        hint="Décoché, le règlement disparaît des listes. Les équipes et compétitions déjà créées gardent le leur."
        value={enabled}
        onChange={setEnabled}
        testId="toggle-enabled"
      />

      {/* Onglets : pastille rouge sur ceux qui portent une erreur. */}
      <div
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1"
        role="tablist"
        aria-label="Sections du règlement"
      >
        {TABS.map((t) => {
          const active = tab === t.id;
          const flagged = tabsWithIssues.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "border-indigo-500 bg-indigo-500 text-white"
                  : "border-gray-300 bg-white text-gray-600 hover:border-indigo-300"
              }`}
            >
              {t.label}
              {flagged && (
                <span
                  aria-label="contient une erreur"
                  className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-red-500"}`}
                />
              )}
            </button>
          );
        })}
      </div>

      <IssuesSummary issues={issues} shownPaths={shownPaths} />

      {tab === "identity" && (
        <>
          <SectionCard
            title="Slug"
            hint={
              slugLocked
                ? "Non modifiable : il est référencé par les équipes et compétitions déjà créées."
                : "Identifiant technique définitif, en minuscules."
            }
          >
            <input
              type="text"
              value={def.slug}
              disabled={slugLocked}
              onChange={(e) => patch({ slug: e.target.value })}
              data-testid="field-slug-input"
              className={`w-full rounded-lg border px-3 py-2 font-mono text-sm ${
                errors.has("slug")
                  ? "border-red-400 bg-red-50"
                  : "border-gray-300"
              } ${slugLocked ? "bg-gray-100 text-gray-500" : ""}`}
            />
            {errors.get("slug") && (
              <p
                role="alert"
                data-testid="error-slug"
                className="mt-1 text-xs font-medium text-red-600"
              >
                {errors.get("slug")}
              </p>
            )}
          </SectionCard>
          <IdentitySection {...sectionProps} />
        </>
      )}
      {tab === "rosters" && <RosterRulesSection {...sectionProps} />}
      {tab === "skills" && (
        <SkillsSection {...sectionProps} eliteCatalog={eliteCatalog} />
      )}
      {tab === "stars" && (
        <StarPlayersSection {...sectionProps} starCatalog={starCatalog} />
      )}
      {tab === "inducements" && <InducementsSection {...sectionProps} />}
      {tab === "scoring" && <ScoringSection {...sectionProps} />}
      {tab === "json" && (
        <SectionCard
          title="JSON brut"
          hint="Coller un règlement complet, ou relire la donnée telle qu'elle sera stockée. « Appliquer » ne fait que remplir le formulaire : rien n'est enregistré sans validation."
          testId="section-json"
        >
          <textarea
            value={jsonDraft ?? JSON.stringify(def, null, 2)}
            onChange={(e) => setJsonDraft(e.target.value)}
            rows={22}
            spellCheck={false}
            aria-label="Définition JSON"
            data-testid="ruleset-json"
            className="w-full rounded-lg border border-gray-300 p-3 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyJson}
              disabled={jsonDraft === null}
              data-testid="ruleset-json-apply"
              className="rounded-lg border border-indigo-300 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-40"
            >
              Appliquer au formulaire
            </button>
            <button
              type="button"
              onClick={() => setJsonDraft(null)}
              disabled={jsonDraft === null}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Annuler la saisie
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
