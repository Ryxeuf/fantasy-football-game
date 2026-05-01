/**
 * Ligues régionales Blood Bowl Saison 3.
 *
 * Source : retranscription OCR officielle (extraction_blood_bowl.md).
 * Les Ligues sont indispensables pour le recrutement de certains Star Players
 * et l'achat de certains Coups de Pouce. Elles complètent les `regionalRules`
 * déjà présentes sur chaque roster (cf. `TEAM_REGIONAL_RULES` dans
 * `star-players.ts`) en fournissant un libellé et une description officielle.
 *
 * Le slug est aligné sur celui utilisé dans `TEAM_REGIONAL_RULES`.
 */

export interface RegionalLeagueDefinition {
  slug: string;
  nameFr: string;
  nameEn: string;
  description: string;
  descriptionEn?: string;
}

export const REGIONAL_LEAGUES: RegionalLeagueDefinition[] = [
  {
    slug: "badlands_brawl",
    nameFr: "Bagarre des Terres Arides",
    nameEn: "Badlands Brawl",
    description:
      "Foyer de nombre d'équipes de Peaux-vertes et d'Ogres, la Bagarre des Terres Arides est une affaire violente et brutale où les équipes font la part belle au carnage plutôt qu'aux touchdowns. Les matchs sont notoirement malhonnêtes et truqués, ce qui en fait toute la popularité.",
    descriptionEn:
      "Home to many Greenskin and Ogre teams, the Badlands Brawl is a violent and brutal affair where teams favour carnage over touchdowns. The games are infamously dishonest and rigged, which is exactly what makes them popular.",
  },
  {
    slug: "favoured_of",
    nameFr: "Clash du Chaos",
    nameEn: "Chaos Clash",
    description:
      "Les équipes dédiées à un (ou plusieurs) Dieux du Chaos jouent pour le Clash du Chaos. Il s'agit d'une ligue à juste titre chaotique, et on raconte que les Dieux du Chaos s'y investissent parfois, pour des résultats spectaculaires et le plus grand plaisir des fans.",
    descriptionEn:
      "Teams dedicated to one (or several) Chaos Gods play in the Chaos Clash. It's a fittingly chaotic league, and rumour has it that the Chaos Gods themselves sometimes get involved, leading to spectacular results to the delight of fans.",
  },
  {
    slug: "elven_kingdoms_league",
    nameFr: "Ligue des Royaumes Elfiques",
    nameEn: "Elven Kingdoms League",
    description:
      "La Ligue des Royaumes Elfiques est le pinacle du Blood Bowl techniquement correct et bien exécuté. Ses équipes s'enorgueillissent de leur bon droit. Les amoureux d'un jeu de passe élégant, d'époustouflantes courses sinueuses et de maillots somptueusement taillés n'ont pas à chercher plus loin.",
    descriptionEn:
      "The Elven Kingdoms League is the pinnacle of technically correct and well-executed Blood Bowl. Its teams pride themselves on their virtue. Fans of elegant passing plays, breathtaking weaving runs and flawlessly tailored jerseys need look no further.",
  },
  {
    slug: "halfling_thimble_cup",
    nameFr: "Coupe Dé à Coudre Halfling",
    nameEn: "Halfling Thimble Cup",
    description:
      "La Coupe Dé à Coudre Halfling est un pilier du calendrier du Blood Bowl. Plusieurs équipes de Halflings et de gnomes s'y affrontent non seulement lors de matchs du jeu divin de Nuffle, mais aussi lors de nombreux défis culinaires en marge du terrain.",
    descriptionEn:
      "The Halfling Thimble Cup is a staple of the Blood Bowl calendar. Several Halfling and Gnome teams compete not only in matches of Nuffle's divine game, but also in numerous culinary challenges on the sidelines.",
  },
  {
    slug: "lustrian_superleague",
    nameFr: "Super-ligue de Lustrie",
    nameEn: "Lustrian Superleague",
    description:
      "De loin la plus ancienne compétition du monde connu, la Super-ligue de Lustrie accueille certaines des plus anciennes équipes de la discipline. Lors des premiers millénaires, la compétition ne rassemblait que des Hommes-lézards ; plus récemment, elle s'est ouverte à d'autres peuples venus de la jungle.",
    descriptionEn:
      "By far the oldest competition in the known world, the Lustrian Superleague hosts some of the oldest teams in the sport. For its first millennia, only Lizardmen took part; more recently it has opened up to other jungle peoples.",
  },
  {
    slug: "old_world_classic",
    nameFr: "Classique du Vieux Monde",
    nameEn: "Old World Classic",
    description:
      "À l'effondrement de la NAF, le Blood Bowl s'est retrouvé en difficulté dans le Vieux Monde. Ce ne fut qu'à l'instauration de la Classique du Vieux Monde que les équipes du continent retrouvèrent une nouvelle ligue structurée. Grâce aux dons de mécènes impériaux et la couverture constante de Cabalvision, la Classique du Vieux Monde est devenue la ligue la plus influente du monde connu.",
    descriptionEn:
      "After the collapse of the NAF, Blood Bowl struggled in the Old World. Only with the founding of the Old World Classic did continental teams find a new structured league. Thanks to Imperial patrons and constant Cabalvision coverage, the Old World Classic has become the most influential league in the known world.",
  },
  {
    slug: "sylvanian_spotlight",
    nameFr: "Spot de Sylvanie",
    nameEn: "Sylvanian Spotlight",
    description:
      "Le Spot de Sylvanie est la ligue pour laquelle joue la grande majorité des équipes de morts-vivants. Jadis, c'était l'unique ligue commune pour les équipes assoiffées de chair ou allergiques au soleil ; l'amélioration de la technologie magique pare-soleil l'a remise sous les projecteurs de Cabalvision.",
    descriptionEn:
      "The Sylvanian Spotlight is the league for the vast majority of undead teams. It used to be the only common league for flesh-craving or sun-allergic teams; better sun-blocking magic has now brought it back under Cabalvision's spotlight.",
  },
  {
    slug: "elven_woodland_league",
    nameFr: "Ligue Sylvestre",
    nameEn: "Elven Woodland League",
    description:
      "La Ligue Sylvestre est disputée dans les forêts et les bosquets les plus secrets du monde connu. Ses terrains sont envahis d'une végétation luxuriante et offrent un environnement rassérénant et apaisant. Du moins, jusqu'au coup d'envoi et au moment où les joueurs exploiteront la forêt à leur avantage.",
    descriptionEn:
      "The Elven Woodland League is played in the most secret forests and groves of the known world. Its pitches are overrun with lush vegetation and offer a calming, soothing environment — at least until kick-off, when players exploit the forest to their advantage.",
  },
  {
    slug: "underworld_challenge",
    nameFr: "Défi des Bas-fonds",
    nameEn: "Underworld Challenge",
    description:
      "Jusqu'à récemment, bon nombre de fans et d'experts ne croyaient même pas à l'existence du Défi des Bas-fonds. Les matchs de cette ligue sont peut-être les plus exotiques de la discipline, réunissant Skavens, Snotlings, Gobelins et quiconque fréquente les égouts les plus nauséabonds en quête d'un match.",
    descriptionEn:
      "Until recently, many fans and pundits didn't even believe the Underworld Challenge existed. Its matches may be the most exotic in the sport, gathering Skaven, Snotlings, Goblins and anyone else lurking in the foulest sewers in search of a Blood Bowl game.",
  },
  {
    slug: "worlds_edge_superleague",
    nameFr: "Super-ligue du Bord du Monde",
    nameEn: "Worlds Edge Superleague",
    description:
      "Disputée sur les sommets et dans les forts alpestres des Montagnes du Bord du Monde, la Super-ligue est sans concession. Si ce n'était jadis qu'une ligue lors de laquelle les équipes de Nains faisaient étalage de leurs talents, ces dernières années, d'autres royaumes montagnards les ont rejoints, la plupart du temps grâce à leur force brute et leur opiniâtreté.",
    descriptionEn:
      "Played on the peaks and alpine fortresses of the World's Edge Mountains, the Superleague pulls no punches. Once a showcase for Dwarf teams, in recent years other mountain realms have joined in — usually thanks to brute strength and sheer stubbornness.",
  },
];

export const REGIONAL_LEAGUES_BY_SLUG: Record<string, RegionalLeagueDefinition> =
  REGIONAL_LEAGUES.reduce<Record<string, RegionalLeagueDefinition>>(
    (acc, league) => {
      acc[league.slug] = league;
      return acc;
    },
    {},
  );

export function getRegionalLeagueBySlug(
  slug: string,
): RegionalLeagueDefinition | null {
  return REGIONAL_LEAGUES_BY_SLUG[slug] ?? null;
}
