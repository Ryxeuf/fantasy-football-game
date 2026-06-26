"use client";
import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";

export interface SpecialRuleView {
  slug: string;
  name: string;
  description: string;
}

interface SpecialRulesBadgesProps {
  /** Règles spéciales déjà résolues (slug + nom + description) côté serveur. */
  rules: readonly SpecialRuleView[];
  className?: string;
  /** Affiche un libellé "Règles spéciales :" devant les badges. */
  withLabel?: boolean;
}

/**
 * Affiche les règles spéciales d'une équipe sous forme de badges. Un survol
 * affiche le détail de la règle (même UX que les compétences via SkillTooltip).
 * Si aucune règle, affiche "Aucune" / "None".
 */
export default function SpecialRulesBadges({
  rules,
  className = "",
  withLabel = false,
}: SpecialRulesBadgesProps) {
  const { language } = useLanguage();
  const [hovered, setHovered] = useState<string | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleEnter = (slug: string, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 10 });
    setHovered(slug);
  };
  const handleLeave = () => setHovered(null);

  if (!rules || rules.length === 0) {
    return (
      <span className="text-gray-400 text-sm">
        {language === "fr" ? "Aucune" : "None"}
      </span>
    );
  }

  const active = rules.find((r) => r.slug === hovered) ?? null;

  return (
    <div className="relative">
      <div className={`flex flex-wrap items-center gap-1 ${className}`}>
        {withLabel && (
          <span className="text-xs text-gray-500 mr-1">
            {language === "fr" ? "Règles spéciales :" : "Special rules:"}
          </span>
        )}
        {rules.map((rule) => (
          <span
            key={rule.slug}
            className="px-2 py-1 rounded text-xs font-medium cursor-help border border-amber-300 bg-amber-100 text-amber-900"
            onMouseEnter={(e) => handleEnter(rule.slug, e)}
            onMouseLeave={handleLeave}
          >
            {rule.name}
          </span>
        ))}
      </div>

      {active && (
        <div
          className="fixed z-50 max-w-sm p-3 bg-gray-900 text-white text-sm rounded shadow-lg pointer-events-none"
          style={{
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="font-semibold text-yellow-300 mb-1">{active.name}</div>
          <div className="text-xs leading-relaxed">{active.description}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
      )}
    </div>
  );
}
