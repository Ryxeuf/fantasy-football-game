"use client";

import { useLanguage } from "../../../contexts/LanguageContext";
import { getSkillAccessPalette } from "../../../lib/skill-category-colors";

// Affichage par langue. Le code canonique stocké diffère parfois de la lettre
// affichée : Force (code "S") s'abrège "F" en FR / "S" en EN ; Sournoiserie
// (code "K") s'abrège "S" en FR (notation officielle) / "K" (Skulduggery) en EN
// pour éviter la collision avec Strength.
const ACCESS_DISPLAY: Record<
  string,
  Record<string, { letter: string; label: string }>
> = {
  fr: {
    G: { letter: "G", label: "Général" },
    A: { letter: "A", label: "Agilité" },
    S: { letter: "F", label: "Force" },
    P: { letter: "P", label: "Passe" },
    M: { letter: "M", label: "Mutation" },
    K: { letter: "S", label: "Sournoiserie" },
  },
  en: {
    G: { letter: "G", label: "General" },
    A: { letter: "A", label: "Agility" },
    S: { letter: "S", label: "Strength" },
    P: { letter: "P", label: "Passing" },
    M: { letter: "M", label: "Mutation" },
    K: { letter: "K", label: "Skulduggery" },
  },
};

/** Parse une CSV d'accès -> codes canoniques ordonnés (F->S alias, dédup). */
export function parseAccessCodes(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const set = new Set<string>();
  for (const ch of csv.toUpperCase()) {
    if (ch === "F") set.add("S");
    else if ("GASPMK".includes(ch)) set.add(ch);
  }
  return ["G", "A", "S", "P", "M", "K"].filter((c) => set.has(c));
}

export interface SkillAccessBadgesProps {
  primary?: string | null;
  secondary?: string | null;
}

/**
 * Badges d'accès aux compétences (montée de niveau). Chaque lettre porte la
 * couleur OFFICIELLE de sa catégorie (Générale bleu, Agilité jaune, Force
 * rouge, Mutation vert, Passe blanc, Scélérate violet) : c'est la teinte qui
 * identifie la catégorie d'un coup d'œil, la lettre seule ne suffisait pas.
 * Le rôle se lit à la GRAISSE de la bordure — pleine pour un accès primaire,
 * atténuée pour un secondaire — pour ne pas confisquer la couleur.
 * Lettres + libellés dépendants de la langue (Force = "F" en FR, "S" en EN).
 * Rien si l'accès n'est pas renseigné (ex: season_2).
 *
 * Composant partagé entre la fiche de roster (`/teams/[slug]`) et le builder
 * (`/me/teams/new`) — cf. lot E5.
 */
export default function SkillAccessBadges({
  primary,
  secondary,
}: SkillAccessBadgesProps) {
  const { language } = useLanguage();
  if (primary == null && secondary == null) return null;
  const display = ACCESS_DISPLAY[language] ?? ACCESS_DISPLAY.fr;
  const pri = parseAccessCodes(primary);
  const sec = parseAccessCodes(secondary);
  const roleLabel =
    language === "en"
      ? { access: "Access:", primary: "Primary", secondary: "Secondary" }
      : { access: "Accès :", primary: "Primaire", secondary: "Secondaire" };
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px]">
      <span className="text-gray-500">{roleLabel.access}</span>
      {pri.map((c) => {
        const palette = getSkillAccessPalette(c);
        return (
          <span
            key={`p-${c}`}
            title={`${roleLabel.primary} — ${display[c].label}`}
            className={`rounded border-2 px-1.5 py-0.5 font-semibold ${palette.base} ${palette.border}`}
          >
            {display[c].letter}
          </span>
        );
      })}
      {sec.length > 0 ? <span className="text-gray-300">/</span> : null}
      {sec.map((c) => {
        const palette = getSkillAccessPalette(c);
        return (
          <span
            key={`s-${c}`}
            title={`${roleLabel.secondary} — ${display[c].label}`}
            className={`rounded border border-dashed px-1.5 py-0.5 opacity-80 ${palette.base} ${palette.border}`}
          >
            {display[c].letter}
          </span>
        );
      })}
    </div>
  );
}
