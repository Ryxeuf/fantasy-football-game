"use client";
import { useState, useRef, useEffect } from "react";
import { getSkillDescription } from "../me/teams/skills-data";
import { useLanguage } from "../contexts/LanguageContext";

interface SkillTooltipProps {
  skillSlug: string;
  className?: string;
}

export default function SkillTooltip({ skillSlug, className = "" }: SkillTooltipProps) {
  const { language } = useLanguage();
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0, placement: 'top' as 'top' | 'bottom' });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLSpanElement>(null);

  const handleMouseEnter = (event: React.MouseEvent) => {
    if (!badgeRef.current) return;
    
    const rect = badgeRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Calculer la position optimale pour éviter les chevauchements
    let x = rect.left + rect.width / 2;
    let y = rect.top;
    let placement: 'top' | 'bottom' = 'top';
    
    // Vérifier si on a assez d'espace en haut (au moins 250px pour le tooltip)
    if (y < 250) {
      placement = 'bottom';
      y = rect.bottom + 10;
    } else {
      y = y - 10;
    }
    
    // Ajuster horizontalement pour rester dans la vue
    const tooltipWidth = 320; // max-w-xs = 320px
    const margin = 10;
    if (x - tooltipWidth / 2 < margin) {
      x = tooltipWidth / 2 + margin;
    } else if (x + tooltipWidth / 2 > viewportWidth - margin) {
      x = viewportWidth - tooltipWidth / 2 - margin;
    }
    
    setTooltipPosition({ x, y, placement });
    setHoveredSkill(skillSlug);
  };

  const handleMouseLeave = () => {
    setHoveredSkill(null);
  };

  // Fermer le tooltip si on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node) &&
          badgeRef.current && !badgeRef.current.contains(event.target as Node)) {
        setHoveredSkill(null);
      }
    };

    if (hoveredSkill) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [hoveredSkill]);

  const skillDescription = hoveredSkill ? getSkillDescription(hoveredSkill, language) : null;

  // Fonction pour obtenir la couleur selon la catégorie
  const getCategoryColor = (category: string) => {
    switch (category) {
      case "General": return "bg-blue-100 text-blue-800 border-blue-300";
      case "Agility": return "bg-green-100 text-green-800 border-green-300";
      case "Strength": return "bg-red-100 text-red-800 border-red-300";
      case "Passing": return "bg-purple-100 text-purple-800 border-purple-300";
      case "Mutation": return "bg-orange-100 text-orange-800 border-orange-300";
      case "Trait": return "bg-gray-100 text-gray-800 border-gray-300";
      default: return "bg-gray-100 text-gray-600 border-gray-300";
    }
  };

  const skillInfo = getSkillDescription(skillSlug, language);
  const displayName = skillInfo?.name || skillSlug;
  const categoryColor = skillInfo ? getCategoryColor(skillInfo.category) : "bg-gray-100 text-gray-600 border-gray-300";

  return (
    <>
      <span
        ref={badgeRef}
        className={`inline-block px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium cursor-help border transition-all hover:shadow-md hover:scale-105 ${categoryColor} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {displayName}
      </span>

      {/* Tooltip */}
      {hoveredSkill && skillDescription && (
        <div
          ref={tooltipRef}
          className="fixed z-[100] bg-gray-900 text-white text-sm rounded-lg shadow-2xl p-3 max-w-xs pointer-events-auto"
          style={{
            left: `${tooltipPosition.x}px`,
            ...(tooltipPosition.placement === 'top' 
              ? { bottom: `${window.innerHeight - tooltipPosition.y}px` }
              : { top: `${tooltipPosition.y}px` }
            ),
            transform: 'translateX(-50%)',
          }}
          onMouseEnter={() => setHoveredSkill(skillSlug)}
          onMouseLeave={handleMouseLeave}
        >
          <div className="font-semibold text-blue-300 mb-1.5">
            {skillDescription.name}
          </div>
          <div className="text-gray-200 text-xs leading-relaxed mb-2">
            {skillDescription.description}
          </div>
          <div className="text-gray-400 text-xs pt-2 border-t border-gray-700">
            {language === "fr" ? "Catégorie" : "Category"}: {skillDescription.category}
          </div>
          
          {/* Flèche */}
          <div 
            className={`absolute left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 ${
              tooltipPosition.placement === 'top' 
                ? 'top-full border-t-4 border-transparent border-t-gray-900' 
                : 'bottom-full border-b-4 border-transparent border-b-gray-900'
            }`}
          />
        </div>
      )}
    </>
  );
}
