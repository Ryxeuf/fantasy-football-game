/**
 * Mots-clés par Star Player — Blood Bowl 2025 (Season 3).
 *
 * Comme les positionnels (cf. `keywords-season3.ts`), chaque Star Player porte
 * des mots-clés décrivant sa **lignée/race** puis son **type de joueur**
 * (ex: « Humain, Blitzer », « Ogre, Gros Bras »). On réutilise strictement le
 * même vocabulaire FR que les positions pour que les deux surfaces (chips,
 * filtres, traduction EN) restent homogènes.
 *
 * ⚠️ Provenance : contrairement à `keywords-season3.ts` (généré depuis
 * `data/positionnels-bloodbowl-2025.md`), il n'existe pas de source markdown
 * pour les Star Players dans le repo. Cette table est donc **curée à la main**
 * à partir de la fiche de chaque star (lignée décrite par son lore / son
 * illustration / sa règle spéciale, type déduit de son profil et de ses
 * compétences). Elle doit être confrontée au PDF officiel GW « Star Players! »
 * (Blood Bowl Third Season Edition) à la première occasion — toute correction
 * se fait ici, sans autre changement de code.
 *
 * Format : slug star player -> CSV de mots-clés (« Lignée, Type »).
 */

/** Lignées autorisées (mêmes libellés que les mots-clés de position). */
export const STAR_PLAYER_LINEAGE_KEYWORDS = [
  'Amalgame',
  'Animal',
  'Elfe',
  'Gnome',
  'Gobelin',
  'Halfling',
  'Homme-Arbre',
  'Homme-Lézard',
  'Homme-bête',
  'Humain',
  'Loup-Garou',
  'Minotaure',
  'Mort-Vivant',
  'Nain',
  'Ogre',
  'Orque',
  'Rejeton',
  'Skaven',
  'Skink',
  'Spectre',
  'Troll',
  'Vampire',
  'Yeti',
  'Zoat',
] as const;

/** Types de joueur autorisés (mêmes libellés que les mots-clés de position). */
export const STAR_PLAYER_ROLE_KEYWORDS = [
  'Blitzer',
  'Bloqueur',
  'Coureur',
  'Gros Bras',
  'Lanceur',
  'Receveur',
  'Spécial',
  'Trois-quart',
] as const;

export const STAR_PLAYER_KEYWORDS: Record<string, string> = {
  akhorne_the_squirrel: 'Animal, Spécial',
  anqi_panqi: 'Homme-Lézard, Bloqueur',
  barik_farblast: 'Nain, Lanceur',
  bilerot_vomitflesh: 'Humain, Gros Bras',
  the_black_gobbo: 'Gobelin, Spécial',
  boa_konssstriktr: 'Homme-Lézard, Spécial',
  bomber_dribblesnot: 'Gobelin, Spécial',
  bryce_the_slice_cambuel: 'Humain, Mort-Vivant, Spécial',
  cindy_piewhistle: 'Halfling, Spécial',
  deeproot_strongbranch: 'Homme-Arbre, Gros Bras',
  dribl: 'Skink, Spécial',
  drull: 'Skink, Spécial',
  eldril_sidewinder: 'Elfe, Receveur',
  estelle_la_veneaux: 'Humain, Bloqueur',
  frank_n_stein: 'Amalgame, Mort-Vivant, Bloqueur',
  fungus_the_loon: 'Gobelin, Spécial',
  glart_smashrip: 'Skaven, Blitzer',
  gloriel_summerbloom: 'Elfe, Lanceur',
  glotl_stop: 'Homme-Lézard, Gros Bras',
  grashnak_blackhoof: 'Minotaure, Gros Bras',
  grak: 'Ogre, Gros Bras',
  crumbleberry: 'Halfling, Trois-quart',
  gretchen_wachter: 'Spectre, Mort-Vivant, Bloqueur',
  griff_oberwald: 'Humain, Blitzer',
  grim_ironjaw: 'Nain, Spécial',
  grombrindal: 'Nain, Blitzer',
  guffle_pussmaw: 'Humain, Bloqueur',
  hakflem_skuttlespike: 'Skaven, Coureur',
  helmut_wulf: 'Humain, Spécial',
  hthark_the_unstoppable: 'Nain, Blitzer',
  ivan_the_animal_deathshroud: 'Humain, Mort-Vivant, Blitzer',
  ivar_eriksson: 'Humain, Bloqueur',
  jeremiah_kool: 'Elfe, Lanceur',
  jordell_freshbreeze: 'Elfe, Receveur',
  karina_von_riesz: 'Vampire, Mort-Vivant, Coureur',
  karla_von_kill: 'Humain, Blitzer',
  kiroth_krakeneye: 'Elfe, Spécial',
  kreek_rustgouger: 'Skaven, Gros Bras, Spécial',
  lord_borak: 'Humain, Blitzer',
  lucien_swift: 'Elfe, Blitzer',
  valen_swift: 'Elfe, Receveur',
  luthor_von_drakenborg: 'Vampire, Mort-Vivant, Blitzer',
  maple_highgrove: 'Homme-Arbre, Gros Bras',
  max_spleenripper: 'Humain, Spécial',
  mighty_zug: 'Humain, Bloqueur',
  prince_moranion: 'Elfe, Blitzer',
  morg_n_thorg: 'Ogre, Gros Bras',
  nobbla_blackwart: 'Gobelin, Spécial',
  puggy_baconbreath: 'Halfling, Trois-quart',
  rashnak_backstabber: 'Gobelin, Spécial',
  ripper_bolgrot: 'Troll, Gros Bras',
  rodney_roachbait: 'Gobelin, Receveur',
  rowana_forestfoot: 'Homme-bête, Blitzer',
  roxanna_darknail: 'Elfe, Spécial',
  rumbelow_sheepskin: 'Homme-bête, Blitzer',
  scrappa_sorehead: 'Gobelin, Spécial',
  scyla_anfingrimm: 'Rejeton, Gros Bras',
  skitter_stab_stab: 'Skaven, Spécial',
  skorg_snowpelt: 'Yeti, Gros Bras',
  skrull_halfheight: 'Nain, Mort-Vivant, Lanceur',
  swiftvine_glimmershard: 'Gnome, Spécial',
  thorsson_stoutmead: 'Nain, Bloqueur',
  varag_ghoul_chewer: 'Orque, Blitzer',
  wilhelm_chaney: 'Loup-Garou, Mort-Vivant, Blitzer',
  willow_rosebark: 'Homme-Arbre, Bloqueur',
  withergrasp_doubledrool: 'Rejeton, Bloqueur',
  zolcath_the_zoat: 'Zoat, Gros Bras',
  zzharg_madeye: 'Nain, Lanceur',
};

/**
 * Mots-clés d'un Star Player (CSV FR) ou `null` si le slug est inconnu.
 * Les Star Players ne dépendent pas du ruleset : la lignée et le type d'un
 * mercenaire ne changent pas entre season_2 et season_3.
 */
export function getStarPlayerKeywords(slug: string): string | null {
  return STAR_PLAYER_KEYWORDS[slug] ?? null;
}
