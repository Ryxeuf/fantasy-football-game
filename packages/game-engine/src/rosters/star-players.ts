/**
 * Système de Star Players de Blood Bowl
 * Les Star Players sont des mercenaires légendaires pouvant être recrutés par plusieurs équipes
 */

export interface StarPlayerDefinition {
  slug: string;           // Identifiant unique (ex: glart_smashrip)
  displayName: string;    // Nom d'affichage
  cost: number;           // Coût en po (pièces d'or)
  ma: number;             // Movement Allowance
  st: number;             // Strength
  ag: number;             // Agility (valeur cible, ex: 3 pour 3+)
  pa: number | null;      // Passing (valeur cible, ex: 2 pour 2+, null pour -)
  av: number;             // Armour Value (valeur cible, ex: 9 pour 9+)
  skills: string;         // Compétences (séparées par virgules)
  hirableBy: string[];    // Équipes ou règles spéciales qui peuvent recruter ce joueur
  specialRule?: string;   // Règle spéciale du joueur
}

/**
 * Liste complète des Star Players disponibles
 */
export const STAR_PLAYERS: Record<string, StarPlayerDefinition> = {
  glart_smashrip: {
    slug: "glart_smashrip",
    displayName: "Glart Smashrip",
    cost: 195000,
    ma: 9,
    st: 4,
    ag: 4,
    pa: 4,
    av: 9,
    skills: "block,claw,juggernaut,loner-4,stand-firm",
    hirableBy: ["all"], // Favori de... ou Défi des Bas-fonds
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Favoris de...' ou 'Défi des Bas-fonds'. Une fois par match, quand Glart effectue un Blitz, il peut gagner la compétence Frénésie. Vous devez déclarer que cette règle spéciale est utilisée quand Glart est activé. Glart ne peut pas utiliser la compétence Projection pendant qu'il utilise cette règle spéciale."
  },

  gloriel_summerbloom: {
    slug: "gloriel_summerbloom",
    displayName: "Gloriel Summerbloom",
    cost: 150000,
    ma: 7,
    st: 2,
    ag: 2,
    pa: 2,
    av: 8,
    skills: "accurate,dodge,loner-3,pass,side-step,safe-pair-of-hands",
    hirableBy: ["elven_kingdoms_league"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Ligue des Royaumes Elfiques'. Tout ou Rien: Une fois par match, quand Gloriel effectue une Passe, elle peut gagner la compétence Passe Désespérée. Vous devez déclarer que cette règle spéciale est utilisée quand Gloriel est activée."
  },

  grak: {
    slug: "grak",
    displayName: "Grak",
    cost: 250000,
    ma: 5,
    st: 5,
    ag: 4,
    pa: 4,
    av: 10,
    skills: "bone-head,hurl-teammate,loner-4,mighty-blow-1,thick-skull",
    hirableBy: ["all"],
    specialRule: "Joue pour toute équipe. Deux pour Un!: Grak et Crumbleberry doivent être recrutés ensemble et comptent comme deux Star Players. Cependant, si Grak ou Crumbleberry est retiré du jeu à cause d'un résultat KO ou Éliminé! sur le tableau de Blessures, l'autre remplace le trait Solitaire (4+) par Solitaire (2+)."
  },

  crumbleberry: {
    slug: "crumbleberry",
    displayName: "Crumbleberry",
    cost: 0, // Inclus avec Grak
    ma: 5,
    st: 2,
    ag: 3,
    pa: 6,
    av: 7,
    skills: "dodge,loner-4,right-stuff,stunty,sure-feet",
    hirableBy: ["all"],
    specialRule: "Voir Grak - ils sont recrutés ensemble."
  },

  gretchen_wachter: {
    slug: "gretchen_wachter",
    displayName: "Gretchen Wächter 'La Veuve du Blood Bowl'",
    cost: 260000,
    ma: 7,
    st: 3,
    ag: 2,
    pa: null,
    av: 9,
    skills: "disturbing-presence,dodge,fend,jump-up,loner-4,no-hands,regeneration,side-step",
    hirableBy: ["sylvanian_spotlight"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Spot de Sylvanie'. Éthérée: Une fois par match, après un test d'Agilité pour esquiver, Gretchen peut décider de modifier le résultat en y ajoutant sa valeur de caractéristique Force."
  },

  griff_oberwald: {
    slug: "griff_oberwald",
    displayName: "Griff Oberwald",
    cost: 280000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 3,
    av: 9,
    skills: "block,dodge,fend,loner-3,sprint,sure-feet",
    hirableBy: ["old_world_classic", "halfling_thimble_cup"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling' ou 'Classique du Vieux Monde'. Grand Professionnel: Une fois par match, Griff peut relancer un dé qui a été jeté soit pour un jet d'un seul dé, soit pour un jet de plusieurs dés ou faisant partie d'un groupe de dés (il ne peut pas s'agir d'un jeté pour un jet d'Armure, de Blessure ou d'Élimination)."
  },

  mighty_zug: {
    slug: "mighty_zug",
    displayName: "Mighty Zug",
    cost: 220000,
    ma: 4,
    st: 5,
    ag: 4,
    pa: 6,
    av: 10,
    skills: "block,loner-4,mighty-blow-1",
    hirableBy: ["old_world_classic", "halfling_thimble_cup"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling', 'Classique du Vieux Monde' ou 'Super-ligue du Bord du Monde'. Coup Destructeur: Une fois par match, quand un joueur adverse est Plaqué en résultat d'un Blocage de Zug, vous pouvez appliquer un modificateur additionnel de +1 au jet d'Armure. Ce modificateur peut être appliqué après le jet de dés."
  },

  morg_n_thorg: {
    slug: "morg_n_thorg",
    displayName: "Morg 'n' Thorg",
    cost: 340000,
    ma: 6,
    st: 6,
    ag: 3,
    pa: 4,
    av: 11,
    skills: "block,hurl-teammate,loner-4,mighty-blow-2,thick-skull",
    hirableBy: ["all"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Spot de Sylvanie'. La Baliste: Une fois par match, si Morg rate le test de Passe quand il effectue une Passe ou un Lancer de Coéquipier, vous pouvez relancer le D6."
  },

  roxanna_darknail: {
    slug: "roxanna_darknail",
    displayName: "Roxanna Darknail",
    cost: 270000,
    ma: 8,
    st: 3,
    ag: 1,
    pa: 4,
    av: 8,
    skills: "dodge,frenzy,jump-up,juggernaut,leap,loner-4",
    hirableBy: ["elven_kingdoms_league"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Ligue des Royaumes Elfiques'. Pointe de Vitesse: Une fois par match, Roxanna peut tenter de Foncer trois fois au lieu de deux. Vous devez déclarer que vous utilisez cette règle spéciale après que Roxanna a Foncé deux fois."
  },

  rumbelow_sheepskin: {
    slug: "rumbelow_sheepskin",
    displayName: "Rumbelow Sheepskin",
    cost: 170000,
    ma: 6,
    st: 3,
    ag: 3,
    pa: null,
    av: 8,
    skills: "block,horns,juggernaut,loner-4,no-hands,tackle,thick-skull",
    hirableBy: ["old_world_classic", "halfling_thimble_cup"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling', 'Classique du Vieux Monde' ou 'Super-ligue du Bord du Monde'. Bélier: Une fois par match, quand un joueur adverse est Plaqué en résultat d'un Blocage de Rumbelow, vous pouvez appliquer un modificateur additionnel de +1 au jet d'Armure ou au jet de Blessure. Ce modificateur peut être appliqué après le jet de dés."
  },

  skrull_halfheight: {
    slug: "skrull_halfheight",
    displayName: "Skrull Halfheight",
    cost: 150000,
    ma: 6,
    st: 3,
    ag: 4,
    pa: 4,
    av: 9,
    skills: "accurate,loner-4,nerves-of-steel,pass,regeneration,sure-hands,thick-skull",
    hirableBy: ["sylvanian_spotlight", "worlds_edge_superleague"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Spot de Sylvanie' ou 'Super-ligue du Bord du Monde'. Jeu de Passe Suprême: Une fois par match, après avoir effectué le test de Passe quand il effectue une Passe, Skrull peut décider de modifier le jet de dé en lui ajoutant sa valeur de caractéristique de Force."
  },

  grim_ironjaw: {
    slug: "grim_ironjaw",
    displayName: "Grim Ironjaw",
    cost: 200000,
    ma: 5,
    st: 4,
    ag: 3,
    pa: null,
    av: 9,
    skills: "block,dauntless,frenzy,loner-4,multiple-block,thick-skull",
    hirableBy: ["old_world_classic", "halfling_thimble_cup"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling', 'Classique du Vieux Monde' ou 'Super-ligue du Bord du Monde'. Tueur: Une fois par match, quand un joueur adverse avec une caractéristique Force de 5 ou plus est Plaqué en résultat d'un Blocage de Grim, vous pouvez appliquer un modificateur additionnel de +1 au jet d'Armure ou de Blessure. Ce modificateur peut être appliqué après le jet de dés."
  },

  hakflem_skuttlespike: {
    slug: "hakflem_skuttlespike",
    displayName: "Hakflem Skuttlespike",
    cost: 180000,
    ma: 9,
    st: 3,
    ag: 2,
    pa: 3,
    av: 8,
    skills: "dodge,extra-arms,loner-4,prehensile-tail,two-heads",
    hirableBy: ["underworld_challenge"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Favoris de...' ou 'Défi des Bas-fonds'. Traître: Une fois par match, si un équipier sur une case adjacente à Hakflem est en possession du ballon quand Hakflem est activé, ce joueur peut être immédiatement Plaqué et Hakflem peut prendre possession du ballon. L'utilisation de cette règle spéciale n'entraîne pas de Turnover."
  },

  helmut_wulf: {
    slug: "helmut_wulf",
    displayName: "Helmut Wulf",
    cost: 140000,
    ma: 6,
    st: 3,
    ag: 3,
    pa: null,
    av: 9,
    skills: "chainsaw,loner-4,pro,secret-weapon,stand-firm",
    hirableBy: ["all"],
    specialRule: "Joue pour toute équipe. Vieux Pro: Une fois par match, Helmut peut utiliser sa compétence Pro pour relancer un seul dé d'un jet d'Armure."
  },

  karla_von_kill: {
    slug: "karla_von_kill",
    displayName: "Karla Von Kill",
    cost: 210000,
    ma: 6,
    st: 4,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "block,dauntless,dodge,jump-up,loner-4",
    hirableBy: ["old_world_classic", "lustrian_superleague"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling', 'Super-ligue de Lustrie' ou 'Classique du Vieux Monde'. Indomptable: Une fois par match, quand Karla réussit son jet pour utiliser sa compétence Intrépide, elle peut augmenter sa caractéristique de Force pour être le double de celle de la cible de ce Blocage."
  },

  lord_borak: {
    slug: "lord_borak",
    displayName: "Lord Borak the Despoiler",
    cost: 260000,
    ma: 5,
    st: 5,
    ag: 3,
    pa: 5,
    av: 10,
    skills: "block,dirty-player-2,loner-4,mighty-blow-1,sneaky-git",
    hirableBy: ["favoured_of"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Favoris de...'. Seigneur du Chaos: Une équipe qui inclut Lord Borak gagne une relance d'Équipe supplémentaire pour la première mi-temps. Si elle n'est pas utilisée pendant la première mi-temps, elle est transférée pour la seconde mi-temps. Cependant, si Lord Borak est retiré du jeu avant l'utilisation de cette relance, elle est alors perdue."
  },

  the_black_gobbo: {
    slug: "the_black_gobbo",
    displayName: "The Black Gobbo",
    cost: 225000,
    ma: 6,
    st: 2,
    ag: 3,
    pa: 3,
    av: 9,
    skills: "bombardier,disturbing-presence,dodge,loner-3,side-step,sneaky-git,stab,stunty",
    hirableBy: ["badlands_brawl", "underworld_challenge"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Bagarre des Terres Arides' ou 'Défi des Bas-fonds'. Le Plus Sournois de Tous: Si votre équipe inclut le Black Gobbo, vous pouvez relancer un jet d'Agression par tour d'équipe, tant que l'une d'elles est commise par le Black Gobbo."
  },

  deeproot_strongbranch: {
    slug: "deeproot_strongbranch",
    displayName: "Deeproot Strongbranch",
    cost: 280000,
    ma: 2,
    st: 7,
    ag: 5,
    pa: 4,
    av: 11,
    skills: "block,loner-4,mighty-blow-2,stand-firm,strong-arm,thick-skull,throw-team-mate,timmm-ber",
    hirableBy: ["old_world_classic", "halfling_thimble_cup"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling' ou 'Classique du Vieux Monde'. Fiable: Si Deeproot commet une maladresse avec l'action Lancer de Coéquipier, le joueur lancé rebondit automatiquement mais atterrit automatiquement sans pieds. L'utilisation de cette règle spéciale n'entraîne pas de Turnover."
  },

  eldril_sidewinder: {
    slug: "eldril_sidewinder",
    displayName: "Eldril Sidewinder",
    cost: 230000,
    ma: 8,
    st: 3,
    ag: 2,
    pa: 5,
    av: 8,
    skills: "catch,dodge,hypnotic-gaze,loner-4,nerves-of-steel,on-the-ball",
    hirableBy: ["elven_kingdoms_league"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Ligue des Royaumes Elfiques'. Danse Hypnotisante: Une fois par match, Eldril peut relancer un test d'Agilité raté quand il tente d'utiliser le trait Regard Hypnotique."
  },

  lucien_swift: {
    slug: "lucien_swift",
    displayName: "Lucien Swift",
    cost: 340000,
    ma: 7,
    st: 3,
    ag: 2,
    pa: 5,
    av: 9,
    skills: "block,loner-4,mighty-blow-1,tackle",
    hirableBy: ["elven_kingdoms_league"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Ligue des Royaumes Elfiques'. Deux pour Un: St Lucien ou Valen est retiré du jeu à cause d'un résultat K.-O. ou Éliminé! sur le tableau de Blessures, l'autre remplace le trait Solitaire (4+) par Solitaire (2+)."
  },

  valen_swift: {
    slug: "valen_swift",
    displayName: "Valen Swift",
    cost: 340000,
    ma: 7,
    st: 3,
    ag: 2,
    pa: 2,
    av: 8,
    skills: "accurate,loner-4,nerves-of-steel,pass,safe-pair-of-hands,sure-hands",
    hirableBy: ["elven_kingdoms_league"],
    specialRule: "Voir Lucien Swift - ils sont recrutés ensemble."
  },

  varag_ghoul_chewer: {
    slug: "varag_ghoul_chewer",
    displayName: "Varag Ghoul-Chewer",
    cost: 280000,
    ma: 6,
    st: 5,
    ag: 3,
    pa: 5,
    av: 10,
    skills: "block,jump-up,loner-4,mighty-blow-1,thick-skull",
    hirableBy: ["badlands_brawl", "underworld_challenge"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Bagarre des Terres Arides' ou 'Défi des Bas-fonds'. Coup Destructeur: Une fois par match, quand un joueur adverse est Plaqué en résultat d'un Blocage de Varag, vous pouvez appliquer un modificateur additionnel de +1 au jet d'Armure. Ce modificateur peut être appliqué après le jet de dés."
  },

  grombrindal: {
    slug: "grombrindal",
    displayName: "Grombrindal, the White Dwarf",
    cost: 210000,
    ma: 5,
    st: 3,
    ag: 3,
    pa: 4,
    av: 10,
    skills: "block,dauntless,loner-4,mighty-blow-1,stand-firm,thick-skull",
    hirableBy: ["old_world_classic", "worlds_edge_superleague"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Coupe Dé à Coudre Halfling', 'Super-ligue de Lustrie' ou 'Classique du Vieux Monde' ou 'Super-ligue du Bord du Monde'. Sagesse du Nain Blanc: Une fois par tour d'équipe, quand un des coéquipiers de Grombrindal se trouvant sur une case adjacente à lui est activé, ce joueur gagne la compétence Esquive en Force, Intrépide, Châtaigne (+1) ou Équilibre jusqu'à la fin de son activation."
  },

  willow_rosebark: {
    slug: "willow_rosebark",
    displayName: "Willow Rosebark",
    cost: 150000,
    ma: 5,
    st: 4,
    ag: 3,
    pa: 6,
    av: 9,
    skills: "dauntless,loner-4,side-step,thick-skull",
    hirableBy: ["elven_kingdoms_league"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Ligue des Royaumes Elfiques'. Indomptable: Une fois par match, quand Willow réussit son jet pour utiliser sa compétence Intrépide, elle peut augmenter sa caractéristique de Force pour être le double de celle de la cible de ce Blocage."
  },

  zolcath_the_zoat: {
    slug: "zolcath_the_zoat",
    displayName: "Zolcath le Zoat",
    cost: 230000,
    ma: 5,
    st: 5,
    ag: 4,
    pa: 5,
    av: 10,
    skills: "disturbing-presence,juggernaut,loner-4,mighty-blow-1,prehensile-tail,regeneration,sure-feet",
    hirableBy: ["lustrian_superleague", "elven_kingdoms_league"],
    specialRule: "Joue pour toute équipe avec la règle spéciale 'Super-ligue de Lustrie' ou 'Ligue des Royaumes Elfiques'. 'Êtes-vous un Zoat?': Une fois par match, quand Zolcath est activé, il peut gagner le trait Regard Hypnotique. Vous devez déclarer que cette règle spéciale est utilisée quand Zolcath est activé."
  },
};

/**
 * Obtenir un Star Player par son slug
 */
export function getStarPlayerBySlug(slug: string): StarPlayerDefinition | undefined {
  return STAR_PLAYERS[slug];
}

/**
 * Obtenir tous les Star Players disponibles pour une équipe donnée
 * @param teamRoster - Le roster de l'équipe (ex: "skaven")
 * @param teamRegionalRules - Les règles régionales de l'équipe (ex: ["underworld_challenge"])
 */
export function getAvailableStarPlayers(
  teamRoster: string,
  teamRegionalRules: string[] = []
): StarPlayerDefinition[] {
  return Object.values(STAR_PLAYERS).filter(starPlayer => {
    // Si le Star Player est disponible pour tous
    if (starPlayer.hirableBy.includes("all")) {
      return true;
    }

    // Vérifier si l'équipe a une des règles régionales requises
    return starPlayer.hirableBy.some(rule => teamRegionalRules.includes(rule));
  });
}

/**
 * Mapping des équipes vers leurs règles régionales
 */
export const TEAM_REGIONAL_RULES: Record<string, string[]> = {
  skaven: ["underworld_challenge"],
  lizardmen: ["lustrian_superleague"],
  wood_elf: ["elven_kingdoms_league"],
  dark_elf: ["elven_kingdoms_league"],
  dwarf: ["old_world_classic", "worlds_edge_superleague"],
  goblin: ["badlands_brawl", "underworld_challenge"],
  undead: ["sylvanian_spotlight"],
  chaos_renegade: ["favoured_of"],
  ogre: ["badlands_brawl", "old_world_classic"],
  halfling: ["halfling_thimble_cup", "old_world_classic"],
  underworld: ["underworld_challenge"],
  chaos_chosen: ["favoured_of"],
  imperial_nobility: ["old_world_classic"],
  necromantic_horror: ["sylvanian_spotlight"],
  orc: ["badlands_brawl"],
  nurgle: ["favoured_of"],
  old_world_alliance: ["old_world_classic"],
  elven_union: ["elven_kingdoms_league"],
  human: ["old_world_classic"],
  black_orc: ["badlands_brawl"],
  snotling: ["underworld_challenge"],
  high_elf: ["elven_kingdoms_league"],
  norse: ["old_world_classic", "favoured_of"],
  amazon: ["lustrian_superleague"],
  vampire: ["sylvanian_spotlight"],
  tomb_kings: ["sylvanian_spotlight"],
  khorne: ["favoured_of"],
  chaos_dwarf: ["badlands_brawl", "worlds_edge_superleague", "favoured_of"],
  gnome: ["halfling_thimble_cup"],
};

/**
 * Types utilitaires pour les règles régionales
 */
export type RegionalRule = 
  | "badlands_brawl"
  | "elven_kingdoms_league"
  | "halfling_thimble_cup"
  | "lustrian_superleague"
  | "old_world_classic"
  | "sylvanian_spotlight"
  | "underworld_challenge"
  | "worlds_edge_superleague"
  | "favoured_of";

