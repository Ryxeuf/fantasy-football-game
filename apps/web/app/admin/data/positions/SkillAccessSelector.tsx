"use client";

/**
 * Sélecteur d'accès aux catégories de compétences (montée de niveau) pour une
 * position. Deux instances : Primaire et Secondaire. Produit une CSV de codes
 * canoniques "G,A,S,P,M". Vide = pool vide renseigné (ex: position animale).
 */

// `code` = code canonique stocké (S = Force/Strength). `display` = lettre
// affichée (Force s'abrège "F" en français).
const CATEGORIES: ReadonlyArray<{
  code: string;
  display: string;
  label: string;
}> = [
  { code: "G", display: "G", label: "Général" },
  { code: "A", display: "A", label: "Agilité" },
  { code: "S", display: "F", label: "Force" },
  { code: "P", display: "P", label: "Passe" },
  { code: "M", display: "M", label: "Mutation" },
];

const ORDER = ["G", "A", "S", "P", "M"];

function parse(csv: string): Set<string> {
  const out = new Set<string>();
  for (const ch of (csv || "").toUpperCase()) {
    if (ch === "F") out.add("S");
    else if ("GASPM".includes(ch)) out.add(ch);
  }
  return out;
}

interface Props {
  label: string;
  value: string;
  onChange: (csv: string) => void;
  hint?: string;
}

export default function SkillAccessSelector({
  label,
  value,
  onChange,
  hint,
}: Props) {
  const selected = parse(value);

  const toggle = (code: string) => {
    const next = new Set(selected);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    onChange(ORDER.filter((c) => next.has(c)).join(","));
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex flex-wrap gap-3">
        {CATEGORIES.map(({ code, display, label: catLabel }) => (
          <label
            key={code}
            className="inline-flex items-center gap-1.5 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selected.has(code)}
              onChange={() => toggle(code)}
            />
            <span>
              {catLabel} <span className="text-gray-400">({display})</span>
            </span>
          </label>
        ))}
      </div>
      {hint ? <p className="text-xs text-gray-500 mt-1">{hint}</p> : null}
    </div>
  );
}
