/**
 * Le déroulé d'une partie — contenu propre à l'aide de jeu.
 *
 * Ce sont des résumés d'une ou deux lignes, rédigés pour être lus au-dessus
 * d'un plateau : ils orientent vers la bonne fiche et vers le bon chapitre,
 * ils ne remplacent ni l'un ni l'autre. Ils ne recopient PAS les phrases du
 * compendium (cf. CLAUDE.md, section « Compendium des règles »).
 */

export type PhaseId = "avant" | "pendant" | "apres";

export interface Step {
  readonly id: string;
  readonly title: string;
  /** Le résumé succinct affiché dans le flux. Une à deux phrases. */
  readonly summary: string;
  /** Puces optionnelles, pour les étapes qui énumèrent. */
  readonly bullets?: readonly string[];
  /** Identifiants de fiches ouvrables depuis cette étape. */
  readonly sheets?: readonly string[];
  /** Chapitre du compendium à lire en entier. */
  readonly chapterSlug?: string;
  /** `danger` teinte l'étape en rouge (turnovers, expulsions). */
  readonly tone?: "danger";
}

export interface Phase {
  readonly id: PhaseId;
  /** Libellé court, pour la navigation basse. */
  readonly label: string;
  readonly title: string;
  readonly intro: string;
  readonly steps: readonly Step[];
  /** Les étapes de cette phase sont-elles cochables ? */
  readonly checkable?: boolean;
}

export const PHASES: readonly Phase[] = [
  {
    id: "avant",
    label: "Avant",
    title: "Avant le match",
    intro:
      "Six étapes à dérouler dans l'ordre, avant de placer le moindre joueur.",
    checkable: true,
    steps: [
      {
        id: "popularite",
        title: "Facteur de Popularité",
        summary:
          "Chaque coach lance 1D3 et y ajoute ses Fans Dévoués. Le total sert aux gains et à plusieurs événements.",
        chapterSlug: "jeu-en-ligue",
      },
      {
        id: "meteo",
        title: "Météo",
        summary:
          "2D6 sur la table du terrain choisi. Sur Conditions Parfaites, aucun modificateur ne s'applique.",
        sheets: ["meteo"],
      },
      {
        id: "journaliers",
        title: "Prendre des journaliers",
        summary:
          "Moins de onze joueurs disponibles ? Complétez l'effectif avec des Trois-quarts, sans les payer pour ce match.",
        chapterSlug: "jeu-en-ligue",
      },
      {
        id: "coups-de-pouce",
        title: "Coups de pouce",
        summary:
          "L'équipe à la VEA la plus haute dépense en premier, puis l'adversaire, qui puise aussi dans sa Petite Monnaie.",
        sheets: ["coups-de-pouce"],
        chapterSlug: "coups-de-pouce",
      },
      {
        id: "prieres",
        title: "Prières à Nuffle",
        summary:
          "L'outsider lance sur la table D16, une fois par tranche complète de 50 000 PO d'écart de VEA.",
        sheets: ["prieres-nuffle"],
      },
      {
        id: "engagement",
        title: "Tirage et engagement",
        summary:
          "Le vainqueur du tirage choisit d'engager ou de recevoir pour la première mi-temps.",
      },
    ],
  },
  {
    id: "pendant",
    label: "Match",
    title: "Pendant le match",
    intro:
      "Le coup d'envoi, puis la boucle des tours jusqu'à la fin de la seconde mi-temps.",
    steps: [
      {
        id: "placement",
        title: "Placer les équipes",
        summary: "Onze joueurs au maximum sur le terrain, avant le botté.",
        bullets: [
          "Au moins trois joueurs sur la ligne d'engagement.",
          "Deux joueurs au plus dans chaque zone large.",
          "L'équipe qui engage se place en premier.",
        ],
      },
      {
        id: "botte",
        title: "Botter, puis dévier",
        summary:
          "Le ballon est botté sur une case libre de la moitié adverse, puis dévie : 1D8 pour la direction, 1D6 pour la distance.",
      },
      {
        id: "evenement",
        title: "Événement de coup d'envoi",
        summary:
          "Dès que le ballon a dévié, le coach qui engage lance 2D6 et applique la perturbation obtenue.",
        sheets: ["coup-d-envoi", "meteo"],
        chapterSlug: "coup-d-envoi",
      },
      {
        id: "atterrissage",
        title: "Atterrissage",
        summary:
          "Réception, rebond, ou touchback si le ballon quitte le terrain ou n'atteint pas la bonne moitié.",
      },
      {
        id: "tour",
        title: "Ton tour",
        summary:
          "Une action par joueur — et au plus une de chacune de ces actions pour toute l'équipe.",
        bullets: [
          "1 Blitz",
          "1 Passe",
          "1 Remise",
          "1 Botter de coéquipier",
          "1 Agression",
        ],
      },
      {
        id: "turnover",
        title: "Turnover immédiat",
        summary: "Le tour s'arrête net dans chacun de ces cas.",
        tone: "danger",
        bullets: [
          "Un joueur de l'équipe active est Mis à Terre ou Plaqué.",
          "Une passe est ratée ou interceptée, ou le ballon n'est pas rattrapé.",
          "Le porteur du ballon échoue à un jet et le lâche.",
          "L'agresseur est Expulsé.",
          "Le temps du tour est écoulé, ou un touchdown est marqué.",
        ],
      },
      {
        id: "agression",
        title: "Agression",
        summary:
          "Une seule par tour, sur un adversaire Mis à Terre ou Sonné adjacent. Un double naturel sur l'armure ou la blessure expulse l'agresseur et provoque un turnover.",
        sheets: ["contester"],
        chapterSlug: "agressions",
      },
      {
        id: "blessures",
        title: "La cascade des blessures",
        summary:
          "Jet d'Armure, puis Jet de Blessure s'il dépasse l'AR, puis Jet d'Élimination sur un résultat Blessé.",
        bullets: [
          "L'apothicaire est proposé AVANT la régénération.",
          "S'il est refusé ou absent, la régénération se déclenche ensuite.",
        ],
        sheets: ["blessure", "elimination"],
        chapterSlug: "blessures-eliminations",
      },
    ],
  },
  {
    id: "apres",
    label: "Après",
    title: "Après le match",
    intro:
      "La séquence d'après-match, à dérouler par les deux coachs avant de ranger le plateau.",
    checkable: true,
    steps: [
      {
        id: "resultats",
        title: "Résultats et gains",
        summary:
          "Consignez victoire, défaite ou nul, puis additionnez les Facteurs de Popularité des deux équipes pour calculer les gains.",
        chapterSlug: "jeu-en-ligue",
      },
      {
        id: "fans",
        title: "Fans dévoués",
        summary: "Un D6 par équipe, à lire selon le résultat de la rencontre.",
        sheets: ["fans-devoues"],
      },
      {
        id: "psp",
        title: "PSP et améliorations",
        summary:
          "Créditez les PSP gagnés, puis dépensez-les : le coût dépend du palier atteint et du type d'amélioration.",
        sheets: ["psp-actions", "cout-ameliorations", "competences", "amelioration-carac"],
        chapterSlug: "amelioration-joueurs",
      },
      {
        id: "erreurs",
        title: "Erreurs coûteuses",
        summary:
          "Trésorerie d'au moins 100 000 PO ? Lancez 1D6 dans la colonne correspondant au montant.",
        sheets: ["erreurs-couteuses"],
      },
      {
        id: "preparer",
        title: "Préparer la prochaine rencontre",
        summary:
          "Embauches, renvois, retraite temporaire, puis mise à jour de la Valeur d'Équipe et de la VEA.",
        sheets: ["hausse-valeur"],
        chapterSlug: "jeu-en-ligue",
      },
    ],
  },
];

/** Actions limitées à une par tour d'équipe — la checklist du tour en cours. */
export const TURN_ACTIONS: readonly { id: string; label: string }[] = [
  { id: "blitz", label: "Blitz" },
  { id: "passe", label: "Passe" },
  { id: "remise", label: "Remise" },
  { id: "botter", label: "Botter de coéquipier" },
  { id: "agression", label: "Agression" },
];

export function getPhase(id: string): Phase | undefined {
  return PHASES.find((p) => p.id === id);
}

/** Ids des étapes cochables d'une phase (vide si la phase ne l'est pas). */
export function checkableStepIds(phase: Phase): readonly string[] {
  return phase.checkable ? phase.steps.map((s) => s.id) : [];
}
