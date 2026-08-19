/**
 * Système de Star Players de Blood Bowl
 * Les Star Players sont des mercenaires légendaires pouvant être recrutés par plusieurs équipes
 */
import { DEFAULT_RULESET, Ruleset } from "./positions";
import { STAR_PLAYER_KEYWORDS } from "./star-player-keywords";
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
  specialRule?: string;   // Règle spéciale du joueur (français)
  specialRuleEn?: string; // Règle spéciale du joueur (anglais) — P2.9
  imageUrl?: string;      // URL de l'image du joueur
  isMegaStar?: boolean;    // Flag Mega Star
  /**
   * Lot G — recrutement obligatoire en paire : slug du partenaire.
   * Renseigne automatiquement depuis `STAR_PLAYER_PAIR_PARTNERS` (cf. plus
   * bas), comme `keywords` : ne pas le poser a la main dans les definitions.
   */
  pairWith?: string;
  /**
   * Lot G — prix TOTAL de la paire, identique sur les deux fiches.
   * Les cartes GW donnent un prix pour la paire ; le repo le porte sur le
   * primaire (`cost`) et met le partenaire a `cost: 0`, pour que la somme des
   * coûts d'une liste reste juste. `pairCost` porte le prix reel a afficher
   * des deux cotes. Absent ⇒ calcule comme la somme des deux `cost`.
   */
  pairCost?: number;
  /**
   * Mots-clés officiels (lignée + type de joueur), CSV FR — ex: "Humain, Blitzer".
   * Même vocabulaire que les mots-clés de position (`KEYWORDS_SEASON3`).
   * Renseigné automatiquement depuis `STAR_PLAYER_KEYWORDS` (cf. plus bas) :
   * ne pas le poser à la main dans les définitions.
   */
  keywords?: string;
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
    specialRule: "Rage Aveugle : Akhorne peut relancer le D6 de son jet d'Intrépide (Dauntless) une fois par tentative. Une fois par match, il peut également relancer un dé de Blocage perdu lorsqu'il attaque un joueur de Force supérieure.",
    specialRuleEn: "Blind Rage: Akhorne may re-roll the D6 of his Dauntless roll once per attempt. Once per match, he may also re-roll one lost Block die when attacking a player of higher Strength."
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
    specialRule: "Coup Sauvage: Une fois par partie, lorsqu'Anqi effectue une action de Blocage contre un joueur adverse, il peut choisir de relancer n'importe quel nombre de dés de Blocage.",
    specialRuleEn: "Wild Strike: Once per match, when Anqi performs a Block action against an opposing player, she may choose to re-roll any number of Block dice."
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
    specialRule: "Cannoneer : Lorsque Barik effectue une Passe, réduisez tout modificateur négatif de 1 (minimum 0).",
    specialRuleEn: "Cannoneer: When Barik performs a Pass, reduce any negative modifier by 1 (minimum 0)."
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
    specialRule: "Vomi Projectile : Une fois par match, Bilerot peut effectuer une attaque de Vomi Projectile contre un joueur adverse adjacent, provoquant un jet d'Armure.",
    specialRuleEn: "Projectile Vomit: Once per match, Bilerot may make a Projectile Vomit attack against an adjacent opposing player, forcing an Armour roll."
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
    specialRule: "Le Plus Sournois : Une fois par match, si le Black Gobbo est expulsé pour Arme Secrète, lancez un D6 ; sur 4+, il n'est pas expulsé.",
    specialRuleEn: "The Sneakiest: Once per match, if the Black Gobbo is sent off for a Secret Weapon, roll a D6; on a 4+ he is not sent off."
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
    specialRule: "Regard Hypnotique : Boa peut utiliser son Regard Hypnotique pour neutraliser un joueur adverse adjacent, l'empêchant d'utiliser sa zone de tacle.",
    specialRuleEn: "Hypnotic Gaze: Boa may use his Hypnotic Gaze to neutralise an adjacent opposing player, preventing them from using their Tackle Zone."
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
    specialRule: "Kaboom! : Bomber peut lancer des bombes au lieu du ballon. La bombe explose à l'impact, mettant au sol les joueurs dans la case cible.",
    specialRuleEn: "Kaboom!: Bomber may throw bombs instead of the ball. The bomb explodes on impact, knocking down all players in the target square."
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
    specialRule: "Flammes Fantomatiques : Une fois par match, tous les joueurs adverses adjacents à Bryce perdent leur zone de tacle jusqu'à la fin du tour.",
    specialRuleEn: "Phantom Flames: Once per match, all opposing players adjacent to Bryce lose their tackle zones until the end of the turn."
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
    specialRule: "Lanceuse de Tartes : Cindy peut lancer des tartes au lieu du ballon, étourdissant les joueurs touchés.",
    specialRuleEn: "Pie Thrower: Cindy may throw pies instead of the ball, stunning players struck by a successful throw."
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
    specialRule: "Fiable : Un Lancer de Coéquipier raté par Deeproot Strongbranch ne déclenche pas de turnover et la case d'atterrissage dévie d'une seule case au lieu de trois. Cet effet s'applique aussi aux passes ratées qu'il effectue.",
    specialRuleEn: "Reliable: A failed Throw Team-Mate performed by Deeproot Strongbranch does not cause a turnover and the landing square deviates only one square instead of three. This also applies to failed passes he makes."
  },

  // A16 — Dribl & Drull (paire de Skinks, PDF officiel « Star Players! » 2025).
  // Le coût de 230 000 po couvre la paire : porté par Dribl, Drull à 0
  // (même convention que Grak/Crumbleberry). La carte 2025 liste aussi
  // « Quick Foul » sur Dribl, compétence absente du catalogue actuel — omise.
  dribl: {
    slug: "dribl",
    displayName: "Dribl",
    cost: 230000,
    ma: 8,
    st: 2,
    ag: 3,
    pa: 4,
    av: 8,
    skills: "dirty-player-1,dodge,loner-4,sidestep,sneaky-git,stunty",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/dribl.svg",
    specialRule: "Paire Sournoise : Dribl ne se recrute qu'avec Drull. Quand Dribl effectue une Action d'Agression ou une Action Spéciale Poignarder contre un adversaire Marqué à la fois par Dribl et Drull, il peut appliquer un modificateur de +1 au jet.",
    specialRuleEn: "A Sneaky Pair: Dribl can only be hired together with Drull. When Dribl performs a Foul action or a Stab Special Action against an opponent Marked by both Dribl and Drull, he may apply a +1 modifier to the roll."
  },

  drull: {
    slug: "drull",
    displayName: "Drull",
    cost: 0,
    ma: 8,
    st: 2,
    ag: 3,
    pa: 4,
    av: 8,
    skills: "dodge,loner-4,sidestep,stab,stunty",
    hirableBy: ["lustrian_superleague"],
    imageUrl: "/data/Star-Players_files/drull.svg",
    specialRule: "Paire Sournoise : Drull ne se recrute qu'avec Dribl. Quand Drull effectue une Action d'Agression ou une Action Spéciale Poignarder contre un adversaire Marqué à la fois par Drull et Dribl, il peut appliquer un modificateur de +1 au jet.",
    specialRuleEn: "A Sneaky Pair: Drull can only be hired together with Dribl. When Drull performs a Foul action or a Stab Special Action against an opponent Marked by both Drull and Dribl, he may apply a +1 modifier to the roll."
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
    specialRule: "Danse Envoûtante : Une fois par match, après avoir été mis au sol, Eldril peut se relever gratuitement sur un jet de 2+.",
    specialRuleEn: "Enchanting Dance: Once per match, after being knocked down, Eldril may stand up for free on a roll of 2+."
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
    specialRule: "Griffes Venimeuses : Une fois par match, après un Blocage réussi, Estelle peut infliger un jet d'Armure automatique au joueur ciblé.",
    specialRuleEn: "Poisoned Claws: Once per match, after a successful Block, Estelle may inflict an automatic Armour roll on the targeted player."
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
    specialRule: "Fracas Brutal : Une fois par match, Frank peut ajouter +1 au jet d'Armure après un Blocage réussi.",
    specialRuleEn: "Brutal Smash: Once per match, Frank may add +1 to the Armour roll after a successful Block."
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
    specialRule: "Le Fou Furieux : Fungus se déplace aléatoirement avec son Boulet et Chaîne, écrasant tout joueur sur son passage.",
    specialRuleEn: "The Mad Fool: Fungus moves randomly with his Ball and Chain, crushing any player in his path."
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
    specialRule: "Charge Frénétique : Une fois par match, lors d'un Blitz, Glart peut se déplacer de 3 cases supplémentaires.",
    specialRuleEn: "Frenzied Charge: Once per match, during a Blitz action, Glart may move up to 3 additional squares."
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
    specialRule: "Tir à Bout Portant : Une fois par match, après une Passe complétée par Gloriel, le receveur peut se déplacer de 3 cases supplémentaires.",
    specialRuleEn: "Point Blank Shot: Once per match, after a Pass completed by Gloriel, the receiver may move 3 additional squares."
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
    specialRule: "Sauvagerie Primale : Une fois par match, lors d'un Blocage, Glotl peut ajouter +2 à sa Force.",
    specialRuleEn: "Primal Savagery: Once per match, during a Block action, Glotl may add +2 to his Strength."
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
    specialRule: "Encorné par le Taureau : Une fois par match, lors d'un Blitz, Grashnak peut ajouter +2 au jet d'Armure.",
    specialRuleEn: "Gored by the Bull: Once per match, during a Blitz action, Grashnak may add +2 to the Armour roll."
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
    specialRule: "Grak & Crumbleberry : Grak ne se présente jamais sans Crumbleberry et excelle lorsqu'il le propulse sur le terrain.",
    specialRuleEn: "Grak & Crumbleberry: Grak never shows up without Crumbleberry, and he excels when hurling him across the pitch."
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
    specialRule: "Grak & Crumbleberry : Crumbleberry est sanglé au dos de Grak et profite d'un lancer spécial lorsqu'il joue avec lui.",
    specialRuleEn: "Grak & Crumbleberry: Crumbleberry is strapped to Grak's back and benefits from a special Throw Team-Mate when playing alongside him."
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
    specialRule: "Incorporelle : Une fois par match, Gretchen peut traverser les cases occupées par d'autres joueurs durant son déplacement.",
    specialRuleEn: "Incorporeal: Once per match, Gretchen may move through squares occupied by other players during her movement."
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
    specialRuleEn: "Consummate Professional: Once per match, Griff may re-roll any single die.",
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
    specialRule: "Tueur Grudgebearer : Grim Ironjaw peut relancer ses jets d'Intrépide ratés. Une fois par match, lorsqu'il cible un joueur de Force 4 ou plus lors d'un Blocage ou d'un Blitz, il peut ajouter +1 au jet de Blessure si la cible est mise à terre.",
    specialRuleEn: "Grudgebearer Slayer: Grim Ironjaw may re-roll his failed Dauntless rolls. Once per match, when he targets a player of Strength 4 or higher with a Block or Blitz, he may add +1 to the Injury roll if the target is knocked down."
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
    specialRule: "Sagesse du Nain Blanc : Une fois par match, l'équipe de Grombrindal peut utiliser une relance d'équipe gratuite, même si elle n'en a plus.",
    specialRuleEn: "Wisdom of the White Dwarf: Once per match, Grombrindal's team may use a free team re-roll, even if none are remaining."
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
    specialRule: "Bouche Monstrueuse : Guffle peut attraper le ballon avec sa bouche immonde, lui conférant +1 au jet de Réception.",
    specialRuleEn: "Monstrous Maw: Guffle may catch the ball with his foul mouth, granting him +1 on Catch rolls."
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
    specialRule: "Traître : Une fois par match, Hakflem peut effectuer une action de Coup de Poignard gratuite contre un joueur adjacent sans provoquer de turnover.",
    specialRuleEn: "Backstabber: Once per match, Hakflem may perform a free Stab action against an adjacent player without causing a turnover."
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
    specialRule: "Vieux Pro : Une fois par match, si Helmut est expulsé pour Arme Secrète, lancez un D6 ; sur 2+, il peut rester un drive de plus.",
    specialRuleEn: "Old Pro: Once per match, if Helmut is sent off for a Secret Weapon, roll a D6; on a 2+ he may stay for one more drive."
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
    specialRuleEn: "Unstoppable: H'thark can only be knocked down on a Double Skull result on the Block dice.",
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
    specialRuleEn: "Dead and Proud of It: Opponents must subtract 1 from Injury rolls against Ivan.",
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
    specialRule: "Mur de Boucliers : Tant qu'Ivar est debout, les coéquipiers adjacents bénéficient de +1 à leur Valeur d'Armure.",
    specialRuleEn: "Shield Wall: While Ivar is standing, adjacent team-mates gain +1 to their Armour Value."
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
    specialRule: "Le Kata de Kool : Une fois par match, après avoir réceptionné le ballon, Jeremiah peut effectuer un déplacement gratuit de 3 cases.",
    specialRuleEn: "The Kool Kata: Once per match, after catching the ball, Jeremiah may perform a free 3-square move."
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
    specialRule: "Réception du Siècle : Une fois par match, Jordell peut ajouter +1 à un jet de Réception ou d'Interception.",
    specialRuleEn: "Catch of the Century: Once per match, Jordell may add +1 to a Catch or Interception roll."
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
    specialRule: "Charme Vampirique : Une fois par match, Karina peut forcer un joueur adverse adjacent à se déplacer d'une case dans une direction de son choix.",
    specialRuleEn: "Vampiric Charm: Once per match, Karina may force an adjacent opposing player to move one square in a direction of her choice."
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
    specialRule: "Indomptable : Une fois par match, Karla peut ajouter +1 à sa Force pour une action de Blocage ou de Blitz.",
    specialRuleEn: "Unstoppable: Once per match, Karla may add +1 to her Strength for a Block or Blitz action."
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
    specialRule: "Emprise Eldritch : Les joueurs adverses subissent un modificateur de -1 lorsqu'ils tentent d'Esquiver hors de la zone de tacle de Kiroth.",
    specialRuleEn: "Eldritch Grasp: Opposing players suffer a -1 modifier when attempting to Dodge out of Kiroth's tackle zone."
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
    specialRule: "Boulet Rouillé : Kreek se déplace aléatoirement avec son Boulet et Chaîne, broyant tout joueur sur son passage.",
    specialRuleEn: "Rusted Ball: Kreek moves randomly with his Ball and Chain, grinding any player in his path."
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
    specialRule: "Seigneur du Chaos : Tant que Lord Borak est sur le terrain, son équipe reçoit +1 relance d'équipe en début de chaque mi-temps. Si Lord Borak est retiré du jeu (KO, blessure ou mort), la relance bonus en cours est immédiatement perdue.",
    specialRuleEn: "Lord of Chaos: While Lord Borak is on the pitch, his team gains +1 team re-roll at the start of each half. If Lord Borak is removed from play (KO, injury or death), the bonus re-roll in use is immediately lost."
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
    specialRule: "Les Swift Twins : Lucien forme un duo inséparable avec Valen et bénéficie d'un bonus lorsqu'ils jouent ensemble.",
    specialRuleEn: "The Swift Twins: Lucien forms an inseparable duo with Valen and benefits from a bonus when they play together."
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
    specialRule: "Les Swift Twins : Valen joue en tandem avec Lucien et profite d'actions combinées lorsqu'il est aligné avec lui.",
    specialRuleEn: "The Swift Twins: Valen plays in tandem with Lucien and benefits from combined actions when aligned with him."
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
    specialRule: "Seigneur Vampire : Une fois par match, Luthor peut relancer un jet de Soif de Sang (Bloodlust) raté.",
    specialRuleEn: "Vampire Lord: Once per match, Luthor may re-roll a failed Bloodlust roll."
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
    specialRule: "Le Grand Ent : Une fois par match, Maple peut ajouter +1 à sa Force pour une action de Blocage.",
    specialRuleEn: "The Great Ent: Once per match, Maple may add +1 to his Strength for a Block action."
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
    specialRule: "Carnage Maximum : Une fois par match, lors d'une attaque à la Tronçonneuse réussie, Max peut ajouter +1 au jet d'Armure.",
    specialRuleEn: "Maximum Carnage: Once per match, after a successful Chainsaw attack, Max may add +1 to the Armour roll."
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
    specialRule: "Casse-Os : Une fois par match, avant d'effectuer une action de Blocage ou de Blitz, Mighty Zug peut déclarer Casse-Os. Il gagne +1 en Force pour cette seule action, en cumul avec ses autres modificateurs et son skill Mighty Blow.",
    specialRuleEn: "Bone Breaker: Once per match, before performing a Block or Blitz action, Mighty Zug may declare Bone Breaker. He gains +1 Strength for that single action, stacking with his other modifiers and his Mighty Blow skill."
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
    specialRule: "Bravoure Elfique : Une fois par match, Prince Moranion peut se relever gratuitement et effectuer un Blocage sans utiliser d'action de Blitz.",
    specialRuleEn: "Elven Bravery: Once per match, Prince Moranion may stand up for free and perform a Block without using a Blitz action."
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
    specialRuleEn: "The Ballista: Once per match, if Morg fails the Passing test when performing a Pass or a Throw Team-Mate, you may re-roll the D6.",
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
    specialRule: "Frappez-les à Terre : Une fois par match, lors d'une Faute, Nobbla peut ajouter +1 au jet d'Armure.",
    specialRuleEn: "Pound Them Down: Once per match, during a Foul action, Nobbla may add +1 to the Armour roll."
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
    specialRule: "Demi-Portion : Une fois par match, Puggy peut ignorer les zones de tacle adverses lors de son déplacement pour un tour.",
    specialRuleEn: "Pint-Sized: Once per match, Puggy may ignore opposing Tackle Zones during his movement for one turn."
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
    specialRule: "Coup dans le Dos : Une fois par match, lorsqu'un joueur adverse se déplace adjacent à Rashnak, il peut effectuer un Coup de Poignard gratuit.",
    specialRuleEn: "Backstab: Once per match, when an opposing player moves adjacent to Rashnak, he may perform a free Stab action."
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
    specialRule: "Lancer de Caillou : Une fois par match, Ripper peut lancer un rocher sur un joueur adverse à portée, provoquant un jet d'Armure.",
    specialRuleEn: "Rock Thrower: Once per match, Ripper may hurl a boulder at a ranged opposing player, triggering an Armour roll."
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
    specialRule: "Attrape-Cafards : Une fois par match, Rodney peut ajouter +1 à un jet de Réception.",
    specialRuleEn: "Roach Catcher: Once per match, Rodney may add +1 to a single Catch roll."
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
    specialRule: "Bond Féerique : Une fois par match, Rowana peut traverser les zones de tacle adverses sans effectuer de jet d'Esquive.",
    specialRuleEn: "Fey Leap: Once per match, Rowana may cross opposing Tackle Zones without making a Dodge roll."
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
    specialRule: "Pirouette: Une fois par tour, +1 au jet d'esquive.",
    specialRuleEn: "Pirouette: Once per turn, +1 to the Dodge roll."
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
    specialRule: "Bélier : Une fois par match, après un déplacement de Blitz de 3+ cases, Rumbelow peut ajouter +1 à sa Force pour le Blocage.",
    specialRuleEn: "Battering Ram: Once per match, after a Blitz movement of 3 or more squares, Rumbelow may add +1 to his Strength for the Block."
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
    specialRule: "Chipe! : Une fois par match, lorsque Scrappa se déplace adjacent à un porteur de ballon adverse, il peut tenter de lui voler le ballon (jet d'Agilité).",
    specialRuleEn: "Swipe!: Once per match, when Scrappa moves adjacent to an opposing ball carrier, he may attempt to steal the ball (Agility roll)."
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
    specialRule: "Collier de Bronze de Khorne : Scyla est immunisé contre les effets de Regard Hypnotique et autres capacités magiques.",
    specialRuleEn: "Bronze Collar of Khorne: Scyla is immune to Hypnotic Gaze and other magical abilities."
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
    specialRule: "Assassin : Lors d'un Blitz, Skitter peut effectuer une action de Coup de Poignard au lieu d'un Blocage.",
    specialRuleEn: "Assassin: During a Blitz, Skitter may perform a Stab action instead of a Block."
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
    specialRule: "Rage du Yéti : Une fois par match, Skorg peut ajouter +2 à sa Force pour une action de Blocage.",
    specialRuleEn: "Yeti Rage: Once per match, Skorg may add +2 to his Strength for a Block action."
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
    specialRule: "Jeu de Passe Solide : Une fois par match, Skrull peut ajouter +1 à sa Précision de Passe pour une action de Passe.",
    specialRuleEn: "Solid Passing Game: Once per match, Skrull may add +1 to his Passing Ability for one Pass action."
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
    specialRule: "Piqûre Rapide : Une fois par match, Swiftvine peut ajouter +1 à son Agilité pour un jet d'Esquive.",
    specialRuleEn: "Quick Sting: Once per match, Swiftvine may add +1 to her Agility for a Dodge roll."
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
    specialRule: "Coup de Tonneau : Une fois par match, Thorsson peut ajouter +1 à sa Force pour un Blocage, mais doit ensuite tester pour Tête d'Os (Bone Head).",
    specialRuleEn: "Barrel Strike: Once per match, Thorsson may add +1 to his Strength for a Block, but must then test for Bone Head."
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
    specialRule: "Mâcheur de Goules : Une fois par match, après un Blocage réussi où la cible de Varag Ghoul-Chewer finit à terre, il peut ajouter +1 au jet d'Armure. Si l'Armure est percée, il peut aussi ajouter +1 au jet de Blessure.",
    specialRuleEn: "Ghoul Chewer: Once per match, after a successful Block where Varag Ghoul-Chewer's target ends prone, he may add +1 to the Armour roll. If Armour is broken, he may also add +1 to the Injury roll."
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
    specialRule: "Frénésie Lycanthropique : Une fois par match, Wilhelm peut ajouter +1 à sa Force et +1 à son Mouvement pour un tour entier.",
    specialRuleEn: "Lycanthropic Frenzy: Once per match, Wilhelm may add +1 to his Strength and +1 to his Movement for one full turn."
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
    specialRule: "Écorce Protectrice : Une fois par match, Willow peut ajouter +1 à sa Valeur d'Armure pour un coup reçu.",
    specialRuleEn: "Protective Bark: Once per match, Willow may add +1 to her Armour Value for one hit taken."
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
    specialRule: "Bave Paralysante : Les joueurs adverses subissent un modificateur de -1 lorsqu'ils tentent de quitter la zone de tacle de Withergrasp.",
    specialRuleEn: "Paralysing Drool: Opposing players suffer a -1 modifier when attempting to leave Withergrasp's Tackle Zone."
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
    specialRule: "Dévoreur de Sorts : Une fois par match, Zolcath peut annuler un effet spécial ou une carte de Prière à Nuffle ciblant un joueur de son équipe.",
    specialRuleEn: "Spell Devourer: Once per match, Zolcath may cancel a special effect or a Prayer to Nuffle card targeting a player on his team."
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
    specialRule: "Cannoneer : Lorsque Zzharg effectue une Passe, réduisez tout modificateur négatif de 1 (minimum 0).",
    specialRuleEn: "Cannoneer: When Zzharg performs a Pass, reduce any negative modifier by 1 (minimum 0)."
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
 *
 * Provenance des 50 fiches « Legends » : PDF gratuit GW « Blood Bowl — Star
 * Players! (Legends) » (2025), qui regroupe les Star Players absents du livre
 * Third Season Edition. Chaque entrée ci-dessous est alignée carte par carte
 * (coût, MA/ST/AG/PA/AV, compétences par slug, ligues, règle spéciale) et
 * porte en commentaire la page du PDF. La base S2 (BB2020) reste intacte :
 * toute correction « Legends » vit ici, jamais dans SEASON_TWO_STAR_PLAYERS.
 *
 * A16 — les `hirableBy` de ce bloc viennent déjà du même PDF. Hakflem n'a
 * volontairement pas d'override : le PDF 2025 le limite à Underworld
 * Challenge, soit exactement la base S2.
 *
 * Les 19 Star Players du livre de règles (Griff, Morg 'n' Thorg, Varag…) ne
 * figurent PAS dans le PDF Legends et n'ont donc rien à faire ici.
 */
const SEASON_THREE_STAR_PLAYER_OVERRIDES: Record<string, Partial<StarPlayerDefinition>> = {
  // Barik Farblast — carte GW « Star Players! (Legends) » 2025, p.1
  barik_farblast: {
    hirableBy: ["old_world_classic", "worlds_edge_superleague"],
    specialRule: "Bombarde-les ! : À chaque fois que Barik effectue une Passe Désespérée, il peut relancer les résultats de déviation déterminant l'endroit où le ballon atterrit, et tout coéquipier tentant de réceptionner le ballon applique un modificateur de +1 à son jet.",
    specialRuleEn: "Blast It!: Whenever Barik makes a Hail Mary Pass, he may re-roll any Scatter results for determining where the ball lands, and any team-mate attempting to catch the ball applies a +1 modifier to the roll.",
  },
  // Bilerot Vomitflesh — carte GW « Star Players! (Legends) » 2025, p.1
  bilerot_vomitflesh: {
    skills: "dirty-player-1,disturbing-presence,foul-appearance,solitary-aggressor,loner-4,regeneration,instable",
    hirableBy: ["favoured_of_nurgle"],
    specialRule: "Régurgitation Putride : Une fois par mi-temps, Bilerot peut utiliser l'Action Spéciale Vomi Projectile. Il peut le faire même s'il a déjà effectué une Action de Blocage durant ce tour.",
    specialRuleEn: "Putrid Regurgitation: Once per half, Bilerot may use the Projectile Vomit Special Action. This may still be used even if Bilerot has already performed a Block Action this Turn.",
  },
  // Boa Kon'ssstriktr — carte GW « Star Players! (Legends) » 2025, p.2
  boa_konssstriktr: {
    cost: 180000,
    skills: "dodge,fend,hypnotic-gaze,loner-4,prehensile-tail,safe-pair-of-hands,sidestep",
    specialRule: "Regarde-moi dans les Yeux : Une fois par match, si Boa commence son activation en Marquant un joueur adverse en possession du ballon, il peut lancer un D6. Sur 1, rien ne se passe. Sur 2+, le joueur adverse perd la possession du ballon, Boa en prend immédiatement possession et l'activation de Boa prend immédiatement fin.",
    specialRuleEn: "Look Into My Eyes: Once per game, if Boa begins his activation Marking an opposition player in possession of the ball, he may roll a D6. On a 1, nothing happens. On a 2+, the opposition player loses possession of the ball, Boa immediately gains possession of the ball, and Boa's activation immediately ends.",
  },
  // Bomber Dribblesnot — carte GW « Star Players! (Legends) » 2025, p.2
  bomber_dribblesnot: {
    cost: 80000,
    skills: "accurate,bombardier,dodge,loner-4,right-stuff,secret-weapon,stunty",
    specialRule: "Kaboum ! : Une fois par match, si un joueur adverse réceptionne une bombe lancée par Bomber, vous pouvez choisir de la faire exploser immédiatement plutôt que de laisser le joueur adverse tenter de la relancer.",
    specialRuleEn: "Kaboom!: Once per game, if an opposition player catches a bomb thrown by Bomber, you can choose to have it explode rather than the opposition player immediately attempting to throw it again.",
  },
  // Crumbleberry — carte GW « Star Players! (Legends) » 2025, p.5
  crumbleberry: {
    pa: 5,
    skills: "dodge,fatal-flight,loner-4,right-stuff,stunty,sure-hands",
    pairCost: 250000,
    specialRule: "Je te Porte : Grak & Crumbleberry doivent être recrutés ensemble, en paire. De plus, tant que Crumbleberry est porté par Grak, Grak gagne les compétences Esquive en Force et Esquive.",
    specialRuleEn: "I'll Carry You: Grak & Crumbleberry must be hired as a pair. Additionally, whilst Crumbleberry is being carried by Grak, Grak gains the Break Tackle and Dodge Skills.",
  },
  // Deeproot Strongbranch — carte GW « Star Players! (Legends) » 2025, p.3
  deeproot_strongbranch: {
    skills: "block,bullseye,loner-4,mighty-blow-1,stand-firm,strong-arm,thick-skull,throw-team-mate,timmm-ber",
    hirableBy: ["woodland_league"],
    specialRule: "Fiable : Si Deeproot rate son Lancer en effectuant une Action de Lancer d'Équipier, le joueur lancé rebondit normalement mais atterrit automatiquement sans dommage.",
    specialRuleEn: "Reliable: If Deeproot makes a Fumbled Throw when performing a Throw Team-mate Action, the player that was being thrown will Bounce as normal but will automatically land safely.",
  },
  // Dribl — carte GW « Star Players! (Legends) » 2025, p.3
  dribl: {
    skills: "dirty-player-1,dodge,loner-4,lightning-aggression,sidestep,sneaky-git,stunty",
    pairCost: 230000,
    specialRule: "Une Paire Sournoise : Dribl & Drull doivent être recrutés ensemble, en paire. De plus, à chaque fois que Dribl ou Drull effectue une Action d'Agression ou une Action Spéciale Poignarder contre un joueur adverse Marqué à la fois par Dribl et par Drull, ils appliquent un modificateur de +1 au jet.",
    specialRuleEn: "A Sneaky Pair: Dribl & Drull must be hired as a pair. Additionally, whenever Dribl or Drull perform either a Foul Action or a Stab Special Action against an opposition player Marked by both Dribl & Drull, they may apply a +1 modifier to the roll.",
  },
  // Drull — carte GW « Star Players! (Legends) » 2025, p.3
  drull: {
    pairCost: 230000,
    specialRule: "Une Paire Sournoise : Dribl & Drull doivent être recrutés ensemble, en paire. De plus, à chaque fois que Dribl ou Drull effectue une Action d'Agression ou une Action Spéciale Poignarder contre un joueur adverse Marqué à la fois par Dribl et par Drull, ils appliquent un modificateur de +1 au jet.",
    specialRuleEn: "A Sneaky Pair: Dribl & Drull must be hired as a pair. Additionally, whenever Dribl or Drull perform either a Foul Action or a Stab Special Action against an opposition player Marked by both Dribl & Drull, they may apply a +1 modifier to the roll.",
  },
  // Eldril Sidewinder — carte GW « Star Players! (Legends) » 2025, p.3
  eldril_sidewinder: {
    cost: 220000,
    pa: 3,
    specialRule: "Danse Envoûtante : Une fois par mi-temps, Eldril peut relancer le dé lorsqu'il effectue une Action Spéciale Regard Hypnotique.",
    specialRuleEn: "Mesmerising Dance: Once per half, Eldril may re-roll the dice when performing a Hypnotic Gaze Special Action.",
  },
  // Estelle la Veneaux — carte GW « Star Players! (Legends) » 2025, p.4
  estelle_la_veneaux: {
    specialRule: "Maléfice Funeste : Une fois par match, au début de l'activation d'Estelle, elle peut désigner un joueur adverse situé dans un rayon de 5 cases et lancer un D6. Sur 2+, le joueur désigné devient Distrait et ne peut pas être activé pendant le prochain tour de son équipe.",
    specialRuleEn: "Baleful Hex: Once per game, at the beginning of Estelle's activation, she may select an opposition player within 5 squares and roll a D6. On a 2+, the selected player becomes Distracted and cannot be activated during their team's next Turn.",
  },
  // Fungus the Loon — carte GW « Star Players! (Legends) » 2025, p.4
  fungus_the_loon: {
    specialRule: "Derviche Tourneur : Une fois par activation, Fungus peut relancer le D6 déterminant la direction dans laquelle il se déplace.",
    specialRuleEn: "Whirling Dervish: Once per Activation, Fungus may re-roll the D6 when determining which direction he moves in.",
  },
  // Glart Smashrip — carte GW « Star Players! (Legends) » 2025, p.4
  glart_smashrip: {
    cost: 175000,
    ma: 5,
    pa: 6,
    specialRule: "Charge Frénétique : Une fois par mi-temps, lorsque Glart déclare une Action de Blitz, il peut gagner la compétence Frénésie jusqu'à la fin de son activation. Glart ne peut pas utiliser la compétence Projection pendant un tour où il utilise cette règle spéciale.",
    specialRuleEn: "Frenzied Rush: Once per half, when Glart declares a Blitz Action he may gain the Frenzy Skill until the end of his activation. Glart may not use the Grab Skill during a Turn in which he uses this special rule.",
  },
  // Gloriel Summerbloom — carte GW « Star Players! (Legends) » 2025, p.4
  gloriel_summerbloom: {
    skills: "accurate,dodge,loner-3,pass,sidestep,sure-hands",
    specialRule: "Tout ou Rien : Une fois par match, lorsque Gloriel est activée, elle peut utiliser cette règle spéciale. Si elle le fait, Gloriel gagne la compétence Passe Désespérée jusqu'à la fin de son activation.",
    specialRuleEn: "Shot to Nothing: Once per game, when Gloriel is activated she may use this special rule. If she does, Gloriel gains the Hail Mary Pass Skill until the end of her activation.",
  },
  // Glotl Stop — carte GW « Star Players! (Legends) » 2025, p.5
  glotl_stop: {
    cost: 260000,
    pa: 6,
    specialRule: "Sauvagerie Primale : Une fois par match, lorsque Glotl rate un jet de Sauvagerie Animale, il peut s'en prendre à un joueur adverse plutôt qu'à un coéquipier.",
    specialRuleEn: "Primal Savagery: Once per game, when Glotl fails an Animal Savagery roll, it may lash out at an opposition player rather than a team-mate.",
  },
  // Grak — carte GW « Star Players! (Legends) » 2025, p.5
  grak: {
    pa: 4,
    skills: "bone-head,kick-team-mate,loner-4,mighty-blow-1,thick-skull",
    pairCost: 250000,
    specialRule: "Je te Porte : Grak & Crumbleberry doivent être recrutés ensemble, en paire. De plus, une fois par mi-temps, si Grak commence son activation adjacent à Crumbleberry, il peut ramasser Crumbleberry : retirez temporairement Crumbleberry du terrain. À la fin de l'activation de Grak, placez Crumbleberry sur une case libre adjacente à Grak.",
    specialRuleEn: "I'll Carry You: Grak & Crumbleberry must be hired as a pair. Additionally, once per half, if Grak begins his activation adjacent to Crumbleberry he may pick up Crumbleberry; temporarily remove Crumbleberry from the pitch. At the end of Grak's activation, place Crumbleberry in an unoccupied square adjacent to Grak.",
  },
  // Grashnak Blackhoof — carte GW « Star Players! (Legends) » 2025, p.5
  grashnak_blackhoof: {
    pa: 6,
    hirableBy: ["chaos_clash"],
    specialRule: "Encorné par le Taureau : Une fois par match, lorsque Grashnak effectue une Action de Blocage dans le cadre d'une Action de Blitz, il peut lancer un dé de Blocage supplémentaire contre le joueur adverse quelle que soit sa ST, jusqu'à un maximum de trois dés de Blocage. Si Grashnak effectue une seconde Action de Blocage grâce à la compétence Frénésie, cette seconde Action de Blocage bénéficie également de cette règle.",
    specialRuleEn: "Gored by the Bull: Once per game, when Grashnak performs a Block Action as part of a Blitz Action, he may roll one additional Block Dice against the opposition player regardless of their ST, to a maximum of three Block Dice. If Grashnak performs a second Block Action due to the Frenzy Skill, the second Block Action will also benefit from this rule.",
  },
  // Gretchen Wächter — carte GW « Star Players! (Legends) » 2025, p.6
  gretchen_wachter: {
    cost: 180000,
    specialRule: "Incorporelle : Une fois par match, lorsque Gretchen est activée, elle peut utiliser cette règle spéciale. Jusqu'à la fin de son activation, Gretchen n'a pas besoin d'effectuer de jet d'Esquive pour quitter une case située dans la Zone de Tacle d'un joueur adverse.",
    specialRuleEn: "Incorporeal: Once per game, when Gretchen is activated she can use this special rule. Until the end of her activation, Gretchen does not have to make Dodge rolls for leaving a square within an opposition player's Tackle Zone.",
  },
  // Grombrindal — carte GW « Star Players! (Legends) » 2025, p.6
  grombrindal: {
    cost: 170000,
    skills: "block,break-tackle,dauntless,loner-4,mighty-blow-1,stand-firm,sure-feet,thick-skull",
    hirableBy: ["halfling_thimble_cup", "old_world_classic", "worlds_edge_superleague"],
    specialRule: "Sagesse du Nain Blanc : Une fois par match, lorsque Grombrindal est activé, il peut désigner un coéquipier situé dans un rayon de 2 cases. Le coéquipier désigné gagne l'une des compétences suivantes jusqu'à la fin du tour : Esquive en Force, Intrépide, Coup Puissant, Équilibre.",
    specialRuleEn: "Wisdom of the White Dwarf: Once per game, when Grombrindal is activated he may select one team-mate within 2 squares. The selected team-mate gains one of the following Skills until the end of turn: Break Tackle, Dauntless, Mighty Blow, Sure Feet.",
  },
  // Guffle Pusmaw — carte GW « Star Players! (Legends) » 2025, p.6
  guffle_pussmaw: {
    cost: 150000,
    skills: "foul-appearance,loner-4,monstrous-mouth,nerves-of-steel,on-the-ball,plague-ridden",
    hirableBy: ["favoured_of_nurgle"],
    specialRule: "Morsure Rapide : Une fois par match, si Guffle Marque un joueur adverse qui réceptionne le ballon, il peut immédiatement effectuer un jet d'Armure contre ce joueur. Si l'Armure de la cible est percée, Guffle prend immédiatement possession du ballon. L'utilisation de cette règle spéciale ne provoque aucun Turnover.",
    specialRuleEn: "Quick Bite: Once per game, if Guffle is Marking an opposition player who catches the ball, he may immediately make an Armour Roll against that player. If the target's Armour is broken, Guffle immediately gains possession of the ball. No Turnover is caused as a result of using this special rule.",
  },
  // Hakflem Skuttlespike — carte GW « Star Players! (Legends) » 2025, p.6
  hakflem_skuttlespike: {
    cost: 200000,
    ma: 8,
    specialRule: "Traître : Une fois par match, si Hakflem est adjacent à un coéquipier en possession du ballon au moment où il est activé, Hakflem peut choisir de prendre possession du ballon. S'il le fait, le coéquipier est immédiatement Mis à Terre. Cela ne provoque pas de Turnover, même si le coéquipier subit une Blessure.",
    specialRuleEn: "Treacherous: Once per game, if Hakflem is adjacent to a team-mate who is in possession of the ball when he is activated, then Hakflem can choose to gain possession of the ball. If he does, then the team-mate will immediately be Knocked Down. This will not cause a Turnover even if the team-mate suffers a Casualty.",
  },
  // Helmut Wulf — carte GW « Star Players! (Legends) » 2025, p.7
  helmut_wulf: {
    skills: "chainsaw,loner-4,no-hands,pro,secret-weapon,stand-firm",
    hirableBy: ["old_world_classic"],
    specialRule: "Vieux Pro : Une fois par match, Helmut peut utiliser sa compétence Pro pour relancer un seul dé d'un jet d'Armure.",
    specialRuleEn: "Old Pro: Once per game, Helmut may use his Pro Skill to re-roll a single dice rolled as part of an Armour Roll.",
  },
  // H'Thark the Unstoppable — carte GW « Star Players! (Legends) » 2025, p.7
  hthark_the_unstoppable: {
    skills: "block,break-tackle,defensive,juggernaut,loner-4,sprint,sure-feet,thick-skull,instable",
    hirableBy: ["badlands_brawl", "favoured_of_hashut"],
    specialRule: "Élan Irrésistible : À chaque fois que H'Thark effectue une Action de Blocage dans le cadre d'une Action de Blitz, il peut relancer un seul dé de Blocage.",
    specialRuleEn: "Unstoppable Momentum: Whenever H'Thark performs a Block Action as part of a Blitz Action, he may re-roll a single Block Dice.",
  },
  // Ivan 'the Animal' Deathshroud — carte GW « Star Players! (Legends) » 2025, p.7
  ivan_the_animal_deathshroud: {
    cost: 210000,
    pa: 5,
    skills: "block,disturbing-presence,hate-dwarf,juggernaut,loner-4,regeneration,strip-ball,tackle",
    specialRule: "Fléau des Nains : Une fois par match, lorsqu'un joueur adverse est Mis à Terre suite à une Action de Blocage effectuée par Ivan, vous pouvez appliquer un modificateur supplémentaire de +1 au jet d'Armure ou au jet de Blessure. S'il s'agit d'un joueur Nain, ce modificateur peut être de +2 à la place.",
    specialRuleEn: "Dwarven Scourge: Once per game, when an opposition player is Knocked Down as a result of a Block Action performed by Ivan, you may apply an additional +1 modifier to the Armour Roll or Injury roll. If this is against a Dwarf player this may instead be a +2 modifier.",
  },
  // Ivar Eriksson — carte GW « Star Players! (Legends) » 2025, p.7
  ivar_eriksson: {
    cost: 215000,
    specialRule: "Expédition de Pillage : Une fois par drive, lorsqu'Ivar commence son activation, il peut désigner un coéquipier Libre situé dans un rayon de 5 cases. Le joueur désigné peut immédiatement se déplacer d'une case, mais il doit terminer ce déplacement en Marquant un joueur adverse.",
    specialRuleEn: "Raiding Party: Once per Drive, when Ivar begins his activation he may select one Open team-mate within 5 squares. The selected player may immediately move 1 square, though they must end this move Marking an opposition player.",
  },
  // Jordell Freshbreeze — carte GW « Star Players! (Legends) » 2025, p.8
  jordell_freshbreeze: {
    cost: 280000,
    skills: "block,diving-catch,dodge,leap,loner-4,sidestep,surefoot",
    hirableBy: ["elven_kingdoms_league", "woodland_league"],
    specialRule: "Rapide comme la Brise : Une fois par match, Jordell peut choisir de réussir un unique test d'Esquive, de Saut ou de Foncer sur 2+, quels que soient les modificateurs.",
    specialRuleEn: "Swift as the Breeze: Once per game, Jordell can choose to pass a single Dodge, Leap or Rush Test on a 2+, regardless of any modifiers.",
  },
  // Captain Karina von Riesz — carte GW « Star Players! (Legends) » 2025, p.2
  karina_von_riesz: {
    pa: 3,
    skills: "bloodlust-2,dodge,hypnotic-gaze,jump-up,loner-4,regeneration",
    specialRule: "Morceau de Choix : Une fois par match, lorsque Karina rate un jet de Soif de Sang, elle peut choisir de mordre un joueur adverse ayant une ST de 3 ou moins comme s'il s'agissait d'un coéquipier Thrall Trois-Quart. Karina ne peut pas mordre de Star Player avec cette règle spéciale.",
    specialRuleEn: "Tasty Morsel: Once per game, when Karina fails a Bloodlust roll, she may choose to bite an opposition player with a ST of 3 or lower as if they were a Thrall Lineman team-mate. Karina may not bite Star Players with this special rule.",
  },
  // Karla von Kill — carte GW « Star Players! (Legends) » 2025, p.8
  karla_von_kill: {
    pa: 3,
    specialRule: "Indomptable : Une fois par match, lorsque Karla réussit son jet pour utiliser sa compétence Intrépide, elle peut porter sa caractéristique de ST au double de celle de la cible de l'Action de Blocage.",
    specialRuleEn: "Indomitable: Once per game, when Karla successfully rolls to use her Dauntless Skill, she may increase her ST characteristic to double that of the target of the Block Action.",
  },
  // Kiroth Krakeneye — carte GW « Star Players! (Legends) » 2025, p.8
  kiroth_krakeneye: {
    cost: 160000,
    av: 8,
    specialRule: "Encre Noire : Une fois par match, au début de l'une de ses activations, Kiroth peut désigner un joueur adverse qu'il Marque. Le joueur désigné devient Distrait jusqu'à sa prochaine activation.",
    specialRuleEn: "Black Ink: Once per game, at the start of any of his activations, Kiroth can select an opposition player he is Marking. The selected player becomes Distracted until they are next activated.",
  },
  // Kreek Rustgouger — carte GW « Star Players! (Legends) » 2025, p.8
  kreek_rustgouger: {
    cost: 180000,
    ma: 4,
    specialRule: "Je Reviendrai ! : La première fois dans un match où Kreek devrait être expulsé au titre du trait Arme Secrète, il n'est pas expulsé et peut continuer à jouer. L'entraîneur de Kreek ne peut pas Contester la Décision lorsque Kreek utilise cette règle spéciale.",
    specialRuleEn: "I'll Be Back!: The first time in a game that Kreek would be Sent-off as per the Secret Weapon Trait, he is not Sent-off and may instead continue as part of the game. Kreek's coach may not Argue the Call when Kreek uses this special rule.",
  },
  // Lucien Swift — carte GW « Star Players! (Legends) » 2025, p.11
  lucien_swift: {
    cost: 300000,
    st: 3,
    skills: "block,loner-4,mighty-blow-1,tackle",
    pairCost: 300000,
    specialRule: "Jeu en Tandem : Les Jumeaux Swift doivent être recrutés ensemble, en paire. De plus, si Lucien effectue une Action de Blocage contre un joueur adverse également Marqué par Valen, Lucien peut relancer un seul dé de Blocage.",
    specialRuleEn: "Working in Tandem: The Swift Twins must be hired as a pair. Additionally, if Lucien performs a Block Action against an opposition player who is also Marked by Valen, Lucien may re-roll a single Block Dice.",
  },
  // Maple Highgrove — carte GW « Star Players! (Legends) » 2025, p.9
  maple_highgrove: {
    hirableBy: ["woodland_league"],
    specialRule: "Lianes Vicieuses : Une fois par mi-temps, lorsque Maple déclare une Action de Blocage, elle peut le faire contre un joueur adverse situé à 2 cases de distance, en suivant toutes les règles normales d'une Action de Blocage, mais sans pouvoir suivre le mouvement.",
    specialRuleEn: "Vicious Vines: Once per half, when Maple declares a Block Action he may do so against an opposition player who is 2 squares away following all the normal rules for performing a Block Action, though he may not follow-up.",
  },
  // Max Spleenripper — carte GW « Star Players! (Legends) » 2025, p.9
  max_spleenripper: {
    skills: "chainsaw,loner-4,no-hands,secret-weapon",
    hirableBy: ["favoured_of_khorne"],
    specialRule: "Carnage Maximum : Une fois par match, après que Max a effectué une Action Spéciale Attaque de Tronçonneuse, il peut immédiatement effectuer une autre Action Spéciale Attaque de Tronçonneuse ciblant un joueur adverse différent.",
    specialRuleEn: "Maximum Carnage: Once per game, after Max performs a Chainsaw Attack Special Action he may immediately perform another Chainsaw Attack Special Action that targets a different opposition player.",
  },
  // The Mighty Zug — carte GW « Star Players! (Legends) » 2025, p.9
  mighty_zug: {
    ma: 5,
    skills: "block,loner-4,mighty-blow-1,instable",
    hirableBy: ["old_world_classic", "worlds_edge_superleague"],
    specialRule: "Coup Écrasant : Une fois par match, lorsqu'un joueur adverse est Mis à Terre suite à une Action de Blocage effectuée par Zug, vous pouvez appliquer un modificateur supplémentaire de +1 au jet d'Armure. Ce modificateur peut être appliqué après que le jet d'Armure a été effectué.",
    specialRuleEn: "Crushing Blow: Once per game, when an opposition player is Knocked Down as the result of a Block Action performed by Zug, you may apply an additional +1 modifier to the Armour Roll. This modifier may be applied after the Armour Roll has been made.",
  },
  // Nobbla Blackwart — carte GW « Star Players! (Legends) » 2025, p.9
  nobbla_blackwart: {
    skills: "block,chainsaw,dodge,loner-4,no-hands,saboteur,secret-weapon,stunty",
    specialRule: "Frappez-les à Terre ! : Une fois par match, Nobbla peut utiliser l'Action Spéciale Attaque de Tronçonneuse contre un joueur adverse À Terre ou Sonné. Cela ne compte pas comme une Action d'Agression et Nobbla ne peut donc pas être expulsé en utilisant cette règle spéciale.",
    specialRuleEn: "Kick 'em While They're Down!: Once per game, Nobbla may use the Chainsaw Attack Special Action against a Prone or Stunned opposition player. This does not count as a Foul Action and so Nobbla cannot be Sent-off when using this special rule.",
  },
  // Rashnak Backstabber — carte GW « Star Players! (Legends) » 2025, p.10
  rashnak_backstabber: {
    specialRule: "Connaisseur en Toxines : Une fois par match, lorsque Rashnak perce l'armure d'un joueur adverse suite à une Action Spéciale Poignarder, vous pouvez appliquer un modificateur supplémentaire de +1 au jet de Blessure. Ce modificateur peut être appliqué après que le jet a été effectué.",
    specialRuleEn: "Toxin Connoisseur: Once per game, when Rashnak successfully breaks an opposition player's armour as a result of a Stab Special Action, you may apply an additional +1 modifier to the Injury Roll. This modifier may be applied after the roll has been made.",
  },
  // Rowana Forestfoot — carte GW « Star Players! (Legends) » 2025, p.10
  rowana_forestfoot: {
    hirableBy: ["woodland_league"],
    specialRule: "Bond Prodigieux : Une fois par match, après avoir déclaré qu'elle va Sauter mais avant de lancer le moindre dé, Rowana peut choisir d'utiliser cette règle spéciale. Si elle le fait, Rowana ne subit aucun modificateur négatif au Test d'Agilité pour Sauter et peut choisir de relancer le résultat.",
    specialRuleEn: "Bounding Leap: Once per game, after declaring that she will Leap but before rolling any dice, Rowana may choose to use this special rule. If she does, Rowana suffers no negative modifiers for the Agility Test to Leap and may choose to re-roll the result.",
  },
  // Roxanna Darknail — carte GW « Star Players! (Legends) » 2025, p.10
  roxanna_darknail: {
    pa: 3,
    skills: "dodge,frenzy,jump-up,juggernaut,leap,loner-4",
    specialRule: "Griffes Lacérantes : Une fois par mi-temps, lorsque Roxanna déclare une Action de Blitz, elle gagne la compétence Griffes jusqu'à la fin de son activation.",
    specialRuleEn: "Slashing Nails: Once per half, when Roxanna declares a Blitz Action, she gains the Claws Skill until the end of her activation.",
  },
  // Scrappa Sorehead — carte GW « Star Players! (Legends) » 2025, p.10
  scrappa_sorehead: {
    cost: 120000,
    pa: 4,
    specialRule: "Chipé ! : Une fois par match, lorsque Scrappa tente d'Intercepter une Action de Passe, il peut lancer un D6. Sur 2+, Scrappa n'a pas besoin de faire de jet pour Intercepter : il Intercepte automatiquement l'Action de Passe et prend le contrôle du ballon.",
    specialRuleEn: "Yoink!: Once per game, when Scrappa attempts to Intercept a Pass Action he may roll a D6. On a 2+, Scrappa doesn't need to roll to Intercept; instead, he will automatically Intercept the Pass Action and gains control of the ball.",
  },
  // Scyla Anfingrimm — carte GW « Star Players! (Legends) » 2025, p.11
  scyla_anfingrimm: {
    pa: 6,
    hirableBy: ["favoured_of_khorne"],
    specialRule: "Fureur du Dieu du Sang : Une fois par match, si Scyla obtient un 1 à son jet de Fureur Débridée après avoir déclaré une Action de Blocage, alors, au lieu d'appliquer les effets habituels de Fureur Débridée, Scyla peut effectuer deux Actions de Blocage. La première Action de Blocage doit être entièrement résolue, y compris l'utilisation de la compétence Frénésie, avant que la seconde ne soit effectuée.",
    specialRuleEn: "Fury of the Blood God: Once per game, if Scyla rolls a 1 for his Unchannelled Fury roll after declaring a Block Action then, instead of applying the usual effects of Unchannelled Fury, Scyla may perform two Block Actions instead. The first Block Action must be fully resolved, including the use of the Frenzy Skill, before the second one is performed.",
  },
  // Skrorg Snowpelt — carte GW « Star Players! (Legends) » 2025, p.11
  skorg_snowpelt: {
    cost: 240000,
    pa: 6,
    skills: "block,claws,disturbing-presence,juggernaut,loner-4,mighty-blow-1",
    hirableBy: ["old_world_classic", "worlds_edge_superleague"],
    specialRule: "Chauffer la Foule : Une fois par match, lorsque Skrorg provoque la sortie d'un joueur adverse sur Blessure suite à une Action de Blocage, l'entraîneur de Skrorg gagne une Relance d'Équipe jusqu'à la fin du drive en cours. Si cette Relance d'Équipe n'a pas été utilisée à la fin du drive, elle est perdue.",
    specialRuleEn: "Pump Up the Crowd: Once per game, when Skrorg causes an opposition player to be removed as a Casualty as the result of a Block Action, Skrorg's controlling coach gains one Team Re-roll until the end of the current Drive. If this Team Re-roll has not been used by the end of the Drive, it is lost.",
  },
  // Skrull Halfheight — carte GW « Star Players! (Legends) » 2025, p.11
  skrull_halfheight: {
    pa: 3,
    hirableBy: ["sylvanian_spotlight", "worlds_edge_superleague"],
    specialRule: "Jeu de Passe Puissant : Une fois par match, lorsque Skrull effectue une Action de Passe, il peut modifier le résultat du Test de Capacité de Passe de la valeur de sa caractéristique de ST, jusqu'à un maximum de 6.",
    specialRuleEn: "Strong Passing Game: Once per game, when Skrull performs a Pass Action he may modify the result of the Passing Ability Test by the value of his ST characteristic, to a maximum of 6.",
  },
  // Swiftvine Glimmershard — carte GW « Star Players! (Legends) » 2025, p.12
  swiftvine_glimmershard: {
    hirableBy: ["woodland_league"],
    specialRule: "Accès de Fureur : Une fois par mi-temps, tant qu'elle est Debout au début de son activation, Swiftvine peut se placer adjacente à un joueur adverse Debout situé dans un rayon de 3 cases et effectuer immédiatement une Action Spéciale Poignarder contre lui. Elle peut ensuite se placer sur une case libre située dans un rayon de 3 cases de sa nouvelle position. Son activation prend alors immédiatement fin. Cela compte comme l'Action de Blitz de l'équipe pour ce tour.",
    specialRuleEn: "Furious Outburst: Once per half, so long as she is Standing at the start of her activation, Swiftvine can place herself adjacent to a Standing opposition player within 3 squares of her and immediately make a Stab Special Action against them. She may then place herself in an unoccupied square within 3 squares of her new position. Her activation then immediately ends. This counts as the team's Blitz Action for the turn.",
  },
  // The Black Gobbo — carte GW « Star Players! (Legends) » 2025, p.2
  the_black_gobbo: {
    cost: 210000,
    av: 8,
    skills: "bombardier,disturbing-presence,dodge,loner-3,sidestep,sneaky-git,stab,stunty",
    specialRule: "Le Plus Fourbe de Tous : Si votre équipe compte le Black Gobbo, vous pouvez déclarer deux Actions d'Agression par tour au lieu d'une seule. Cependant, l'une de ces Actions d'Agression doit être déclarée par le Black Gobbo lui-même.",
    specialRuleEn: "Sneakiest of the Lot: If your team includes the Black Gobbo, then you may declare two Foul Actions per Turn rather than the usual one. However, one of these Foul Actions must be declared by the Black Gobbo himself.",
  },
  // Thorsson Stoutmead — carte GW « Star Players! (Legends) » 2025, p.12
  thorsson_stoutmead: {
    hirableBy: ["old_world_classic", "worlds_edge_superleague"],
    specialRule: "Coup de Tonneau : Une fois par drive, au début de son activation, Thorsson peut désigner un joueur adverse situé dans un rayon de trois cases et lancer un D6. Sur 3+, le joueur désigné est immédiatement Mis à Terre. Sur 2, rien ne se passe. Sur 1, Thorsson Tombe. Après avoir utilisé cette règle spéciale, l'activation de Thorsson prend immédiatement fin.",
    specialRuleEn: "Beer Barrel Bash: Once per Drive, at the start of his activation, Thorsson may select an opposition player within three squares and roll a D6. On a 3+, the selected player is immediately Knocked Down. On a 2, nothing happens. On a 1, Thorsson Falls Over. After using this special rule, Thorsson's activation immediately ends.",
  },
  // Valen Swift — carte GW « Star Players! (Legends) » 2025, p.12
  valen_swift: {
    cost: 0,
    ma: 7,
    pa: 2,
    av: 9,
    skills: "accurate,loner-4,nerves-of-steel,pass,safe-pass,sure-hands",
    pairCost: 300000,
    specialRule: "Jeu en Tandem : Les Jumeaux Swift doivent être recrutés ensemble, en paire. De plus, si Valen effectue une Action de Passe ciblant une case contenant Lucien, Valen ne subit aucun modificateur au Test de PA lié à la portée de l'Action de Passe.",
    specialRuleEn: "Working in Tandem: The Swift Twins must be hired as a pair. Additionally, if Valen performs a Pass Action that targets a square containing Lucien, then Valen suffers no modifiers to the PA Test for the range of the Pass Action.",
  },
  // Wilhelm Chaney — carte GW « Star Players! (Legends) » 2025, p.12
  wilhelm_chaney: {
    specialRule: "Mise en Pièces : Une fois par match, lorsque Wilhelm effectue un jet de Blessure contre un joueur adverse, il peut choisir de relancer le résultat.",
    specialRuleEn: "Savage Mauling: Once per game, when Wilhelm makes an Injury Roll against an opposition player, he may choose to re-roll the result.",
  },
  // Willow Rosebark — carte GW « Star Players! (Legends) » 2025, p.13
  willow_rosebark: {
    cost: 160000,
    ma: 6,
    pa: 5,
    hirableBy: ["woodland_league"],
    specialRule: "Fureur Sylvestre : Une fois par match, lorsque Willow effectue une Action de Blocage dont le résultat la ferait Mise à Terre, elle peut choisir de relancer un seul dé de Blocage.",
    specialRuleEn: "Woodland Fury: Once per game, when Willow performs a Block Action that would result in her being Knocked Down, she can choose to re-roll a single Block Dice.",
  },
  // Withergrasp Doubledrool — carte GW « Star Players! (Legends) » 2025, p.13
  withergrasp_doubledrool: {
    ag: 3,
    skills: "foul-appearance,loner-4,prehensile-tail,tackle,tentacles,two-heads,wrestle",
    hirableBy: ["favoured_of_nurgle"],
    specialRule: "Attention ! : La première fois à chaque drive où Withergrasp est la cible d'une Action de Blocage effectuée par un joueur adverse, il est considéré comme possédant la compétence Esquive.",
    specialRuleEn: "Watch Out!: The first time each Drive that Withergrasp is the target of a Block Action performed by an opposition player, he counts as having the Dodge Skill.",
  },
  // Zolcath the Zoat — carte GW « Star Players! (Legends) » 2025, p.13
  zolcath_the_zoat: {
    cost: 220000,
    specialRule: "« Pardon, vous êtes un Zoat ? » : Une fois par match, lorsque Zolcath est activé, il peut désigner un joueur adverse situé dans un rayon de 3 cases. Le joueur désigné devient immédiatement Distrait.",
    specialRuleEn: "“Excuse me, are you a Zoat?”: Once per game, when Zolcath is activated he may select an opposition player within 3 squares. The selected player immediately becomes Distracted.",
  },
  // Zzharg Madeye — carte GW « Star Players! (Legends) » 2025, p.13
  zzharg_madeye: {
    skills: "cannoneer,hail-mary-pass,loner-4,nerves-of-steel,secret-weapon,thick-skull",
    hirableBy: ["favoured_of_hashut"],
    specialRule: "« La Poudre Résout Tout » : Une fois par mi-temps, au début de son activation, Zzharg peut désigner un joueur adverse Debout situé dans un rayon de 3 cases et lancer un D6. Sur 3+, le joueur désigné est touché. Sur 2, l'entraîneur adverse choisit à la place un joueur (de l'une ou l'autre équipe, mais pas Zzharg) situé dans un rayon de 3 cases du joueur initialement désigné. Sur 1, c'est Zzharg qui est touché. Effectuez un jet d'Armure pour le joueur touché. L'activation de Zzharg prend alors immédiatement fin.",
    specialRuleEn: "“Blastin' Solves Everything”: Once per half, at the start of his activation, Zzharg may select a Standing opposition player within 3 squares and roll a D6. On a 3+, the selected player is hit. On a 2, the opposing coach selects a player (from either team, but not Zzharg) within 3 squares of the originally selected player to be hit instead. On a 1, Zzharg is hit instead. Make an Armour Roll for whichever player is hit. Zzharg's activation then immediately ends.",
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

/**
 * Lot G — paires obligatoires (« must be hired as a pair »). La RELATION est
 * une constante du livre de règles, identique en S2 et en S3 : elle vit donc
 * ici, hors des maps par ruleset, et est appliquée aux deux (comme les
 * mots-clés). Seul le PRIX de la paire dépend du ruleset et se corrige via
 * `pairCost` dans les overrides S3.
 *
 * Avant ce lot, trois tables de paires vivaient en dur dans trois fichiers
 * différents — dont une qui ignorait Dribl & Drull.
 */
export const STAR_PLAYER_PAIR_PARTNERS: Record<string, string> = {
  grak: "crumbleberry",
  crumbleberry: "grak",
  dribl: "drull",
  drull: "dribl",
  lucien_swift: "valen_swift",
  valen_swift: "lucien_swift",
};

// Appliquer les règles spéciales par défaut + les mots-clés pour tous les rulesets
Object.values(STAR_PLAYERS_BY_RULESET).forEach((starPlayersMap) => {
  Object.values(starPlayersMap).forEach((player) => {
    if (!player.specialRule || player.specialRule.trim() === "") {
      player.specialRule = getFallbackSpecialRule(player.displayName);
    }
    // Mots-clés (lignée + type) : source unique `star-player-keywords.ts`,
    // identique pour les deux rulesets (la lignée d'un mercenaire ne change
    // pas d'une saison à l'autre). Slug inconnu ⇒ champ laissé `undefined`.
    const keywords = STAR_PLAYER_KEYWORDS[player.slug];
    if (keywords) {
      player.keywords = keywords;
    }
    // Paires obligatoires : même table pour les deux rulesets (cf. supra).
    const partner = STAR_PLAYER_PAIR_PARTNERS[player.slug];
    if (partner) {
      player.pairWith = partner;
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

  // Dédup par slug : un Star Player éligible par PLUSIEURS critères
  // (ex. "all" + une règle régionale, ou plusieurs règles régionales qui
  // matchent l'équipe) ne doit apparaître qu'une seule fois. Source de
  // vérité : la route serveur (Prisma `OR` sur hirableBy) reflète cette
  // logique et peut sinon remonter des doublons.
  const seen = new Set<string>();
  const available: StarPlayerDefinition[] = [];
  for (const starPlayer of Object.values(starPlayersMap)) {
    const isHirable =
      // Si le Star Player est disponible pour tous
      starPlayer.hirableBy.includes("all") ||
      // ou si l'équipe a une des règles régionales requises
      starPlayer.hirableBy.some((rule) => rules.includes(rule));
    if (!isHirable) continue;
    if (seen.has(starPlayer.slug)) continue;
    seen.add(starPlayer.slug);
    available.push(starPlayer);
  }
  return available;
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

/**
 * A16 — Ajustements S3 (Blood Bowl 2025) du mapping équipes → règles
 * régionales, nécessaires pour les « Plays for » du PDF officiel 2025 :
 * - `woodland_league` (nouvelle ligue) : Elfes Sylvains, Halflings, Gnomes.
 * - `chaos_clash` (nouvelle ligue chaotique) : équipes du Chaos.
 * - `favoured_of` générique éclaté en `favoured_of_nurgle` /
 *   `favoured_of_khorne` / `favoured_of_hashut` (les stars 2025 sont
 *   liées à un dieu précis).
 * Limites du modèle : le choix de dieu des Élus/Renégats du Chaos
 * (« Favoured of… » au choix à la création) n'est pas stocké par équipe,
 * on ne leur donne donc que `chaos_clash` ; les Nordiques sont mappés sur
 * `favoured_of_khorne` (spécialisation de l'ancien `favoured_of` générique).
 */
const SEASON_THREE_TEAM_REGIONAL_RULES_OVERRIDES: Record<string, string[]> = {
  wood_elf: ["elven_kingdoms_league", "woodland_league"],
  halfling: ["halfling_thimble_cup", "old_world_classic", "woodland_league"],
  gnome: ["halfling_thimble_cup", "woodland_league"],
  nurgle: ["favoured_of_nurgle", "chaos_clash"],
  khorne: ["favoured_of_khorne", "chaos_clash"],
  chaos_dwarf: ["badlands_brawl", "worlds_edge_superleague", "favoured_of_hashut", "chaos_clash"],
  chaos_chosen: ["chaos_clash"],
  chaos_renegade: ["chaos_clash"],
  norse: ["old_world_classic", "favoured_of_khorne"],
  bretonnian: ["old_world_classic"],
};

function buildSeasonThreeTeamRegionalRules(): Record<string, string[]> {
  const base = cloneRegionalRules(TEAM_REGIONAL_RULES);
  for (const [team, rules] of Object.entries(
    SEASON_THREE_TEAM_REGIONAL_RULES_OVERRIDES,
  )) {
    base[team] = [...rules];
  }
  return base;
}

export const TEAM_REGIONAL_RULES_BY_RULESET: Record<
  Ruleset,
  Record<string, string[]>
> = {
  season_2: TEAM_REGIONAL_RULES,
  season_3: buildSeasonThreeTeamRegionalRules(),
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
 * Lot G — description d'une paire obligatoire de Star Players.
 * Les deux fiches partagent le même `pairCost` (prix de la paire).
 */
export interface StarPlayerPair {
  /** Slug du partenaire obligatoire. */
  readonly partnerSlug: string;
  /** Nom d'affichage du partenaire (repli sur le slug s'il est inconnu). */
  readonly partnerName: string;
  /** Prix TOTAL de la paire, en po. */
  readonly pairCost: number;
}

/**
 * Renvoie la paire obligatoire d'un Star Player, ou `null` s'il se recrute
 * seul. Source unique pour la validation serveur ET l'affichage : avant ce
 * lot, trois tables de paires vivaient en dur dans trois fichiers différents
 * (dont une qui ignorait Dribl & Drull, et un libellé « Gratuit (avec Grak) »
 * affiché sur TOUS les partenaires — Drull compris, alors qu'il s'associe à
 * Dribl).
 */
export function getStarPlayerPair(
  slug: string,
  ruleset: Ruleset = DEFAULT_RULESET,
): StarPlayerPair | null {
  const map =
    STAR_PLAYERS_BY_RULESET[ruleset] ?? STAR_PLAYERS_BY_RULESET[DEFAULT_RULESET];
  const player = map[slug];
  if (!player?.pairWith) return null;
  const partner = map[player.pairWith];
  return {
    partnerSlug: player.pairWith,
    partnerName: partner?.displayName ?? player.pairWith,
    pairCost: player.pairCost ?? player.cost + (partner?.cost ?? 0),
  };
}

/**
 * Toutes les paires obligatoires d'un ruleset, indexées par slug (les deux
 * membres sont présents).
 */
export function getStarPlayerPairs(
  ruleset: Ruleset = DEFAULT_RULESET,
): Record<string, StarPlayerPair> {
  const map =
    STAR_PLAYERS_BY_RULESET[ruleset] ?? STAR_PLAYERS_BY_RULESET[DEFAULT_RULESET];
  const out: Record<string, StarPlayerPair> = {};
  for (const slug of Object.keys(map)) {
    const pair = getStarPlayerPair(slug, ruleset);
    if (pair) out[slug] = pair;
  }
  return out;
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
  | "favoured_of"
  // A16 — règles régionales introduites par Blood Bowl 2025 (S3)
  | "woodland_league"
  | "chaos_clash"
  | "favoured_of_nurgle"
  | "favoured_of_khorne"
  | "favoured_of_hashut";
