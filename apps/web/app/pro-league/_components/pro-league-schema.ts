/**
 * Builder pour le JSON-LD Pro League (sprint 1.F.3).
 *
 * Pure function : extrait du component pour etre testable sans React.
 */

export interface ProLeagueSchemaOptions {
  readonly baseUrl: string;
}

export function buildProLeagueSchema(
  opts: ProLeagueSchemaOptions,
): Record<string, unknown> {
  const { baseUrl } = opts;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SportsLeague",
        "@id": `${baseUrl}/pro-league#league`,
        name: "Old World League",
        alternateName: "Pro League Nuffle Arena",
        url: `${baseUrl}/pro-league`,
        sport: "Blood Bowl (fantasy football)",
        numberOfTeams: 16,
        description:
          "Ligue simulee a 16 equipes (homages NFL × races Blood Bowl). 15 journees round-robin, mardi 21h, simulation engine BB-like.",
        parentOrganization: {
          "@type": "Organization",
          "@id": `${baseUrl}#organization`,
          name: "Nuffle Arena",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${baseUrl}/pro-league#faq`,
        mainEntity: [
          {
            "@type": "Question",
            name: "Qu'est-ce que la Pro League Nuffle Arena ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "La Pro League est une ligue Blood Bowl-like simulee : 16 equipes hommage NFL × races BB s'affrontent sur 15 journees round-robin. Les matchs sont joues automatiquement par un engine deterministe ; les fans suivent, parient et lisent la Gazette quotidienne.",
            },
          },
          {
            "@type": "Question",
            name: "Comment parier sur les matchs ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Chaque match Pro League ouvre des marches de paris (Moneyline, Total TDs, etc.) avec une monnaie virtuelle creditee a l'inscription. Les gains sont credites automatiquement apres la simulation. Aucun argent reel n'est implique.",
            },
          },
          {
            "@type": "Question",
            name: "Qu'est-ce que la Nuffle Gazette ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "La Nuffle Gazette est un journal sportif fictif quotidien genere par IA (Claude Haiku). Elle publie un article principal, des breves et un edito signe par 1 des 3 personas (le cynique, l'enthousiaste orc, le statisticien) a partir des resultats de la veille.",
            },
          },
          {
            "@type": "Question",
            name: "Qu'est-ce que le Hall of Fame Pro League ?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "Le Hall of Fame fige le snapshot des joueurs immortalises (mort en match au MVP, palmares carriere ensuite) — nom, race, stats, equipe et raison de l'induction restent consultables meme si le roster d'origine disparait.",
            },
          },
        ],
      },
    ],
  };
}
