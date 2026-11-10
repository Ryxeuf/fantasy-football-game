"use client";

export interface PrerequisiteOption {
  readonly slug: string;
  readonly nameFr: string;
}

interface SkillPrerequisitesFieldProps {
  readonly value: readonly string[];
  readonly options: readonly PrerequisiteOption[];
  readonly onChange: (next: string[]) => void;
}

/** Choix des prérequis d'une compétence, parmi celles de la même édition. */
export default function SkillPrerequisitesField({
  value,
  options,
  onChange,
}: SkillPrerequisitesFieldProps) {
  const nameOf = (slug: string) =>
    options.find((option) => option.slug === slug)?.nameFr ?? slug;
  const addable = options.filter((option) => !value.includes(option.slug));

  return (
    <div>
      <label
        htmlFor="skill-prerequisite-select"
        className="block text-sm font-medium mb-1"
      >
        Prérequis
      </label>
      <p className="text-xs text-gray-500 mb-2">
        Le joueur doit posséder au moins une de ces compétences pour acquérir
        celle-ci. Sans prérequis, aucune contrainte. Un joueur qui possède déjà
        la compétence la conserve.
      </p>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2 mb-2">
          {value.map((slug) => (
            <li
              key={slug}
              className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm text-amber-900"
            >
              {nameOf(slug)}
              <button
                type="button"
                aria-label={`Retirer le prérequis ${nameOf(slug)}`}
                className="ml-1 font-bold hover:text-red-700"
                onClick={() => onChange(value.filter((s) => s !== slug))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <select
        id="skill-prerequisite-select"
        className="w-full border border-gray-300 rounded px-3 py-2"
        value=""
        onChange={(event) => {
          if (event.target.value) onChange([...value, event.target.value]);
        }}
      >
        <option value="">Ajouter un prérequis…</option>
        {addable.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.nameFr}
          </option>
        ))}
      </select>
    </div>
  );
}
