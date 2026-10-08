import {
  AI_TRAINING_FLAG,
  COMPETITION_PDF_EXPORTS_FLAG,
  CROWNS_FLAG,
  DICE_THEMES_FLAG,
  HOME_NEWS_TICKER_FLAG,
  NUFFLE_COACH_FLAG,
  OFFLINE_MATCH_FLAG,
  ONLINE_PLAY_FLAG,
} from "../lib/featureFlagKeys";

/**
 * Catalogue des fonctionnalités de la page d'aide (`/aide`) — DONNÉES PURES.
 *
 * Une entrée par chose qu'un coach peut FAIRE sur le site, rangée par
 * catégorie, avec un lien direct. Une fonctionnalité derrière un feature flag
 * porte ses `flags` : elle n'est affichée que s'ils sont tous activés pour
 * tout le monde (`help-visibility`). Ajouter un flag à une fonctionnalité,
 * c'est la retirer de l'aide tant qu'il n'est pas ouvert.
 *
 * Exhaustivité tenue par `help-catalogue.test.ts` : toute page STATIQUE du
 * site est listée ici (fonctionnalité ou lien) ou dans `HELP_UNLISTED_ROUTES`
 * avec la raison de son absence, et aucun lien n'est mort.
 */

/** Qui peut s'en servir (affiché sous le titre). */
export type HelpAccess = "public" | "account" | "commissioner";

export const HELP_ACCESS_LABELS: Readonly<Record<HelpAccess, string>> = {
  public: "Accès libre",
  account: "Compte requis",
  commissioner: "Commissaire",
};

export interface HelpLink {
  readonly label: string;
  /** Chemin interne (`/leagues/new`). */
  readonly href: string;
  /** Lien affiché seulement si ces flags sont ouverts à tous. */
  readonly flags?: readonly string[];
}

export interface HelpFeature {
  /** Ancre de la carte (`/aide#feuille-de-match`). */
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  /** Ce que la fonctionnalité permet de faire, en une ou deux phrases. */
  readonly description: string;
  /**
   * Explication détaillée, en puces, quand une ou deux phrases ne suffisent
   * pas (ex. les deux modes de saisie d'une coupe).
   */
  readonly details?: readonly string[];
  /** Page d'entrée de la fonctionnalité. */
  readonly href: string;
  readonly access: HelpAccess;
  /** Fonctionnalité affichée seulement si TOUS ces flags sont ouverts à tous. */
  readonly flags?: readonly string[];
  /** Pages voisines utiles (créer, archives, sous-pages…). */
  readonly links?: readonly HelpLink[];
}

export interface HelpCategory {
  /** Ancre de la section (`/aide#ligues`). */
  readonly id: string;
  readonly title: string;
  readonly icon: string;
  readonly intro: string;
  readonly features: readonly HelpFeature[];
}

export const HELP_CATEGORIES: readonly HelpCategory[] = [
  {
    id: "bien-demarrer",
    title: "Bien démarrer",
    icon: "🚀",
    intro:
      "Créer son compte, retrouver ses raccourcis et apprendre les bases de Blood Bowl pas à pas.",
    features: [
      {
        id: "creer-un-compte",
        title: "Créer un compte",
        icon: "🔑",
        href: "/register",
        access: "public",
        description:
          "Un compte gratuit suffit pour construire des équipes, rejoindre des ligues et des coupes et saisir vos feuilles de match.",
        links: [
          { label: "Se connecter", href: "/login" },
          { label: "Mot de passe oublié", href: "/forgot-password" },
        ],
      },
      {
        id: "tableau-de-bord",
        title: "Tableau de bord du coach",
        icon: "🏠",
        href: "/me",
        access: "account",
        description:
          "Votre page d'accueil une fois connecté : vos équipes et les actions rapides (créer une équipe, parcourir le catalogue, suivre le tutoriel).",
        links: [{ label: "Accueil du site", href: "/" }],
      },
      {
        id: "a-la-une",
        title: "Bandeau « À la une »",
        icon: "📰",
        href: "/",
        access: "public",
        flags: [HOME_NEWS_TICKER_FLAG],
        description:
          "Sur la page d'accueil, les derniers résultats des ligues et coupes publiques, le dernier article du blog et les inscriptions ouvertes.",
      },
      {
        id: "tutoriel",
        title: "Tutoriel interactif",
        icon: "🎓",
        href: "/tutoriel",
        access: "public",
        description:
          "Apprenez les règles en jouant : placement, actions, blocages, étape par étape, avec un suivi de progression et de l'expérience à gagner.",
        links: [{ label: "Mon premier match", href: "/tutoriel/mon-premier-match" }],
      },
    ],
  },
  {
    id: "equipes",
    title: "Mes équipes",
    icon: "⚽",
    intro:
      "Construire un roster, le faire vivre de match en match et le partager. Tout se passe depuis « Mes équipes ».",
    features: [
      {
        id: "mes-equipes",
        title: "Mes équipes",
        icon: "📋",
        href: "/me/teams",
        access: "account",
        description:
          "La liste de vos équipes, avec un assistant pour créer la toute première. Chaque équipe a sa fiche : composition, budget, valeur d'équipe, capitaine et photos des joueurs.",
      },
      {
        id: "creer-une-equipe",
        title: "Créer une équipe",
        icon: "🛠️",
        href: "/me/teams/new",
        access: "account",
        description:
          "Le constructeur de roster : choisissez une équipe et sa ligue régionale, recrutez joueurs, staff et Star Players dans le budget. Il applique aussi les règlements de tournoi et les règles d'une coupe quand vous construisez pour elle.",
      },
      {
        id: "entre-deux-matchs",
        title: "Trésorerie, évolutions et journal",
        icon: "💰",
        href: "/me/teams",
        access: "account",
        description:
          "Depuis la fiche d'une équipe : dépensez l'or entre deux matchs, appliquez les évolutions des joueurs, modifiez le roster quand il n'est pas engagé, et consultez le journal qui trace chaque changement et son effet sur la trésorerie et la valeur d'équipe.",
      },
      {
        id: "partager-exporter",
        title: "Partager et exporter un roster",
        icon: "🔗",
        href: "/me/teams",
        access: "account",
        description:
          "Rendez une équipe publique pour obtenir un lien de partage (avec son aperçu sur les réseaux), et exportez le roster ou la feuille de compétences en PDF à imprimer.",
      },
    ],
  },
  {
    id: "ligues",
    title: "Ligues",
    icon: "🏅",
    intro:
      "Une ligue se joue en saisons, avec un classement, des play-offs et des équipes qui progressent d'un match à l'autre.",
    features: [
      {
        id: "rejoindre-une-ligue",
        title: "Trouver et rejoindre une ligue",
        icon: "🔎",
        href: "/leagues",
        access: "account",
        description:
          "Parcourez les ligues, rejoignez-en une avec son code ou répondez aux invitations reçues, puis inscrivez une de vos équipes à la saison en cours.",
        links: [
          { label: "Mes invitations", href: "/me/league-invitations" },
          { label: "Ligues archivées", href: "/leagues/archived" },
        ],
      },
      {
        id: "gerer-une-ligue",
        title: "Créer et gérer une ligue",
        icon: "⚙️",
        href: "/leagues/new",
        access: "commissioner",
        description:
          "Le créateur devient commissaire : rosters autorisés, barème et points bonus, ordre de classement, ligue publique ou privée, invitations, saisons, poules, calendrier et documents officiels. Il valide les feuilles de match et peut archiver ou supprimer la ligue.",
      },
      {
        id: "classement-ligue",
        title: "Calendrier, classement et play-offs",
        icon: "📊",
        href: "/leagues",
        access: "account",
        description:
          "Sur la fiche d'une ligue : vos prochains matchs, le calendrier par journée, le classement (par poule s'il y en a, avec l'ordre de départage affiché), le tableau des play-offs, les tops de la saison et le récapitulatif du champion.",
      },
      {
        id: "pronostics",
        title: "Pronostics",
        icon: "🔮",
        href: "/leagues",
        access: "account",
        description:
          "Quand le commissaire les ouvre, pronostiquez chaque rencontre d'une journée : points pour le bon vainqueur ou le nul, bonus au score exact, classement des coachs et des tribunes, et le titre d'Oracle en fin de saison.",
      },
    ],
  },
  {
    id: "coupes",
    title: "Coupes",
    icon: "🏆",
    intro:
      "Une coupe se joue en rondes avec le roster d'inscription : ni PSP, ni blessures, ni or ne sont reportés d'un match à l'autre.",
    features: [
      {
        id: "rejoindre-une-coupe",
        title: "Trouver, créer et rejoindre une coupe",
        icon: "🏆",
        href: "/cups",
        access: "account",
        description:
          "Parcourez les coupes, créez la vôtre, répondez aux invitations et inscrivez une équipe — ou construisez-en une directement selon les règles de la coupe.",
        links: [{ label: "Coupes archivées", href: "/cups/archived" }],
      },
      {
        id: "saisie-de-coupe",
        title: "Saisie complète ou simplifiée",
        icon: "✏️",
        href: "/cups",
        access: "commissioner",
        description:
          "Le commissaire choisit, pour chaque coupe, comment se saisissent ses feuilles de match : la feuille complète de la ligue, ou une saisie simplifiée limitée à ce que la coupe compte.",
        details: [
          "Saisie simplifiée (proposée par défaut pour une nouvelle coupe) : le forfait, puis les touchdowns, éliminations sur blocage et sur agression, passes réussies et interceptions, chacun avec son joueur et, pour une élimination, sa cible.",
          "Saisie complète : toute la feuille de la ligue (météo, pile ou face, popularité, coups de pouce, prières, mi-temps et tour, gravité des blessures, coup d'envoi…).",
          "Même feuille et même parcours dans les deux cas : mêmes onglets, soumission par les deux coachs, validation par le commissaire. La feuille papier imprimable suit le même mode.",
          "Rien n'est perdu : une coupe ne conserve ni PSP, ni blessure, ni or d'une ronde à l'autre, donc le classement et les tops (individuels et par équipe) sont identiques dans les deux modes.",
          "Le réglage se choisit à la création de la coupe et se change à tout moment depuis son édition, coupe lancée comprise ; ce qui a déjà été saisi reste affiché sur la feuille.",
        ],
      },
      {
        id: "rondes-de-coupe",
        title: "Rondes, poules et classement",
        icon: "🎯",
        href: "/cups",
        access: "account",
        description:
          "Appariement par tirage au sort, système suisse ou saisie manuelle, poules, critères de classement au choix, tableau d'élimination directe, podiums par action et classements individuels.",
      },
    ],
  },
  {
    id: "feuille-de-match",
    title: "Feuille de match",
    icon: "📝",
    intro:
      "Le résultat d'une rencontre de ligue ou de coupe se saisit au même endroit : la feuille de match, ouverte depuis le calendrier de la compétition.",
    features: [
      {
        id: "saisir-une-rencontre",
        title: "Saisir une rencontre",
        icon: "📝",
        href: "/leagues",
        access: "account",
        description:
          "Avant-match (météo, prières à Nuffle, coups de pouce, journaliers), évènements du match, fin de match (PSP, blessures, achats, licenciements) et évolutions. Les deux coachs soumettent, le commissaire valide ou invalide.",
        links: [
          { label: "Depuis une coupe", href: "/cups" },
          { label: "Saisie complète ou simplifiée", href: "/aide#saisie-de-coupe" },
        ],
      },
      {
        id: "documents-officiels",
        title: "Documents officiels",
        icon: "📎",
        href: "/leagues",
        access: "account",
        description:
          "Règlement, annexes ou affiches déposés par le commissaire, consultables par tous les participants depuis la fiche de la ligue ou de la coupe.",
        links: [{ label: "Coupes", href: "/cups" }],
      },
      {
        id: "exports-pdf",
        title: "Exports PDF imprimables",
        icon: "🖨️",
        href: "/leagues",
        access: "account",
        flags: [COMPETITION_PDF_EXPORTS_FLAG],
        description:
          "Imprimez la prochaine journée avec ses cases de score, le classement, les tops, le calendrier, les play-offs, les statistiques et une feuille de rencontre papier.",
        links: [{ label: "Coupes", href: "/cups" }],
      },
      {
        id: "notifications",
        title: "Notifications",
        icon: "🔔",
        href: "/me/notifications",
        access: "account",
        description:
          "La cloche du menu rassemble invitations, rencontres programmées et feuilles à valider. Push et résumé hebdomadaire par e-mail se règlent dans votre profil.",
        links: [{ label: "Préférences", href: "/me/profile" }],
      },
    ],
  },
  {
    id: "jouer",
    title: "Jouer",
    icon: "🎮",
    intro: "Disputer un match sur le plateau du site, s'entraîner et suivre les matchs des autres.",
    features: [
      {
        id: "jouer-en-ligne",
        title: "Jouer en ligne",
        icon: "⚔️",
        href: "/play",
        access: "account",
        flags: [ONLINE_PLAY_FLAG],
        description:
          "Trouvez un adversaire, créez une partie ou rejoignez-en une par son identifiant, puis jouez le match sur le plateau avec le chat.",
        links: [
          { label: "Mes matchs en ligne", href: "/me/matches" },
          { label: "Matchs asynchrones", href: "/me/matches/async" },
        ],
      },
      {
        id: "entrainement-ia",
        title: "Entraînement contre l'IA",
        icon: "🤖",
        href: "/play",
        access: "account",
        flags: [ONLINE_PLAY_FLAG, AI_TRAINING_FLAG],
        description:
          "Affrontez l'IA avec l'une de vos équipes, en facile, moyen ou difficile, pour vous faire la main sans adversaire.",
      },
      {
        id: "spectateur",
        title: "Regarder et revoir un match",
        icon: "📺",
        href: "/spectate",
        access: "account",
        flags: [ONLINE_PLAY_FLAG],
        description:
          "Suivez les matchs en cours en spectateur, et revoyez vos matchs terminés en replay depuis la fiche ou la carrière de votre équipe.",
      },
      {
        id: "classement-elo",
        title: "Classement des coachs",
        icon: "📈",
        href: "/leaderboard",
        access: "public",
        flags: [ONLINE_PLAY_FLAG],
        description: "Le classement ELO des coachs, calculé sur les matchs joués en ligne.",
      },
      {
        id: "partie-offline",
        title: "Partie hors ligne",
        icon: "🎲",
        href: "/local-matches",
        access: "account",
        flags: [OFFLINE_MATCH_FLAG],
        description:
          "Tenez le journal d'une partie jouée sur table, action par action, et partagez-le avec un lien.",
        links: [{ label: "Nouvelle partie", href: "/local-matches/new" }],
      },
    ],
  },
  {
    id: "regles",
    title: "Règles et référence",
    icon: "📖",
    intro:
      "Les règles de Blood Bowl 2025 (saison 3) et tout le catalogue du jeu, consultables sans compte.",
    features: [
      {
        id: "compendium",
        title: "Compendium des règles",
        icon: "📜",
        href: "/compendium",
        access: "public",
        description:
          "Les règles résumées chapitre par chapitre — coup d'envoi, Dés de Blocage, blessures, jeu en ligue, compétences, coups de pouce, Star Players — avec les faces des dés dessinées dans les tables.",
        links: [{ label: "Dés de Blocage", href: "/compendium/des-de-blocage" }],
      },
      {
        id: "aide-de-jeu",
        title: "Aide de jeu",
        icon: "🎲",
        href: "/aide-de-jeu",
        access: "public",
        description:
          "Le déroulé d'une partie en trois temps (avant, pendant, après le match), pensé pour le téléphone posé à côté du terrain, avec les tables à ouvrir en un geste.",
      },
      {
        id: "recherche",
        title: "Recherche",
        icon: "🔍",
        href: "/recherche",
        access: "public",
        description:
          "Une seule recherche pour les règles, les compétences, les postes, les équipes et les Star Players, avec un lien vers la bonne section.",
      },
      {
        id: "catalogue-equipes",
        title: "Catalogue des équipes",
        icon: "🛡️",
        href: "/teams",
        access: "public",
        description:
          "Chaque roster avec ses postes, caractéristiques, compétences de départ et règles spéciales, et une fiche détaillée par poste.",
      },
      {
        id: "ligues-regionales",
        title: "Ligues régionales",
        icon: "🗺️",
        href: "/ligues",
        access: "public",
        description:
          "Les ligues régionales de la saison 3, leurs règles et les équipes qui peuvent y jouer.",
      },
      {
        id: "competences",
        title: "Compétences",
        icon: "📚",
        href: "/skills",
        access: "public",
        description:
          "Compétences, traits et mutations, avec leur description et les postes qui les possèdent dès le départ.",
      },
      {
        id: "star-players",
        title: "Star Players",
        icon: "⭐",
        href: "/star-players",
        access: "public",
        description:
          "Tous les Star Players par édition, leur profil, les équipes qui peuvent les engager, et une carte à télécharger en image.",
      },
    ],
  },
  {
    id: "outils",
    title: "Outils d'analyse",
    icon: "🧰",
    intro: "Comparer les rosters et les postes pour choisir son équipe ou préparer un match.",
    features: [
      {
        id: "comparer-equipes",
        title: "Comparer deux équipes",
        icon: "⚔️",
        href: "/teams/comparer",
        access: "public",
        description:
          "Deux rosters côte à côte, avec une adresse de comparaison à partager avant un match.",
      },
      {
        id: "etude-positions",
        title: "Étude des postes",
        icon: "📊",
        href: "/teams/positions",
        access: "public",
        description:
          "Tous les postes du jeu classés par caractéristique, filtrables par mot-clé.",
      },
      {
        id: "comparer-positions",
        title: "Comparer des postes",
        icon: "🔬",
        href: "/teams/positions/comparer",
        access: "public",
        description: "Mettez plusieurs postes face à face, caractéristique par caractéristique.",
      },
      {
        id: "tier-list",
        title: "Tier list des rosters",
        icon: "🏅",
        href: "/teams/tier-list",
        access: "public",
        description: "Le classement des rosters par niveau, pour situer une équipe d'un coup d'œil.",
      },
    ],
  },
  {
    id: "compte",
    title: "Mon compte",
    icon: "👤",
    intro: "Votre profil, vos succès et la personnalisation du site.",
    features: [
      {
        id: "profil",
        title: "Profil",
        icon: "👤",
        href: "/me/profile",
        access: "account",
        description:
          "Nom de coach, identifiant Discord, mot de passe, préférences de notification et suppression du compte. Votre profil public de coach (ELO, titres, succès, équipes récentes) peut être rendu privé.",
      },
      {
        id: "succes",
        title: "Succès",
        icon: "🏅",
        href: "/me/achievements",
        access: "account",
        description: "Les succès débloqués au fil de vos matchs et compétitions, rangés par catégorie.",
      },
      {
        id: "boutique",
        title: "Boutique — thèmes de dés",
        icon: "🛒",
        href: "/me/shop",
        access: "account",
        flags: [DICE_THEMES_FLAG],
        description:
          "Choisissez l'habillage de vos dés parmi les thèmes classiques et les thèmes d'équipe : il s'applique partout où un dé est dessiné, du compendium au plateau de jeu.",
        links: [{ label: "Thèmes de dés", href: "/me/shop/dice-themes" }],
      },
      {
        id: "couronnes",
        title: "Couronnes",
        icon: "👑",
        href: "/me/profile",
        access: "account",
        flags: [CROWNS_FLAG],
        description:
          "La monnaie du site : votre solde et son historique sur votre profil, et de quoi acheter les thèmes payants de la boutique.",
      },
    ],
  },
  {
    id: "nuffle-coach",
    title: "Nuffle Coach",
    icon: "🏈",
    intro:
      "Le fantasy football façon Blood Bowl : des championnats entre amis sur les statistiques réelles de la NFL.",
    features: [
      {
        id: "championnats-nfl",
        title: "Championnats",
        icon: "🏟️",
        href: "/nfl-fantasy",
        access: "account",
        flags: [NUFFLE_COACH_FLAG],
        description:
          "Créez un championnat ou rejoignez-en un, draftez vos joueurs, composez votre équipe chaque semaine avec capitaine et vice-capitaine, et suivez confrontations et classement.",
        links: [
          { label: "Créer", href: "/nfl-fantasy/new" },
          { label: "Championnats publics", href: "/nfl-fantasy/public" },
          { label: "Rejoindre via code", href: "/nfl-fantasy/join" },
        ],
      },
      {
        id: "joueurs-nfl",
        title: "Catalogue des joueurs",
        icon: "📋",
        href: "/nfl-fantasy/players",
        access: "account",
        flags: [NUFFLE_COACH_FLAG],
        description: "Les joueurs disponibles, leur fiche et l'évolution de leur cote.",
      },
      {
        id: "regles-nfl",
        title: "Règles du jeu",
        icon: "📖",
        href: "/nfl-fantasy/rules",
        access: "public",
        flags: [NUFFLE_COACH_FLAG],
        description: "Le barème de points, la draft et le déroulé d'une saison de Nuffle Coach.",
        links: [{ label: "À propos", href: "/nfl-fantasy/about" }],
      },
    ],
  },
  {
    id: "communaute",
    title: "Communauté et site",
    icon: "💬",
    intro: "Suivre l'actualité du site, donner votre avis et le soutenir.",
    features: [
      {
        id: "blog",
        title: "Blog",
        icon: "📝",
        href: "/blog",
        access: "public",
        description: "Actualités, guides et coulisses de Nuffle Arena.",
      },
      {
        id: "retour",
        title: "Donner un retour",
        icon: "💡",
        href: "/feedback",
        access: "public",
        description: "Signalez un bug ou proposez une idée : chaque retour est lu.",
      },
      {
        id: "soutenir",
        title: "Soutenir le projet",
        icon: "❤️",
        href: "/support",
        access: "public",
        description:
          "Nuffle Arena est un projet de fans gratuit : un don aide à couvrir l'hébergement. La page explique où va l'argent.",
        links: [{ label: "Mon statut de supporter", href: "/me/supporter" }],
      },
      {
        id: "a-propos",
        title: "À propos",
        icon: "ℹ️",
        href: "/a-propos",
        access: "public",
        description: "L'histoire du projet, ses chiffres clés et sa feuille de route.",
        links: [
          { label: "Mentions légales", href: "/legal/mentions-legales" },
          { label: "Conditions d'utilisation", href: "/legal/conditions-utilisation" },
          { label: "Confidentialité", href: "/legal/politique-de-confidentialite" },
          { label: "Cookies", href: "/legal/politique-de-cookies" },
        ],
      },
    ],
  },
];

/**
 * Pages statiques volontairement ABSENTES de l'aide, avec la raison. Un
 * motif finissant par `/*` couvre tout un sous-arbre.
 */
export const HELP_UNLISTED_ROUTES: Readonly<Record<string, string>> = {
  "/aide": "La page d'aide elle-même.",
  "/pro-league/*": "Pro League gelée depuis le 2026-06-01 : toutes ses pages redirigent vers l'accueil en prod.",
  "/changelog": "Page non publiée (noindex, hors sitemap).",
  "/cups/monthly":
    "Page orpheline (Nuffle Cup mensuelles) : liée nulle part dans le site, à trancher avant de l'annoncer.",
  "/leagues/seasons":
    "Page orpheline (saisons thématiques) : liée nulle part dans le site, à trancher avant de l'annoncer.",
  "/me/shop": "Redirige vers la première catégorie ouverte de la boutique (listée via /me/shop/dice-themes).",
  "/me/dice-themes": "Ancienne adresse, redirige vers /me/shop/dice-themes.",
  "/lobby": "Ancien point d'entrée du jeu en ligne, remplacé par /play.",
  "/team/select": "Étape du parcours de jeu en ligne (choix de l'équipe), atteinte depuis /play.",
  "/play/demo": "Démonstration technique du plateau.",
  "/dugout-demo": "Démonstration technique du banc de touche.",
  "/dice-notifications": "Démonstration technique des notifications de dés.",
  "/auth/sync": "Étape technique de connexion (synchronisation du jeton).",
  "/reset-password": "Atteinte uniquement par le lien de l'e-mail de réinitialisation.",
  "/maintenance": "Page affichée pendant une maintenance.",
};

/** Tous les liens internes du catalogue (fonctionnalités et liens secondaires). */
export function helpHrefs(categories: readonly HelpCategory[]): string[] {
  return categories.flatMap((c) =>
    c.features.flatMap((f) => [f.href, ...(f.links ?? []).map((l) => l.href)]),
  );
}
