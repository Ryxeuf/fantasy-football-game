import type { Metadata } from "next";
import { AideDeJeuClient } from "./AideDeJeuClient";
import { PHASES } from "./data/sequences";
import { SHEETS } from "./data/sheets";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nufflearena.fr";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Aide de jeu Blood Bowl — le déroulé d'une partie",
  description:
    "L'aide de jeu Blood Bowl 2025 (saison 3) : séquence d'avant-match, coup d'envoi, séquence de tour, blessures et séquence d'après-match, avec toutes les tables (météo, événements, élimination) consultables sur mobile.",
  keywords: [
    "aide de jeu Blood Bowl",
    "séquence de pré-match",
    "événements de coup d'envoi",
    "météo Blood Bowl",
    "tableau de blessure",
    "prières à Nuffle",
    "Blood Bowl 2025",
    "saison 3",
  ],
  alternates: { canonical: `${BASE_URL}/aide-de-jeu` },
  openGraph: {
    title: "Aide de jeu Blood Bowl — le déroulé d'une partie",
    description:
      "Le déroulé complet d'une partie de Blood Bowl, étape par étape, avec les tables à portée de pouce.",
    url: `${BASE_URL}/aide-de-jeu`,
    type: "article",
  },
};

/**
 * Page entierement statique : le contenu ne depend d'aucune requete.
 * `?fiche=` est volontairement lu cote client — le lire ici via
 * `searchParams` ferait basculer la route en rendu dynamique, soit un SSR
 * a chaque visite pour un contenu figé.
 */
export default function AideDeJeuPage(): JSX.Element {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Dérouler une partie de Blood Bowl",
    inLanguage: "fr",
    url: `${BASE_URL}/aide-de-jeu`,
    description:
      "Le déroulé d'une partie de Blood Bowl 2025 (saison 3) : avant le match, pendant le match, après le match.",
    step: PHASES.map((phase, phaseIndex) => ({
      "@type": "HowToSection",
      position: phaseIndex + 1,
      name: phase.title,
      itemListElement: phase.steps.map((step, stepIndex) => ({
        "@type": "HowToStep",
        position: stepIndex + 1,
        name: step.title,
        text: step.summary,
      })),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <AideDeJeuClient />

      {/*
        Les fiches vivent dans un panneau monté à la demande : sans ce bloc,
        leur contenu n'existerait dans aucun HTML servi et resterait invisible
        aux moteurs de recherche. On le rend donc côté serveur, masqué.
      */}
      <div className="sr-only" aria-hidden>
        <h2>Tables de résolution</h2>
        {SHEETS.map((sheet) => (
          <section key={sheet.id}>
            <h3>
              {sheet.title} ({sheet.dice})
            </h3>
            <p>{sheet.hint}</p>
            {sheet.variants.map((variant) => (
              <table key={variant.id}>
                <caption>{variant.table.caption ?? variant.label}</caption>
                <tbody>
                  {variant.table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
