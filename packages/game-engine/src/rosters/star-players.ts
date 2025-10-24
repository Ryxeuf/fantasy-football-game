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
  imageUrl?: string;      // URL de l'image du joueur
}

/**
 * Liste complète des Star Players disponibles
 */
export const STAR_PLAYERS: Record<string, StarPlayerDefinition> = {
  akhorne_the_squirrel: {
    slug: "akhorne_the_squirrel",
    displayName: "Akhorne The Squirrel",
    cost: 80000,
    ma: 7,
    st: 1,
    ag: 2,
    pa: null,
    av: 6,
    skills: "claws,dauntless,dodge,frenzy,jump-up,loner-4,no-hands,side-step,stunty,microbe.",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp",
    specialRule: "Blind Rage: Peut relancer le D6 pour Intrépide."
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
    skills: "block,grab,loner-4,stand-firm",
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
    skills: "hail-mary-pass,loner-4,pass,secret-weapon,cannoneer,sure-hands,crâne-épais.",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/barik-farblast.webp"
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
    skills: "jouer-déloyal,présence-perturbante,répulsion,loner-4",
    hirableBy: ["all"],
    imageUrl: undefined
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
    skills: "bombardier,présence-perturbante,dodge,loner-3,side-step,sournois,poignard,stunty",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp"
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
    skills: "dodge,side-step,libration-contrôlée,queue-phréhensile,loner-4,regard-hypnotique,<strong>regarde-dans-mes-yeux</strong>",
    hirableBy: ["lustrian_superleague"],
    imageUrl: undefined
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
    skills: "précision,bombardier,dodge,loner-4,stunty,poids-plume,secret-weapon",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Bomber-Dribblesnot.webp"
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
    skills: "tronçonneuse,loner-4,regeneration,secret-weapon,stand-firm,crâne-épais.",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Bryce-The-Slice-Cambuel-2023.webp"
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
    skills: "secret-weapon,bombardier,dodge,stunty,précision,loner-4",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/Cindy_Piewhistle.webp"
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
    skills: "block,loner-4,châtaigne-+2,stand-firm,bras-musclé,thick-skull,lancer-de-coéquipier,timmm–-ber-!",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/deeproot-strongbranch.webp"
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
    skills: "loner-4,dodge,nerfs-d’acier,réception,regard-hypnotique,sur-le-ballon",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Eldril-Sidewinder.webp"
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
    skills: "dodge,&nbsp;garde,side-step,présence-perturbante,loner-4",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/star-player-whitergrasp-doubledrool.webp"
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
    skills: "esquive-en-force,loner-4,châtaigne-+1,regeneration,stand-firm,thick-skull",
    hirableBy: ["old_world_classic", "sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/frank-n-stein.webp"
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
    skills: "arme-secrète,chaînes-et-boulet,golpe-mortifero-+1,stunty,loner-4,no-hands",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp"
  },

  glart_smashrip: {
    slug: "glart_smashrip",
    displayName: "Glart Smashrip",
    cost: 195000,
    ma: 5,
    st: 4,
    ag: 4,
    pa: null,
    av: 9,
    skills: "block,claws,juggernaut,grab,loner-4,stand-firm",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Glart-Smashrip.webp"
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
    skills: "précision,dodge,loner-3,pass,side-step,sure-hands",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: undefined
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
    skills: "châtaigne-+1,thick-skull,frenzy,sauvagerie-animale,prehensile-tail,loner-4,stand-firm",
    hirableBy: ["lustrian_superleague"],
    imageUrl: undefined
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
    skills: "frenzy,cornes,loner-4,châtaigne-+1,<br>crâne-épais,fureur-débridée",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Grashnak-Blackhoof.webp"
  },

  gretchen_wachter_the_blood_bowl_widow: {
    slug: "gretchen_wachter_the_blood_bowl_widow",
    displayName: "Gretchen Wachter “The Blood Bowl Widow”",
    cost: 260000,
    ma: 7,
    st: 3,
    ag: 2,
    pa: null,
    av: 9,
    skills: "présence-perturbante,dodge,répulsion,jump-up,loner-4,sans-les-mains,regeneration,poursuite,side-step",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Skitter-Stab-Stab-blood-bowl-star-player.webp"
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
    skills: "loner-3,block,équilibre,dodge,parade,sprint",
    hirableBy: ["old_world_classic"],
    imageUrl: undefined
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
    skills: "loner-4,block,dauntless,frenzy,blocage-multiple,thick-skull",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/grim-ironjaw-card.webp"
  },

  grombrindal_the_white_dwarf: {
    slug: "grombrindal_the_white_dwarf",
    displayName: "Grombrindal, the White Dwarf",
    cost: 210000,
    ma: 5,
    st: 3,
    ag: 3,
    pa: 4,
    av: 10,
    skills: "block,dauntless,loner-4,châtaigne-+1,stand-firm,thick-skull",
    hirableBy: ["lustrian_superleague", "old_world_classic"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp"
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
    skills: "contagieux,grande-gueule,<strong>morsure-rapide</strong>,répulsion,loner-4",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Guffle-Pussmaw-Star-Player.webp"
  },

  hakflem_skuttlespike: {
    slug: "hakflem_skuttlespike",
    displayName: "Hakflem Skuttlespike",
    cost: 210000,
    ma: 9,
    st: 3,
    ag: 2,
    pa: 3,
    av: 8,
    skills: "loner-4,bras-supplémentaires,two-heads,dodge,queue-phréhensile",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Hakflem-Skuttlespike.webp"
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
    skills: "tronçonneuse,loner-4,secret-weapon,pro,stand-firm",
    hirableBy: ["all"],
    imageUrl: undefined
  },

  hthark_the_unstoppable: {
    slug: "hthark_the_unstoppable",
    displayName: "H’thark the Unstoppable",
    cost: 300000,
    ma: 6,
    st: 6,
    ag: 4,
    pa: 6,
    av: 10,
    skills: "block,thick-skull,défenseur,&nbsp;équilibre,esquive-en-force,juggernaut,sprint,loner-4",
    hirableBy: ["badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp"
  },

  ivan_the_animal_deathshroud: {
    slug: "ivan_the_animal_deathshroud",
    displayName: "Ivan ‘the Animal’ Deathshroud",
    cost: 190000,
    ma: 6,
    st: 4,
    ag: 4,
    pa: 4,
    av: 9,
    skills: "block,juggernaut,présence-perturbante,prise-sûre,regeneration,&nbsp;solitaire-4+,tacle",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: undefined
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
    skills: "block,garde,loner-4,tacle",
    hirableBy: ["old_world_classic"],
    imageUrl: undefined
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
    skills: "block,délestage,dodge,side-step,nerfs-d’acier,pass,réception-plongeante,loner-4,sur-le-ballon",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: undefined
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
    skills: "block,dodge,side-step,réception-plongeante,saut,loner-4",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: undefined
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
    skills: "soif-de-sang-2+,dodge,regard-hypnotique,jump-up,loner-4,regeneration",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: undefined
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
    imageUrl: undefined
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
    skills: "présence-perturbante,répulsion,loner-4,sur-le-ballon,tacle,tentacles",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Kiroth-Krakeneye.webp"
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
    skills: "chaîne-&amp;-boulet,loner-4,châtaigne-+1,sans-les-mains,queue-phréhensile,secret-weapon",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Kreek-Rustgouger.webp"
  },

  lord_borak_the_despoiler: {
    slug: "lord_borak_the_despoiler",
    displayName: "Lord Borak The Despoiler",
    cost: 260000,
    ma: 5,
    st: 5,
    ag: 3,
    pa: 5,
    av: 10,
    skills: "block,châtaigne+1,joueur-déloyal-+2,loner-4,sournois",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Lord-borak.webp"
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
    skills: "block,regard-hypnotique,loner-4,regeneration,glissade-controlée",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: undefined
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
    skills: "bagarreur,châtaigne-+1,thick-skull,grab,loner-4,stand-firm,tentacles",
    hirableBy: ["elven_kingdoms_league", "old_world_classic"],
    imageUrl: undefined
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
    skills: "tronçonneuse,loner-4,secret-weapon",
    hirableBy: ["all"],
    imageUrl: undefined
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
    skills: "loner-4,block,châtaigne-+1",
    hirableBy: ["lustrian_superleague", "old_world_classic"],
    imageUrl: undefined
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
    skills: "block,dauntless,lutte,loner-4,tacle",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: undefined
  },

  morg_n_thorg: {
    slug: "morg_n_thorg",
    displayName: "Morg 'n' Thorg",
    cost: 380000,
    ma: 6,
    st: 6,
    ag: 3,
    pa: 4,
    av: 11,
    skills: "loner-4,block,châtaigne-+2,thick-skull,lancer-de-coéquipier",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Morg-'n-Thorg.webp",
    specialRule: "La Baliste: Une fois par match, si Morg rate le test de Passe quand il effectue une Passe ou un Lancer de Coéquipier, vous pouvez relancer le D6."
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
    skills: "secret-weapon,block,&nbsp;esquive,stunty,loner-4,tronçonneuse",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Nobbla-Blackwart-3rd-Edition.webp"
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
    skills: "&nbsp;esquive,&nbsp;minus,&nbsp;nerfs-d’acier,&nbsp;poids-plume,&nbsp;solitaire-4+",
    hirableBy: ["old_world_classic"],
    imageUrl: "/data/Star-Players_files/Puggy_Baconbreath.webp"
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
    skills: "side-step,sournois,poursuite,poignard,loner-4",
    hirableBy: ["badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Grashnak-Blackhoof.webp"
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
    skills: "lancer-de-coéquipier,&nbsp;projection,&nbsp;régénération,&nbsp;solitaire-4+&nbsp;",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: undefined
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
    skills: "réception,réception-plongeante,jump-up,loner-4,sur-le-ballon,side-step,stunty,lutte,<strong>prise-du-jour</strong>",
    hirableBy: ["all"],
    imageUrl: undefined
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
    skills: "cornes,délestage,dodge,garde,jump-up,saut,loner-4,<strong>bounding-leap</strong>",
    hirableBy: ["all"],
    imageUrl: undefined
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
    skills: "loner-4,dodge,frenzy,jump-up,juggernaut,saut",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: undefined
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
    skills: "block,cornes,juggernaut,loner-4,sans-les-mains,tacle,thick-skull",
    hirableBy: ["old_world_classic"],
    imageUrl: undefined
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
    skills: "échasses-à-ressort,dodge,équilibre,joueur-déloyal-+1,stunty,poids-plume,loner-4,sprint",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: undefined
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
    skills: "claws,frenzy,loner-4,châtaigne-+1,queue-phréhensile,thick-skull,fureur-débridée",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/Scyla-Anfingrimm.webp"
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
    skills: "dodge,poignard,poursuite,prehensile-tail,solitaire4+",
    hirableBy: ["underworld_challenge"],
    imageUrl: "/data/Star-Players_files/Skitter-Stab-Stab-blood-bowl-star-player.webp"
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
    skills: "châtaigne-+1,claws,juggernaut,présence-perturbante,solitaire-4+.",
    hirableBy: ["old_world_classic"],
    imageUrl: undefined
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
    skills: "précision,loner-4,nerfs-d’acier,pass,regeneration,sure-hands,thick-skull",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: undefined
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
    skills: "side-step,stunty,parade,poignard,présence-perturbante,loner-4",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: undefined
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
    skills: "block,thick-skull,poivrot,solitaire-4+.",
    hirableBy: ["old_world_classic"],
    imageUrl: undefined
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
    skills: "loner-4,block,jump-up,châtaigne-+1,crâne-épais.",
    hirableBy: ["underworld_challenge", "badlands_brawl"],
    imageUrl: undefined
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
    skills: "réception,claws,frenzy,loner-4,regeneration,lutte",
    hirableBy: ["sylvanian_spotlight"],
    imageUrl: "/data/Star-Players_files/Wilhelm-Chaney.webp"
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
    skills: "dauntless,loner-4,side-step,crâne-épais.",
    hirableBy: ["elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Willow-Rosebark.webp"
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
    skills: "loner-4,queue-phréhensile,tacle,tentacles,two-heads,lutte,&nbsp;watch-out!",
    hirableBy: ["all"],
    imageUrl: "/data/Star-Players_files/star-player-whitergrasp-doubledrool.webp"
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
    skills: "présence-perturbante,juggernaut,loner-4,châtaigne-+1,queue-phréhensile,regeneration,équilibre",
    hirableBy: ["lustrian_superleague", "elven_kingdoms_league"],
    imageUrl: "/data/Star-Players_files/Fungus-the-Loon.webp"
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
    skills: "nerfs-d’acier,hail-mary-pass,loner-4,secret-weapon,cannoneer,sure-hands,crâne-épais.",
    hirableBy: ["badlands_brawl"],
    imageUrl: "/data/Star-Players_files/Zzharg-Madeye-star-player-blood-bowl.webp"
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
