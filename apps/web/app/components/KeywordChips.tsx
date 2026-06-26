"use client";

interface KeywordChipsProps {
  /** Mots-clés au format CSV (ex: "Humain, Trois-quart"). Déjà localisés. */
  keywords?: string | null;
  className?: string;
}

/**
 * Affiche les mots-clés (keywords) d'une position sous forme de petites
 * pastilles neutres. Les mots-clés décrivent la lignée / le type du joueur
 * (ex: "Humain", "Gros Bras"). Rien n'est rendu si la liste est vide.
 */
export default function KeywordChips({ keywords, className = "" }: KeywordChipsProps) {
  const parsed = (keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  if (parsed.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {parsed.map((keyword) => (
        <span
          key={keyword}
          className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide bg-slate-100 text-slate-600 border border-slate-200"
        >
          {keyword}
        </span>
      ))}
    </div>
  );
}
