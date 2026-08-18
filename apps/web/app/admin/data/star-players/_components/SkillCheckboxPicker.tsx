"use client";

/**
 * Selection des competences d'un Star Player en cases a cocher, groupees
 * par categorie, avec recherche. Remplace la saisie CSV libre des
 * formulaires `/admin/data/star-players/*`.
 *
 * Les slugs deja enregistres mais absents du catalogue (competence d'un
 * autre ruleset, donnee heritee) sont conserves et affiches « hors
 * catalogue » : on ne perd jamais une valeur existante a l'enregistrement.
 */

import { useMemo, useState } from "react";

export interface SkillOption {
  slug: string;
  nameFr: string;
  nameEn?: string;
  category?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  General: "Général",
  Agility: "Agilité",
  Strength: "Force",
  Passing: "Passe",
  Mutation: "Mutation",
  Trait: "Trait",
};

const OUT_OF_CATALOG = "__out_of_catalog__";

/** Dédoublonne par slug : un même slug peut exister sur plusieurs rulesets. */
function dedupeBySlug(skills: readonly SkillOption[]): SkillOption[] {
  const seen = new Set<string>();
  const out: SkillOption[] = [];
  for (const skill of skills) {
    if (!skill?.slug || seen.has(skill.slug)) continue;
    seen.add(skill.slug);
    out.push(skill);
  }
  return out;
}

function matchesQuery(skill: SkillOption, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    skill.slug.toLowerCase().includes(q) ||
    (skill.nameFr ?? "").toLowerCase().includes(q) ||
    (skill.nameEn ?? "").toLowerCase().includes(q)
  );
}

export function SkillCheckboxPicker({
  skills,
  selected,
  onToggle,
  testId = "star-player-skills",
}: {
  skills: readonly SkillOption[];
  selected: readonly string[];
  onToggle: (slug: string) => void;
  testId?: string;
}) {
  const [query, setQuery] = useState("");

  const catalog = useMemo(
    () => dedupeBySlug(Array.isArray(skills) ? skills : []),
    [skills],
  );

  // Les slugs cochés absents du catalogue restent affichés (et cochés).
  const options = useMemo(() => {
    const known = new Set(catalog.map((s) => s.slug));
    const extras: SkillOption[] = selected
      .filter((slug) => !known.has(slug))
      .map((slug) => ({
        slug,
        nameFr: `${slug} (hors catalogue)`,
        category: OUT_OF_CATALOG,
      }));
    return [...catalog, ...extras];
  }, [catalog, selected]);

  const groups = useMemo(() => {
    const byCategory = new Map<string, SkillOption[]>();
    for (const skill of options) {
      if (!matchesQuery(skill, query)) continue;
      const category = skill.category || "Autres";
      const bucket = byCategory.get(category);
      if (bucket) bucket.push(skill);
      else byCategory.set(category, [skill]);
    }
    return Array.from(byCategory.entries())
      .map(([category, items]) => ({
        category,
        items: [...items].sort((a, b) =>
          (a.nameFr || a.slug).localeCompare(b.nameFr || b.slug, "fr"),
        ),
      }))
      .sort((a, b) => {
        // « Hors catalogue » toujours en dernier.
        if (a.category === OUT_OF_CATALOG) return 1;
        if (b.category === OUT_OF_CATALOG) return -1;
        return a.category.localeCompare(b.category, "fr");
      });
  }, [options, query]);

  return (
    <div data-testid={testId} className="border rounded px-3 py-3">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtrer les compétences…"
          aria-label="Filtrer les compétences"
          data-testid={`${testId}-search`}
          className="border rounded px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />
        <span
          data-testid={`${testId}-count`}
          className="text-xs text-gray-500"
        >
          {selected.length} sélectionnée{selected.length > 1 ? "s" : ""}
        </span>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          Aucune compétence ne correspond au filtre.
        </p>
      ) : (
        groups.map(({ category, items }) => (
          <div key={category} className="mb-3 last:mb-0">
            <div className="text-xs font-semibold uppercase text-gray-500 mb-1">
              {category === OUT_OF_CATALOG
                ? "Hors catalogue"
                : (CATEGORY_LABELS[category] ?? category)}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
              {items.map((skill) => (
                <label
                  key={skill.slug}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    data-testid={`${testId}-${skill.slug}`}
                    checked={selected.includes(skill.slug)}
                    onChange={() => onToggle(skill.slug)}
                  />
                  <span>
                    {skill.nameFr || skill.slug}{" "}
                    <span className="text-gray-400 text-xs">({skill.slug})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
