/**
 * Noms anglais (nomenclature officielle GW / Blood Bowl 2020) des positions
 * season_3, indexes par slug.
 *
 * Le `displayName` source est en francais pour season_3 (et deja en anglais
 * pour season_2). Cette table fournit le nom anglais pour les surfaces
 * bilingues (pages position, sous-titre EN, hreflang) sans dupliquer la
 * definition des positions ni necessiter de colonne DB.
 *
 * Couverture **curee et incrementale** : un slug absent retombe cote API sur
 * le nom francais (`getPositionNameEn` renvoie `undefined`). On ne renseigne
 * que les noms dont la traduction officielle est certaine ; les positions
 * exotiques peuvent etre completees ulterieurement.
 */
export const POSITION_NAMES_EN: Readonly<Record<string, string>> = {
  // Old World Alliance
  old_world_alliance_trois_quart_humain: 'Human Lineman',
  old_world_alliance_aspirant_halfling: 'Halfling Hopeful',
  old_world_alliance_trois_quart_nain: 'Dwarf Blocker',
  old_world_alliance_lanceur_humain: 'Human Thrower',
  old_world_alliance_receveur_humain: 'Human Catcher',
  old_world_alliance_coureur_nain: 'Dwarf Runner',
  old_world_alliance_blitzer_humain: 'Human Blitzer',
  old_world_alliance_tueur_de_trolls_nain: 'Troll Slayer',
  old_world_alliance_blitzer_nain: 'Dwarf Blitzer',
  old_world_alliance_homme_arbre: 'Treeman',
  old_world_alliance_ogre: 'Ogre',

  // Amazon
  amazon_guerriere_aigle: 'Eagle Warrior',
  amazon_guerriere_python: 'Python Warrior',
  amazon_guerriere_piranha: 'Piranha Warrior',
  amazon_guerriere_jaguar: 'Jaguar Warrior',

  // Underworld Denizens
  underworld_gobelin_des_bas_fond: 'Underworld Goblin',
  underworld_snotling_des_bas_fond: 'Underworld Snotling',
  underworld_skaven_du_clan_du_rat: 'Skaven Clanrat',
  underworld_lanceur_skaven: 'Skaven Thrower',
  underworld_coureur_d_egout: 'Gutter Runner',
  underworld_blitzer_skaven: 'Skaven Blitzer',
  underworld_troll: 'Troll',
  underworld_rat_ogre: 'Rat Ogre',

  // Dark Elf
  dark_elf_trois_quart_elfe_noir: 'Dark Elf Lineman',
  dark_elf_coureur_elfe_noir: 'Dark Elf Runner',
  dark_elf_assassin_elfe_noir: 'Dark Elf Assassin',
  dark_elf_blitzer_elfe_noir: 'Dark Elf Blitzer',
  dark_elf_furie_elfe_noire: 'Witch Elf',

  // Wood Elf
  wood_elf_trois_quart_elfe_sylvain: 'Wood Elf Lineman',
  wood_elf_lanceur_elfe_sylvain: 'Wood Elf Thrower',
  wood_elf_receveur_elfe_sylvain: 'Wood Elf Catcher',
  wood_elf_danceur_de_guerre: 'Wardancer',
  wood_elf_homme_arbre_de_la_loren: 'Treeman',

  // Chaos Chosen
  chaos_chosen_trois_quart_homme_bete: 'Beastman',
  chaos_chosen_bloqueur_elu: 'Chosen Blocker',
  chaos_chosen_troll_du_chaos: 'Chaos Troll',
  chaos_chosen_ogre_du_chaos: 'Chaos Ogre',
  chaos_chosen_minotaure: 'Minotaur',

  // Gnome
  gnome_trois_quart_gnome: 'Gnome Lineman',
  gnome_gnome_illusioniste: 'Gnome Illusionist',
  gnome_belluaire_gnome: 'Gnome Beastmaster',
  gnome_homme_arbre: 'Treeman',

  // Goblin
  goblin_gobelin: 'Goblin',
  goblin_troll_entraine: 'Trained Troll',
  goblin_cingle: 'Looney',
  goblin_bomba: 'Bombardier',
  goblin_plongeur_de_la_mort: 'Doom Diver',
  goblin_fanatique: 'Fanatic',
  goblin_echassier_a_ressort: 'Pogoer',

  // Halfling
  halfling_aspirant_halfling: 'Halfling Hopeful',
  halfling_receveur_halfling: 'Halfling Catcher',
  halfling_homme_arbre_de_l_altern: 'Treeman',

  // High Elf
  high_elf_trois_quart_haut_elfe: 'High Elf Lineman',

  // Lizardmen
  lizardmen_trois_quart_skink: 'Skink Runner',
  lizardmen_bloqueur_saurus: 'Saurus Blocker',
  lizardmen_skink_cameleon: 'Chameleon Skink',
  lizardmen_kroxigor: 'Kroxigor',

  // Necromantic Horror
  necromantic_horror_trois_quart_zombie: 'Zombie',
  necromantic_horror_coureur_goule: 'Ghoul Runner',
  necromantic_horror_spectre: 'Wraith',
  necromantic_horror_golem_de_chair: 'Flesh Golem',
  necromantic_horror_loup_garou: 'Werewolf',

  // Human
  human_trois_quart: 'Human Lineman',
  human_aspirant_halfling: 'Halfling Hopeful',
  human_lanceur: 'Human Thrower',
  human_receveur: 'Human Catcher',
  human_blitzer: 'Human Blitzer',
  human_ogre: 'Ogre',

  // Khorne
  khorne_khorngor: 'Khorngor',

  // Undead
  undead_trois_quart_squelette: 'Skeleton',
  undead_trois_quart_zombie: 'Zombie',
  undead_coureur_goule: 'Ghoul Runner',
  undead_blitzer_revenant: 'Wight',
  undead_momie: 'Mummy',

  // Chaos Dwarf
  chaos_dwarf_trois_quart_hobgobelin: 'Hobgoblin',
  chaos_dwarf_bloqueur_nain_du_chaos: 'Chaos Dwarf Blocker',
  chaos_dwarf_centaure_taureau: 'Bull Centaur',
  chaos_dwarf_minotaure: 'Minotaur',

  // Dwarf
  dwarf_trois_quart_nain: 'Dwarf Blocker',
  dwarf_coureur_nain: 'Dwarf Runner',
  dwarf_tueur_de_trolls: 'Troll Slayer',
  dwarf_blitzer_nain: 'Dwarf Blitzer',
  dwarf_roule_mort: 'Deathroller',

  // Imperial Nobility
  imperial_nobility_garde_du_corps: 'Bodyguard',
  imperial_nobility_lanceur_imperial: 'Imperial Thrower',
  imperial_nobility_blitzer_noble: 'Noble Blitzer',
  imperial_nobility_ogre: 'Ogre',

  // Norse
  norse_trois_quart: 'Norse Lineman',
  norse_berzerker: 'Berserker',
  norse_valkyrie: 'Valkyrie',
  norse_ulfwerener: 'Ulfwerener',
  norse_yeti: 'Yhetee',

  // Nurgle
  nurgle_trois_quart_putrescent: 'Rotter',
  nurgle_boursouffle: 'Bloater',
  nurgle_pestigor: 'Pestigor',
  nurgle_rejeton_putride: 'Rotspawn',

  // Ogre
  ogre_trois_quart_gnoblar: 'Gnoblar',
  ogre_bloqueur_ogre: 'Ogre',

  // Black Orc
  black_orc_malabar_gobelin: 'Goblin Bruiser',
  black_orc_orque_noir: 'Black Orc',
  black_orc_troll_entraine: 'Trained Troll',

  // Orc
  orc_trois_quart_orque: 'Orc Lineman',
  orc_trois_quart_gobelin: 'Goblin',
  orc_lanceur_orque: 'Orc Thrower',
  orc_blitzer_orque: 'Orc Blitzer',
  orc_bloqueur_kosto: 'Big Un Blocker',
  orc_troll: 'Troll',

  // Chaos Renegade
  chaos_renegade_trois_quart_humain_renegat: 'Renegade Human Lineman',
  chaos_renegade_gobelin_renegat: 'Renegade Goblin',
  chaos_renegade_orque_renegat: 'Renegade Orc',
  chaos_renegade_skaven_renegat: 'Renegade Skaven',
  chaos_renegade_elf_noir_renegat: 'Renegade Dark Elf',
  chaos_renegade_lanceur_humain_renegat: 'Renegade Human Thrower',
  chaos_renegade_troll_renegat: 'Renegade Troll',
  chaos_renegade_ogre_renegat: 'Renegade Ogre',
  chaos_renegade_minotaure_renegat: 'Renegade Minotaur',
  chaos_renegade_rat_ogre_renegat: 'Renegade Rat Ogre',

  // Tomb Kings
  tomb_kings_trois_quart_squelette: 'Skeleton',
  tomb_kings_gardien_des_tombes: 'Tomb Guardian',
  tomb_kings_lanceur_des_rois_des_tombes: 'Thro-Ra',
  tomb_kings_blitzer_des_rois_des_tombes: 'Blitz-Ra',

  // Skaven
  skaven_rat_des_clans_skaven: 'Skaven Clanrat',
  skaven_lanceur_skaven: 'Skaven Thrower',
  skaven_coureur_d_egouts: 'Gutter Runner',
  skaven_blitzer_skaven: 'Skaven Blitzer',
  skaven_rat_ogre: 'Rat Ogre',

  // Slann
  slann_trois_quart: 'Slann Lineman',
  slann_receveur: 'Slann Catcher',
  slann_blitzer: 'Slann Blitzer',
  slann_kroxigor: 'Kroxigor',

  // Snotling
  snotling_trois_quart_snotling: 'Snotling',
  snotling_lance_champis: 'Fungus Flinga',
  snotling_chariot_a_pompe: 'Pump Wagon',
  snotling_troll_entraine: 'Trained Troll',

  // Elven Union
  elven_union_trois_quart_elfe: 'Elf Lineman',
  elven_union_lanceur_elfe: 'Elf Thrower',
  elven_union_receveur_elfe: 'Elf Catcher',
  elven_union_blitzer_elfe: 'Elf Blitzer',

  // Vampire
  vampire_trois_quart_sbire: 'Thrall Lineman',
  vampire_coureur_vampire: 'Vampire Runner',
  vampire_blitzer_vampire: 'Vampire Blitzer',
  vampire_lanceur_vampire: 'Vampire Thrower',
  vampire_vargheist: 'Vargheist',
};

/**
 * Nom anglais officiel d'une position par slug, ou `undefined` si non
 * renseigne (le consommateur retombe alors sur le nom francais).
 */
export function getPositionNameEn(slug: string): string | undefined {
  return POSITION_NAMES_EN[slug];
}
