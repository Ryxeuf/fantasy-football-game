import type { ReactNode } from "react";

export default function AideDeJeuLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl">
      {children}
      <p className="mt-10 border-t border-nuffle-bronze/15 pt-6 text-center text-xs leading-relaxed text-nuffle-anthracite/50">
        Blood Bowl, Nuffle, les noms d&apos;équipes, de joueurs et tous les
        éléments associés sont des marques et/ou œuvres de Games Workshop Ltd.
        Nuffle Arena est un projet de fans indépendant, sans aucune affiliation
        ni approbation de Games Workshop. Les règles présentées ici sont des
        résumés rédigés à des fins d&apos;aide de jeu et ne remplacent pas le
        livre de règles officiel.
      </p>
    </div>
  );
}
