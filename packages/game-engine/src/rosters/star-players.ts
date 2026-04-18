/**
 * Système de Star Players de Blood Bowl
 * Les Star Players sont des mercenaires légendaires pouvant être recrutés par plusieurs équipes
 */
import { DEFAULT_RULESET, Ruleset } from "./positions";
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
  imageUrl?: string;      // URL de l'image du joueur
  isMegaStar?: boolean;    // Flag Mega Star
}

const getFallbackSpecialRule = (name: string) =>
  `Consultez le Livre de Règles Blood Bowl pour connaître la règle spéciale complète de ${name}.`;

/**
 * Liste complète des Star Players disponibles pour la saison 2
 */
const SEASON_TWO_STAR_PLAYERS: Record<string, StarPlayerDefinition> = {
  akhorne_the_squirrel: {
    slug: "akhorne_the_squirrel",
    displayName: "Akhorne The Squirrel",
    cost: 80000,
    ma: 7,
    st: 1,
    ag: 2,
    pa: null,
    av: 6,
    skills: "claws,dauntless,dodge,frenzy,jump-up,loner-4,no-hands,sidestep,stunty,blind-rage",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/akhorne-the-squirrel-1024x922.webp",
    specialRule: "Rage Aveugle : Akhorne peut relancer le D6 de son jet d'Intrépide (Dauntless) une fois par tentative. Une fois par match, il peut également relancer un dé de Blocage perdu lorsqu'il attaque un joueur de Force supérieure."
  },

  anqi_panqi: {
    slug: "anqi_panqi",
    displayName: "Anqi Panqi",
    cost: 190000,
    ma: 7,
    st: 4,
    ag: 5,
    pa: 6,
    av: 10,
    skills: "block,grab,loner-4,stand-firm,coup-sauvage",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/Anqi-Panqi-star-player-.webp",
    specialRule: "Coup Sauvage: Une fois par partie, lorsqu'Anqi effectue une action de Blocage contre un joueur adverse, il peut choisir de relancer n'importe quel nombre de dés de Blocage."
  },

  barik_farblast: {
    slug: "barik_farblast",
    displayName: "Barik Farblast",
    cost: 80000,
    ma: 6,
    st: 3,
    ag: 4,
    pa: 3,
    av: 9,
    skills: "hail-mary-pass,loner-4,pass,secret-weapon,cannoneer,sure-hands,thick-skull",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/barik-farblast.webp",
    specialRule: "Cannoneer : Lorsque Barik effectue une Passe, réduisez tout modificateur négatif de 1 (minimum 0)."
  },

  bilerot_vomitflesh: {
    slug: "bilerot_vomitflesh",
    displayName: "Bilerot Vomitflesh",
    cost: 180000,
    ma: 4,
    st: 5,
    ag: 4,
    pa: 6,
    av: 10,
    skills: "dirty-player-1,disturbing-presence,foul-appearance,loner-4",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/bilerot_vomitflesh.svg",
    specialRule: "Vomi Projectile : Une fois par match, Bilerot peut effectuer une attaque de Vomi Projectile contre un joueur adverse adjacent, provoquant un jet d'Armure."
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
    skills: "secret-weapon,disturbing-presence,dodge,loner-4,sidestep,sneaky-git,stab,stunty",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/The-Black-Gobbo.webp",
    specialRule: "Le Plus Sournois : Une fois par match, si le Black Gobbo est expulsé pour Arme Secrète, lancez un D6 ; sur 4+, il n'est pas expulsé."
  },

  boa_konssstriktr: {
    slug: "boa_konssstriktr",
    displayName: "Boa Kon’ssstriktr",
    cost: 200000,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "dodge,sidestep,prehensile-tail,loner-4,hypnotic-gaze",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/boa_konssstriktr.svg",
    specialRule: "Regard Hypnotique : Boa peut utiliser son Regard Hypnotique pour neutraliser un joueur adverse adjacent, l'empêchant d'utiliser sa zone de tacle."
  },

  bomber_dribblesnot: {
    slug: "bomber_dribblesnot",
    displayName: "Bomber Dribblesnot",
    cost: 50000,
    ma: 6,
    st: 2,
    ag: 3,
    pa: 3,
    av: 8,
    skills: "accurate,secret-weapon,dodge,loner-4,stunty,right-stuff",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Bomber-Dribblesnot.webp",
    specialRule: "Kaboom! : Bomber peut lancer des bombes au lieu du ballon. La bombe explose à l'impact, mettant au sol les joueurs dans la case cible."
  },

  bryce_the_slice_cambuel: {
    slug: "bryce_the_slice_cambuel",
    displayName: "Bryce ‘The Slice’ Cambuel",
    cost: 130000,
    ma: 5,
    st: 3,
    ag: 4,
    pa: null,
    av: 9,
    skills: "chainsaw,loner-4,regeneration,secret-weapon,stand-firm,thick-skull",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Bryce-The-Slice-Cambuel-2023.webp",
    specialRule: "Flammes Fantomatiques : Une fois par match, tous les joueurs adverses adjacents à Bryce perdent leur zone de tacle jusqu'à la fin du tour."
  },

  cindy_piewhistle: {
    slug: "cindy_piewhistle",
    displayName: "Cindy Piewhistle",
    cost: 50000,
    ma: 5,
    st: 2,
    ag: 3,
    pa: 3,
    av: 7,
    skills: "secret-weapon,dodge,stunty,accurate,loner-4",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/Cindy_Piewhistle.webp",
    specialRule: "Lanceuse de Tartes : Cindy peut lancer des tartes au lieu du ballon, étourdissant les joueurs touchés."
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
    skills: "block,loner-4,mighty-blow-1,stand-firm,strong-arm,thick-skull,throw-team-mate,timmm-ber,reliable",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/deeproot-strongbranch.webp",
    specialRule: "Fiable : Un Lancer de Coéquipier raté par Deeproot Strongbranch ne déclenche pas de turnover et la case d'atterrissage dévie d'une seule case au lieu de trois. Cet effet s'applique aussi aux passes ratées qu'il effectue."
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
    skills: "loner-4,dodge,nerves-of-steel,catch,hypnotic-gaze,on-the-ball",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Eldril-Sidewinder.webp",
    specialRule: "Danse Envoûtante : Une fois par match, après avoir été mis au sol, Eldril peut se relever gratuitement sur un jet de 2+."
  },

  estelle_la_veneaux: {
    slug: "estelle_la_veneaux",
    displayName: "Estelle la Veneaux",
    cost: 190000,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: "dodge,guard,sidestep,disturbing-presence,loner-4",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/star-player-whitergrasp-doubledrool.webp",
    specialRule: "Griffes Venimeuses : Une fois par match, après un Blocage réussi, Estelle peut infliger un jet d'Armure automatique au joueur ciblé."
  },

  frank_n_stein: {
    slug: "frank_n_stein",
    displayName: "Frank ‘n’ Stein",
    cost: 250000,
    ma: 4,
    st: 5,
    ag: 4,
    pa: null,
    av: 10,
    skills: "break-tackle,loner-4,mighty-blow-1,regeneration,stand-firm,thick-skull",
    hirableBy: ["old_world_classic", "sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/frank-n-stein.webp",
    specialRule: "Fracas Brutal : Une fois par match, Frank peut ajouter +1 au jet d'Armure après un Blocage réussi."
  },

  fungus_the_loon: {
    slug: "fungus_the_loon",
    displayName: "Fungus The Loon",
    cost: 80000,
    ma: 4,
    st: 7,
    ag: 3,
    pa: null,
    av: 8,
    skills: "secret-weapon,ball-and-chain,mighty-blow-1,stunty,loner-4,no-hands",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp",
    specialRule: "Le Fou Furieux : Fungus se déplace aléatoirement avec son Boulet et Chaîne, écrasant tout joueur sur son passage."
  },

  glart_smashrip: {
    slug: "glart_smashrip",
    displayName: "Glart Smashrip",
    cost: 195000,
    ma: 9,
    st: 4,
    ag: 4,
    pa: 4,
    av: 9,
    skills: "block,claws,juggernaut,grab,loner-4,stand-firm",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Glart-Smashrip.webp",
    specialRule: "Charge Frénétique : Une fois par match, lors d'un Blitz, Glart peut se déplacer de 3 cases supplémentaires."
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
    skills: "accurate,dodge,loner-4,pass,sidestep,sure-hands",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/gloriel_summerbloom.svg",
    specialRule: "Tir à Bout Portant : Une fois par match, après une Passe complétée par Gloriel, le receveur peut se déplacer de 3 cases supplémentaires."
  },

  glotl_stop: {
    slug: "glotl_stop",
    displayName: "Glotl Stop",
    cost: 270000,
    ma: 6,
    st: 6,
    ag: 5,
    pa: null,
    av: 10,
    skills: "mighty-blow-1,thick-skull,frenzy,animal-savagery,prehensile-tail,loner-4,stand-firm",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/glotl_stop.svg",
    specialRule: "Sauvagerie Primale : Une fois par match, lors d'un Blocage, Glotl peut ajouter +2 à sa Force."
  },

  grashnak_blackhoof: {
    slug: "grashnak_blackhoof",
    displayName: "Grashnak Blackhoof",
    cost: 240000,
    ma: 6,
    st: 6,
    ag: 4,
    pa: null,
    av: 9,
    skills: "frenzy,horns,loner-4,mighty-blow-1,thick-skull,wild-animal",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Grashnak-Blackhoof.webp",
    specialRule: "Encorné par le Taureau : Une fois par match, lors d'un Blitz, Grashnak peut ajouter +2 au jet d'Armure."
  },

  grak: {
    slug: "grak",
    displayName: "Grak",
    cost: 250000,
    ma: 5,
    st: 5,
    ag: 4,
    pa: 5,
    av: 10,
    skills: "bone-head,kick-team-mate,loner-4,mighty-blow-1,thick-skull,throw-team-mate",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/GrakCrumbleberry.webp",
    specialRule: "Grak & Crumbleberry : Grak ne se présente jamais sans Crumbleberry et excelle lorsqu'il le propulse sur le terrain."
  },

  crumbleberry: {
    slug: "crumbleberry",
    displayName: "Crumbleberry",
    cost: 0,
    ma: 5,
    st: 2,
    ag: 3,
    pa: 4,
    av: 7,
    skills: "dodge,loner-4,right-stuff,stunty,sure-hands,sure-feet,titchy",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/GrakCrumbleberry.webp",
    specialRule: "Grak & Crumbleberry : Crumbleberry est sanglé au dos de Grak et profite d'un lancer spécial lorsqu'il joue avec lui."
  },

  gretchen_wachter: {
    slug: "gretchen_wachter",
    displayName: "Gretchen Wachter “The Blood Bowl Widow”",
    cost: 260000,
    ma: 7,
    st: 3,
    ag: 2,
    pa: null,
    av: 9,
    skills: "disturbing-presence,dodge,foul-appearance,jump-up,loner-4,no-hands,regeneration,shadowing,sidestep",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Skitter-Stab-Stab-blood-bowl-star-player.webp",
    specialRule: "Incorporelle : Une fois par match, Gretchen peut traverser les cases occupées par d'autres joueurs durant son déplacement."
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
    skills: "loner-4,block,sure-feet,dodge,fend,sprint,consummate-professional",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/griff_oberwald.svg",
    specialRule: "Consummate Professional: Une fois par match, Griff peut relancer n'importe quel dé.",
    isMegaStar: true
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
    skills: "loner-4,block,dauntless,frenzy,multiple-block,thick-skull,slayer",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/grim-ironjaw-card.webp",
    specialRule: "Tueur Grudgebearer : Grim Ironjaw peut relancer ses jets d'Intrépide ratés. Une fois par match, lorsqu'il cible un joueur de Force 4 ou plus lors d'un Blocage ou d'un Blitz, il peut ajouter +1 au jet de Blessure si la cible est mise à terre."
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
    hirableBy: ["lustrian_superleague", "old_world_classic"],
    imageUrl: "/data/Star-Players_files/Grombrindal-the-White-Dwarf.webp",
    specialRule: "Sagesse du Nain Blanc : Une fois par match, l'équipe de Grombrindal peut utiliser une relance d'équipe gratuite, même si elle n'en a plus."
  },

  guffle_pussmaw: {
    slug: "guffle_pussmaw",
    displayName: "Guffle Pussmaw",
    cost: 180000,
    ma: 5,
    st: 4,
    ag: 4,
    pa: 6,
    av: 10,
    skills: "plague-ridden,monstrous-mouth,bloodlust,foul-appearance,loner-4",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Guffle-Pussmaw-Star-Player.webp",
    specialRule: "Bouche Monstrueuse : Guffle peut attraper le ballon avec sa bouche immonde, lui conférant +1 au jet de Réception."
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
    skills: "loner-4,extra-arms,two-heads,dodge,prehensile-tail",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Hakflem-Skuttlespike.webp",
    specialRule: "Traître : Une fois par match, Hakflem peut effectuer une action de Coup de Poignard gratuite contre un joueur adjacent sans provoquer de turnover."
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
    skills: "chainsaw,loner-4,secret-weapon,pro,stand-firm",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/helmut_wulf.svg",
    specialRule: "Vieux Pro : Une fois par match, si Helmut est expulsé pour Arme Secrète, lancez un D6 ; sur 2+, il peut rester un drive de plus."
  },

  hthark_the_unstoppable: {
    slug: "hthark_the_unstoppable",
    displayName: "H'thark the Unstoppable",
    cost: 300000,
    ma: 6,
    st: 6,
    ag: 4,
    pa: 6,
    av: 10,
    skills: "block,thick-skull,defensive,sure-feet,break-tackle,juggernaut,sprint,loner-4",
    hirableBy: ["badlands_brawl"],
    imageUrl: "/data/Star-Players_files/hthark_the_unstoppable.svg",
    specialRule: "Imparable : H'thark ne peut être mis au sol que par un résultat Double Crâne sur les dés de Blocage.",
    isMegaStar: true
  },

  ivan_the_animal_deathshroud: {
    slug: "ivan_the_animal_deathshroud",
    displayName: "Ivan 'the Animal' Deathshroud",
    cost: 190000,
    ma: 6,
    st: 4,
    ag: 4,
    pa: 4,
    av: 9,
    skills: "block,juggernaut,disturbing-presence,sure-hands,regeneration,loner-4,tackle",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/ivan_the_animal_deathshroud.svg",
    specialRule: "Mort et Fier de l'Être : Les adversaires doivent soustraire 1 aux jets de Blessure contre Ivan.",
    isMegaStar: true
  },

  ivar_eriksson: {
    slug: "ivar_eriksson",
    displayName: "Ivar Eriksson",
    cost: 245000,
    ma: 6,
    st: 4,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "block,guard,loner-4,tackle",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/ivar_eriksson.svg",
    specialRule: "Mur de Boucliers : Tant qu'Ivar est debout, les coéquipiers adjacents bénéficient de +1 à leur Valeur d'Armure."
  },

  jeremiah_kool: {
    slug: "jeremiah_kool",
    displayName: "Jeremiah Kool",
    cost: 320000,
    ma: 8,
    st: 3,
    ag: 1,
    pa: 2,
    av: 9,
    skills: "block,dump-off,dodge,sidestep,nerves-of-steel,pass,diving-catch,loner-4,on-the-ball",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/jeremiah_kool.svg",
    specialRule: "Le Kata de Kool : Une fois par match, après avoir réceptionné le ballon, Jeremiah peut effectuer un déplacement gratuit de 3 cases."
  },

  jordell_freshbreeze: {
    slug: "jordell_freshbreeze",
    displayName: "Jordell Freshbreeze",
    cost: 250000,
    ma: 8,
    st: 3,
    ag: 1,
    pa: 3,
    av: 8,
    skills: "block,dodge,sidestep,diving-catch,leap,loner-4",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/jordell_freshbreeze.svg",
    specialRule: "Réception du Siècle : Une fois par match, Jordell peut ajouter +1 à un jet de Réception ou d'Interception."
  },

  karina_von_riesz: {
    slug: "karina_von_riesz",
    displayName: "Karina von Riesz",
    cost: 230000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 4,
    av: 9,
    skills: "bloodlust,dodge,hypnotic-gaze,jump-up,loner-4,regeneration",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/karina_von_riesz.svg",
    specialRule: "Charme Vampirique : Une fois par match, Karina peut forcer un joueur adverse adjacent à se déplacer d'une case dans une direction de son choix."
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
    hirableBy: ["lustrian_superleague", "old_world_classic"],
    imageUrl: "/data/Star-Players_files/karla_von_kill.svg",
    specialRule: "Indomptable : Une fois par match, Karla peut ajouter +1 à sa Force pour une action de Blocage ou de Blitz."
  },

  kiroth_krakeneye: {
    slug: "kiroth_krakeneye",
    displayName: "Kiroth Krakeneye",
    cost: 170000,
    ma: 7,
    st: 3,
    ag: 2,
    pa: 3,
    av: 9,
    skills: "disturbing-presence,foul-appearance,loner-4,on-the-ball,tackle,tentacles",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Kiroth-Krakeneye.webp",
    specialRule: "Emprise Eldritch : Les joueurs adverses subissent un modificateur de -1 lorsqu'ils tentent d'Esquiver hors de la zone de tacle de Kiroth."
  },

  kreek_rustgouger: {
    slug: "kreek_rustgouger",
    displayName: "Kreek Rustgouger",
    cost: 170000,
    ma: 5,
    st: 7,
    ag: 4,
    pa: null,
    av: 10,
    skills: "ball-and-chain,loner-4,mighty-blow-1,no-hands,prehensile-tail,secret-weapon",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Kreek-Rustgouger.webp",
    specialRule: "Boulet Rouillé : Kreek se déplace aléatoirement avec son Boulet et Chaîne, broyant tout joueur sur son passage."
  },

  lord_borak: {
    slug: "lord_borak",
    displayName: "Lord Borak The Despoiler",
    cost: 260000,
    ma: 5,
    st: 5,
    ag: 3,
    pa: 5,
    av: 10,
    skills: "block,mighty-blow-1,dirty-player-1,loner-4,sneaky-git,lord-of-chaos",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Lord-borak.webp",
    specialRule: "Seigneur du Chaos : Tant que Lord Borak est sur le terrain, son équipe reçoit +1 relance d'équipe en début de chaque mi-temps. Si Lord Borak est retiré du jeu (KO, blessure ou mort), la relance bonus en cours est immédiatement perdue."
  },

  lucien_swift: {
    slug: "lucien_swift",
    displayName: "Lucien Swift",
    cost: 340000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 3,
    av: 9,
    skills: "block,dauntless,loner-4,sidestep,tackle",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/lucien_swift.svg",
    specialRule: "Les Swift Twins : Lucien forme un duo inséparable avec Valen et bénéficie d'un bonus lorsqu'ils jouent ensemble."
  },

  valen_swift: {
    slug: "valen_swift",
    displayName: "Valen Swift",
    cost: 340000,
    ma: 8,
    st: 3,
    ag: 2,
    pa: 4,
    av: 8,
    skills: "catch,dodge,loner-4,nerves-of-steel,sidestep,sure-feet",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/valen_swift.svg",
    specialRule: "Les Swift Twins : Valen joue en tandem avec Lucien et profite d'actions combinées lorsqu'il est aligné avec lui."
  },

  luthor_von_drakenborg: {
    slug: "luthor_von_drakenborg",
    displayName: "Luthor von Drakenborg",
    cost: 340000,
    ma: 6,
    st: 5,
    ag: 2,
    pa: 3,
    av: 10,
    skills: "block,hypnotic-gaze,loner-4,regeneration,sidestep",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/luthor_von_drakenborg.svg",
    specialRule: "Seigneur Vampire : Une fois par match, Luthor peut relancer un jet de Soif de Sang (Bloodlust) raté."
  },

  maple_highgrove: {
    slug: "maple_highgrove",
    displayName: "Maple Highgrove",
    cost: 210000,
    ma: 3,
    st: 5,
    ag: 5,
    pa: 5,
    av: 11,
    skills: "brawler,mighty-blow-1,thick-skull,grab,loner-4,stand-firm,tentacles",
    hirableBy: ["elven_kingdoms_league", "old_world_classic"],
    imageUrl: "/data/Star-Players_files/maple_highgrove.svg",
    specialRule: "Le Grand Ent : Une fois par match, Maple peut ajouter +1 à sa Force pour une action de Blocage."
  },

  max_spleenripper: {
    slug: "max_spleenripper",
    displayName: "Max Spleenripper",
    cost: 130000,
    ma: 5,
    st: 4,
    ag: 4,
    pa: null,
    av: 9,
    skills: "chainsaw,loner-4,secret-weapon",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/max_spleenripper.svg",
    specialRule: "Carnage Maximum : Une fois par match, lors d'une attaque à la Tronçonneuse réussie, Max peut ajouter +1 au jet d'Armure."
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
    skills: "loner-4,block,mighty-blow-1,casse-os",
    hirableBy: ["lustrian_superleague", "old_world_classic"],
    imageUrl: "/data/Star-Players_files/mighty_zug.svg",
    specialRule: "Casse-Os : Une fois par match, avant d'effectuer une action de Blocage ou de Blitz, Mighty Zug peut déclarer Casse-Os. Il gagne +1 en Force pour cette seule action, en cumul avec ses autres modificateurs et son skill Mighty Blow."
  },

  prince_moranion: {
    slug: "prince_moranion",
    displayName: "Prince Moranion",
    cost: 230000,
    ma: 7,
    st: 4,
    ag: 2,
    pa: 3,
    av: 9,
    skills: "block,dauntless,wrestle,loner-4,tackle",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/prince_moranion.svg",
    specialRule: "Bravoure Elfique : Une fois par match, Prince Moranion peut se relever gratuitement et effectuer un Blocage sans utiliser d'action de Blitz."
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
    skills: "loner-4,block,mighty-blow-2,thick-skull,throw-team-mate,la-baliste",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Morg-'n-Thorg.webp",
    specialRule: "La Baliste: Une fois par match, si Morg rate le test de Passe quand il effectue une Passe ou un Lancer de Coéquipier, vous pouvez relancer le D6.",
    isMegaStar: true
  },

  nobbla_blackwart: {
    slug: "nobbla_blackwart",
    displayName: "Nobbla Blackwart",
    cost: 120000,
    ma: 6,
    st: 2,
    ag: 3,
    pa: null,
    av: 8,
    skills: "secret-weapon,block,dodge,stunty,loner-4,chainsaw",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Nobbla-Blackwart-3rd-Edition.webp",
    specialRule: "Frappez-les à Terre : Une fois par match, lors d'une Faute, Nobbla peut ajouter +1 au jet d'Armure."
  },

  puggy_baconbreath: {
    slug: "puggy_baconbreath",
    displayName: "Puggy Baconbreath",
    cost: 120000,
    ma: 5,
    st: 3,
    ag: 3,
    pa: 4,
    av: 7,
    skills: "dodge,titchy,nerves-of-steel,right-stuff,loner-4",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/Puggy_Baconbreath.webp",
    specialRule: "Demi-Portion : Une fois par match, Puggy peut ignorer les zones de tacle adverses lors de son déplacement pour un tour."
  },

  rashnak_backstabber: {
    slug: "rashnak_backstabber",
    displayName: "Rashnak Backstabber",
    cost: 130000,
    ma: 7,
    st: 3,
    ag: 3,
    pa: 5,
    av: 8,
    skills: "sidestep,sneaky-git,shadowing,stab,loner-4",
    hirableBy: ["badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Grashnak-Blackhoof.webp",
    specialRule: "Coup dans le Dos : Une fois par match, lorsqu'un joueur adverse se déplace adjacent à Rashnak, il peut effectuer un Coup de Poignard gratuit."
  },

  ripper_bolgrot: {
    slug: "ripper_bolgrot",
    displayName: "Ripper Bolgrot",
    cost: 250000,
    ma: 4,
    st: 6,
    ag: 5,
    pa: 4,
    av: 10,
    skills: "throw-team-mate,grab,regeneration,loner-4",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/ripper_bolgrot.svg",
    specialRule: "Lancer de Caillou : Une fois par match, Ripper peut lancer un rocher sur un joueur adverse à portée, provoquant un jet d'Armure."
  },

  rodney_roachbait: {
    slug: "rodney_roachbait",
    displayName: "Rodney Roachbait",
    cost: 70000,
    ma: 6,
    st: 2,
    ag: 3,
    pa: 4,
    av: 7,
    skills: "catch,diving-catch,jump-up,loner-4,on-the-ball,sidestep,stunty,wrestle",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/rodney_roachbait.svg",
    specialRule: "Attrape-Cafards : Une fois par match, Rodney peut ajouter +1 à un jet de Réception."
  },

  rowana_forestfoot: {
    slug: "rowana_forestfoot",
    displayName: "Rowana ForestFoot",
    cost: 160000,
    ma: 6,
    st: 3,
    ag: 3,
    pa: 4,
    av: 8,
    skills: "horns,dump-off,dodge,guard,jump-up,leap,loner-4",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/rowana_forestfoot.svg",
    specialRule: "Bond Féerique : Une fois par match, Rowana peut traverser les zones de tacle adverses sans effectuer de jet d'Esquive."
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
    skills: "loner-4,dodge,frenzy,jump-up,juggernaut,leap,pirouette",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/roxanna_darknail.svg",
    specialRule: "Pirouette: Une fois par tour, +1 au jet d'esquive."
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
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/rumbelow_sheepskin.svg",
    specialRule: "Bélier : Une fois par match, après un déplacement de Blitz de 3+ cases, Rumbelow peut ajouter +1 à sa Force pour le Blocage."
  },

  scrappa_sorehead: {
    slug: "scrappa_sorehead",
    displayName: "Scrappa Sorehead",
    cost: 130000,
    ma: 7,
    st: 2,
    ag: 3,
    pa: 5,
    av: 8,
    skills: "pogo-stick,dodge,sure-feet,dirty-player-1,stunty,right-stuff,loner-4,sprint",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/scrappa_sorehead.svg",
    specialRule: "Chipe! : Une fois par match, lorsque Scrappa se déplace adjacent à un porteur de ballon adverse, il peut tenter de lui voler le ballon (jet d'Agilité)."
  },

  scyla_anfingrimm: {
    slug: "scyla_anfingrimm",
    displayName: "Scyla Anfingrimm",
    cost: 200000,
    ma: 5,
    st: 5,
    ag: 4,
    pa: null,
    av: 10,
    skills: "claws,frenzy,loner-4,mighty-blow-1,prehensile-tail,thick-skull,wild-animal",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Scyla-Anfingrimm.webp",
    specialRule: "Collier de Bronze de Khorne : Scyla est immunisé contre les effets de Regard Hypnotique et autres capacités magiques."
  },

  skitter_stab_stab: {
    slug: "skitter_stab_stab",
    displayName: "Skitter Stab-Stab",
    cost: 150000,
    ma: 9,
    st: 2,
    ag: 2,
    pa: 4,
    av: 8,
    skills: "dodge,stab,shadowing,prehensile-tail,loner-4",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Skitter-Stab-Stab-blood-bowl-star-player.webp",
    specialRule: "Assassin : Lors d'un Blitz, Skitter peut effectuer une action de Coup de Poignard au lieu d'un Blocage."
  },

  skorg_snowpelt: {
    slug: "skorg_snowpelt",
    displayName: "Skorg Snowpelt",
    cost: 250000,
    ma: 5,
    st: 5,
    ag: 4,
    pa: null,
    av: 9,
    skills: "mighty-blow-1,claws,juggernaut,disturbing-presence,loner-4",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/skorg_snowpelt.svg",
    specialRule: "Rage du Yéti : Une fois par match, Skorg peut ajouter +2 à sa Force pour une action de Blocage."
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
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/skrull_halfheight.svg",
    specialRule: "Jeu de Passe Solide : Une fois par match, Skrull peut ajouter +1 à sa Précision de Passe pour une action de Passe."
  },

  swiftvine_glimmershard: {
    slug: "swiftvine_glimmershard",
    displayName: "Swiftvine Glimmershard",
    cost: 110000,
    ma: 7,
    st: 2,
    ag: 3,
    pa: 5,
    av: 7,
    skills: "sidestep,stunty,fend,stab,disturbing-presence,loner-4",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/swiftvine_glimmershard.svg",
    specialRule: "Piqûre Rapide : Une fois par match, Swiftvine peut ajouter +1 à son Agilité pour un jet d'Esquive."
  },

  thorsson_stoutmead: {
    slug: "thorsson_stoutmead",
    displayName: "Thorsson Stoutmead",
    cost: 170000,
    ma: 6,
    st: 3,
    ag: 4,
    pa: 3,
    av: 8,
    skills: "block,thick-skull,drunkard,loner-4",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/thorsson_stoutmead.svg",
    specialRule: "Coup de Tonneau : Une fois par match, Thorsson peut ajouter +1 à sa Force pour un Blocage, mais doit ensuite tester pour Tête d'Os (Bone Head)."
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
    skills: "loner-4,block,jump-up,mighty-blow-1,thick-skull,crushing-blow",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/varag_ghoul_chewer.svg",
    specialRule: "Mâcheur de Goules : Une fois par match, après un Blocage réussi où la cible de Varag Ghoul-Chewer finit à terre, il peut ajouter +1 au jet d'Armure. Si l'Armure est percée, il peut aussi ajouter +1 au jet de Blessure."
  },

  wilhelm_chaney: {
    slug: "wilhelm_chaney",
    displayName: "Wilhelm Chaney",
    cost: 220000,
    ma: 8,
    st: 4,
    ag: 3,
    pa: 4,
    av: 9,
    skills: "catch,claws,frenzy,loner-4,regeneration,wrestle",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Wilhelm-Chaney.webp",
    specialRule: "Frénésie Lycanthropique : Une fois par match, Wilhelm peut ajouter +1 à sa Force et +1 à son Mouvement pour un tour entier."
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
    skills: "dauntless,loner-4,sidestep,thick-skull",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Willow-Rosebark.webp",
    specialRule: "Écorce Protectrice : Une fois par match, Willow peut ajouter +1 à sa Valeur d'Armure pour un coup reçu."
  },

  withergrasp_doubledrool: {
    slug: "withergrasp_doubledrool",
    displayName: "Withergrasp Doubledrool",
    cost: 170000,
    ma: 6,
    st: 3,
    ag: 4,
    pa: 4,
    av: 9,
    skills: "loner-4,prehensile-tail,tackle,tentacles,two-heads,wrestle,hypnotic-gaze",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/star-player-whitergrasp-doubledrool.webp",
    specialRule: "Bave Paralysante : Les joueurs adverses subissent un modificateur de -1 lorsqu'ils tentent de quitter la zone de tacle de Withergrasp."
  },

  zolcath_the_zoat: {
    slug: "zolcath_the_zoat",
    displayName: "Zolcath the Zoat",
    cost: 230000,
    ma: 5,
    st: 5,
    ag: 4,
    pa: 5,
    av: 10,
    skills: "disturbing-presence,juggernaut,loner-4,mighty-blow-1,prehensile-tail,regeneration,sure-feet",
    hirableBy: ["lustrian_superleague", "elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/zolcath_the_zoat.svg",
    specialRule: "Dévoreur de Sorts : Une fois par match, Zolcath peut annuler un effet spécial ou une carte de Prière à Nuffle ciblant un joueur de son équipe."
  },

  zzharg_madeye: {
    slug: "zzharg_madeye",
    displayName: "Zzharg Madeye",
    cost: 130000,
    ma: 4,
    st: 4,
    ag: 4,
    pa: 3,
    av: 10,
    skills: "nerves-of-steel,hail-mary-pass,loner-4,secret-weapon,cannoneer,sure-hands,thick-skull",
    hirableBy: ["badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Zzharg-Madeye-star-player-blood-bowl.webp",
    specialRule: "Cannoneer : Lorsque Zzharg effectue une Passe, réduisez tout modificateur négatif de 1 (minimum 0)."
  },

};

// Fonction pour cloner un Star Player
const cloneStarPlayer = (source: StarPlayerDefinition): StarPlayerDefinition => ({
  ...source,
  hirableBy: [...source.hirableBy],
});

// Fonction pour cloner tout le mapping de Star Players
const cloneStarPlayersMap = (source: Record<string, StarPlayerDefinition>): Record<string, StarPlayerDefinition> =>
  Object.fromEntries(
    Object.entries(source).map(([slug, player]) => [slug, cloneStarPlayer(player)]),
  );

// ---------------------------------------------------------------------------
// Season 3 Star Player overrides (BB 2020 Season 2 rulebook changes)
// ---------------------------------------------------------------------------

/**
 * S3-specific overrides: only the fields that differ from S2.
 * To add a future S3 change, add an entry here with only the changed fields.
 */
const SEASON_THREE_STAR_PLAYER_OVERRIDES: Record<string, Partial<StarPlayerDefinition>> = {
  // Hakflem Skuttlespike: expanded availability in S3 (BB 2020 S2 rules)
  // Now also available to Sylvanian Spotlight teams (Undead, Necromantic Horror, Vampire)
  hakflem_skuttlespike: {
    hirableBy: ["underworld_challenge", "sylvanian_spotlight"],
  },
};

/**
 * Build the Season 3 star player map from S2 base + S3-specific overrides.
 * This approach avoids duplicating all data while allowing precise S3 changes.
 */
function buildSeasonThreeStarPlayers(): Record<string, StarPlayerDefinition> {
  const base = cloneStarPlayersMap(SEASON_TWO_STAR_PLAYERS);

  for (const [slug, overrides] of Object.entries(SEASON_THREE_STAR_PLAYER_OVERRIDES)) {
    if (base[slug]) {
      base[slug] = {
        ...base[slug],
        ...overrides,
        // Deep-copy hirableBy if overridden to prevent shared references
        hirableBy: overrides.hirableBy
          ? [...overrides.hirableBy]
          : [...base[slug].hirableBy],
      };
    }
  }

  return base;
}

// Export du mapping des Star Players par ruleset
export const STAR_PLAYERS_BY_RULESET: Record<Ruleset, Record<string, StarPlayerDefinition>> = {
  season_2: SEASON_TWO_STAR_PLAYERS,
  season_3: buildSeasonThreeStarPlayers(),
};

// Export de STAR_PLAYERS pour la compatibilité avec le code existant (utilise le ruleset par défaut)
export const STAR_PLAYERS = STAR_PLAYERS_BY_RULESET[DEFAULT_RULESET];

// Appliquer les règles spéciales par défaut pour tous les rulesets
Object.values(STAR_PLAYERS_BY_RULESET).forEach((starPlayersMap) => {
  Object.values(starPlayersMap).forEach((player) => {
    if (!player.specialRule || player.specialRule.trim() === "") {
      player.specialRule = getFallbackSpecialRule(player.displayName);
    }
  });
});

/**
 * Obtenir un Star Player par son slug
 */
export function getStarPlayerBySlug(slug: string, ruleset: Ruleset = DEFAULT_RULESET): StarPlayerDefinition | undefined {
  const starPlayersMap = STAR_PLAYERS_BY_RULESET[ruleset] ?? STAR_PLAYERS_BY_RULESET[DEFAULT_RULESET];
  return starPlayersMap[slug];
}

/**
 * Obtenir tous les Star Players disponibles pour une équipe donnée
 * @param teamRoster - Le roster de l'équipe (ex: "skaven")
 * @param teamRegionalRules - Les règles régionales de l'équipe (ex: ["underworld_challenge"])
 */
export function getAvailableStarPlayers(
  teamRoster: string,
  teamRegionalRules: string[] = [],
  ruleset: Ruleset = DEFAULT_RULESET,
): StarPlayerDefinition[] {
  const starPlayersMap = STAR_PLAYERS_BY_RULESET[ruleset] ?? STAR_PLAYERS_BY_RULESET[DEFAULT_RULESET];
  const rules =
    teamRegionalRules.length > 0
      ? teamRegionalRules
      : getRegionalRulesForTeam(teamRoster, ruleset);
  return Object.values(starPlayersMap).filter(starPlayer => {
    // Si le Star Player est disponible pour tous
    if (starPlayer.hirableBy.includes("all")) {
      return true;
    }

    // Vérifier si l'équipe a une des règles régionales requises
    return starPlayer.hirableBy.some(rule => rules.includes(rule));
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
  slann: ["lustrian_superleague"],
};

const cloneRegionalRules = (
  source: Record<string, string[]>,
): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(source).map(([slug, rules]) => [slug, [...rules]]),
  );

export const TEAM_REGIONAL_RULES_BY_RULESET: Record<
  Ruleset,
  Record<string, string[]>
> = {
  season_2: TEAM_REGIONAL_RULES,
  season_3: cloneRegionalRules(TEAM_REGIONAL_RULES),
};

export function getRegionalRulesForTeam(
  teamRoster: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): string[] {
  const map =
    TEAM_REGIONAL_RULES_BY_RULESET[ruleset] ??
    TEAM_REGIONAL_RULES_BY_RULESET[DEFAULT_RULESET];
  return map[teamRoster] ?? TEAM_REGIONAL_RULES[teamRoster] ?? [];
}

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
