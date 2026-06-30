/**
 * Système centralisé de gestion des compétences avec des slugs
 * Chaque compétence a un slug unique, un nom français, un nom anglais et une description
 */

export interface SkillDefinition {
  slug: string;           // Identifiant unique (ex: "block", "dodge")
  nameFr: string;         // Nom français (ex: "Blocage")
  nameEn: string;         // Nom anglais (ex: "Block")
  description: string;    // Description de la compétence (français)
  /**
   * Description anglaise (optionnelle pour compatibilité historique).
   * Quand renseignée, sert de source principale lors du seed du champ
   * `Skill.descriptionEn` en base.
   */
  descriptionEn?: string;
  category: "General" | "Agility" | "Strength" | "Passing" | "Mutation" | "Trait" | "Scélérates";
  isElite?: boolean;      // Compétence Elite (+10 000 de valeur d'équipe)
  isPassive?: boolean;     // Compétence passive (soulignée)
  isModified?: boolean;    // Compétence modifiée ou nouveau nom (astérisque)
  season3Only?: boolean;  // Compétence qui n'existe qu'en Saison 3 (pas en Saison 2)
}

// Définition de toutes les compétences avec leurs slugs
export const SKILLS_DEFINITIONS: SkillDefinition[] = [
  // GENERAL SKILLS
  {
    slug: "block",
    nameFr: "Blocage",
    nameEn: "Block",
    description: "Quand on obtient le résultat Les Deux Plaqués lors d'une action de Blocage, ce joueur peut choisir de l'ignorer et ne pas être Plaqué (voir page 57).",
    category: "General"
  },
  {
    slug: "dauntless",
    nameFr: "Intrépide",
    nameEn: "Dauntless",
    description: "Quand ce joueur fait une action de Blocage (y compris pendant une action de Blitz), si la cible désignée a une caractéristique de Force supérieure à celle de ce joueur avant de compter les soutiens offensifs ou défensifs, mais après avoir appliqué les autres modificateurs, jetez un D6 et ajoutez la caractéristique de Force de ce joueur au résultat. Si le total est supérieur à la caractéristique de Force de la cible, ce joueur augmente sa caractéristique de Force jusqu'à être égale à celle de la cible de l'action de Blocage, avant de compter les soutiens offensifs ou défensifs, pour la durée de cette action de Blocage.",
    category: "General"
  },
  {
    slug: "dirty-player-1",
    nameFr: "Joueur Déloyal (+1)",
    nameEn: "Dirty Player (+1)",
    description: "Quand ce joueur fait une action d'Agression, vous pouvez modifier soit le jet d'Armure, soit le jet de Blessure, effectué contre la victime, du montant indiqué entre parenthèses. Ce modificateur peut être appliqué après avoir fait le jet.",
    category: "General"
  },
  {
    slug: "dirty-player-2",
    nameFr: "Joueur Déloyal (+2)",
    nameEn: "Dirty Player (+2)",
    description: "Quand ce joueur fait une action d'Agression, vous pouvez modifier soit le jet d'Armure, soit le jet de Blessure, effectué contre la victime, du montant indiqué entre parenthèses. Ce modificateur peut être appliqué après avoir fait le jet.",
    category: "General"
  },
  {
    slug: "fend",
    nameFr: "Parade",
    nameEn: "Fend",
    description: "Si ce joueur est repoussé à cause d'un résultat de dé de blocage s'appliquant à lui, il peut choisir d'empêcher le joueur qui l'a repoussé de le poursuivre. Toutefois, le joueur qui l'a repoussé peut continuer de se déplacer s'il est en train de faire une action de Blitz s'il lui reste du Mouvement ou en Fonçant.",
    category: "General"
  },
  {
    slug: "frenzy",
    nameFr: "Frénésie",
    nameEn: "Frenzy",
    description: "Chaque fois que ce joueur fait une action de Blocage (y compris pendant une action de Blitz), il doit poursuivre si la cible est repoussée et s'il en est capable. Si la cible est encore Debout après avoir été repoussée, et si ce joueur a pu poursuivre, il doit faire une seconde action de Blocage contre la même cible, et la poursuivre à nouveau si elle est repoussée.",
    category: "General",
    isModified: true
  },
  {
    slug: "kick",
    nameFr: "Frappe Précise",
    nameEn: "Kick",
    description: "Si ce joueur est désigné pour donner un coup d'envoi, vous pouvez décider de diviser par deux le résultat du D6 déterminant le nombre de cases sur lesquelles le ballon dévie, en arrondissant à l'entier inférieur.",
    category: "General"
  },
  {
    slug: "pro",
    nameFr: "Pro",
    nameEn: "Pro",
    description: "Pendant son activation, ce joueur peut tenter de relancer 1 dé. Ce dé peut être celui d'un jet de dé unique, faire partie d'un jet de plusieurs dés, ou faire partie d'un groupe de dés, mais ne peut pas être un dé d'un jet d'Armure, de Blessure ni d'Élimination.",
    category: "General"
  },
  {
    slug: "shadowing",
    nameFr: "Poursuite",
    nameEn: "Shadowing",
    description: "Ce joueur peut utiliser cette compétence quand un joueur adverse qu'il Marque se déplace volontairement hors d'une case située dans sa Zone de Tacle. Jetez un D6, ajoutez le MA de ce joueur au résultat et soustrayez ensuite le MA du joueur adverse. Si le résultat est de 6 ou plus, ce joueur peut immédiatement se déplacer dans la case libérée par le joueur adverse.",
    category: "General"
  },
  {
    slug: "strip-ball",
    nameFr: "Arracher le Ballon",
    nameEn: "Strip Ball",
    description: "Si ce joueur fait tomber un joueur adverse lors d'une action de Blocage, le joueur adverse doit jeter un D6. Sur un résultat de 1, il lâche le ballon.",
    category: "General"
  },
  {
    slug: "sure-hands",
    nameFr: "Prise Sûre",
    nameEn: "Sure Hands",
    description: "Ce joueur peut relancer n'importe quel dé lors d'une tentative de ramassage du ballon.",
    category: "General"
  },
  {
    slug: "tackle",
    nameFr: "Tacle",
    nameEn: "Tackle",
    description: "Quand un joueur adverse actif tente de faire un Esquive depuis une case dans laquelle il était Marqué par un ou plusieurs joueurs de votre équipe ayant cette compétence, ce joueur adverse ne peut pas utiliser la compétence Esquive.",
    category: "General"
  },
  {
    slug: "wrestle",
    nameFr: "Lutte",
    nameEn: "Wrestle",
    description: "Ce joueur peut utiliser cette compétence quand le résultat Les Deux Plaqués est appliqué, soit quand il effectue une action de Blocage, soit quand il est la cible d'une action de Blocage. Au lieu d'appliquer le résultat Les Deux Plaqués normalement, les deux joueurs sont Placés À Terre.",
    category: "General"
  },

  // AGILITY SKILLS
  {
    slug: "catch",
    nameFr: "Réception",
    nameEn: "Catch",
    description: "Ce joueur peut relancer un test d'Agilité raté lors d'une tentative de réception du ballon.",
    category: "Agility"
  },
  {
    slug: "diving-catch",
    nameFr: "Réception Plongée",
    nameEn: "Diving Catch",
    description: "Ce joueur peut tenter de réceptionner le ballon si une passe, une remise en jeu ou un coup d'envoi le fait atterrir dans une case située dans sa Zone de Tacle après dispersion ou déviation. De plus, ce joueur peut appliquer un modificateur de +1 à toute tentative de réceptionner une passe précise s'il occupe la case cible.",
    category: "Agility"
  },
  {
    slug: "diving-tackle",
    nameFr: "Tacle Plongé",
    nameEn: "Diving Tackle",
    description: "Si un joueur adverse actif qui tente de faire un Esquive, Saut ou Bond pour quitter une case dans laquelle il est Marqué par ce joueur réussit son test d'Agilité, vous pouvez déclarer que ce joueur va utiliser cette compétence. Votre adversaire doit immédiatement soustraire 2 au résultat du test d'Agilité.",
    category: "Agility"
  },
  {
    slug: "dodge",
    nameFr: "Esquive",
    nameEn: "Dodge",
    description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer un test d'Agilité raté lors d'une tentative d'Esquive. De plus, ce joueur peut choisir d'utiliser cette compétence quand il est la cible d'une action de Blocage et qu'un résultat de Trébuchement est appliqué contre lui.",
    category: "Agility"
  },
  {
    slug: "defensive",
    nameFr: "Défenseur",
    nameEn: "Defensive",
    description: "Pendant le tour d'équipe de votre adversaire (mais pas pendant votre propre tour d'équipe), tous les joueurs adverses Marqués par ce joueur ne peuvent pas utiliser la compétence Garde.",
    category: "Agility"
  },
  {
    slug: "jump-up",
    nameFr: "Rétablissement",
    nameEn: "Jump Up",
    description: "Si ce joueur est À Terre, il peut se relever gratuitement. De plus, si ce joueur est À Terre quand il est activé, il peut tenter de se Rétablir et effectuer une action de Blocage. Ce joueur fait un test d'Agilité, en appliquant un modificateur de +1.",
    category: "Agility"
  },
  {
    slug: "leap",
    nameFr: "Saut",
    nameEn: "Leap",
    description: "Pendant son mouvement, au lieu de sauter par-dessus une seule case occupée par un joueur À Terre ou Étourdi, un joueur avec cette compétence peut choisir de Sauter par-dessus n'importe quelle case adjacente, y compris les cases libres et les cases occupées par des joueurs Debout.",
    category: "Agility"
  },
  {
    slug: "safe-pair-of-hands",
    nameFr: "Libération Contrôlée",
    nameEn: "Safe Pair of Hands",
    description: "Si ce joueur est Renversé ou Placé À Terre alors qu'il est en possession du ballon, le ballon ne rebondit pas. Au lieu de cela, vous pouvez placer le ballon dans une case libre adjacente à celle qu'occupe ce joueur quand il devient À Terre.",
    category: "Agility"
  },
  {
    slug: "sidestep",
    nameFr: "Glissade Contrôlée",
    nameEn: "Sidestep",
    description: "Si ce joueur est repoussé pour quelque raison que ce soit, il n'est pas déplacé dans une case choisie par l'entraîneur adverse. Au lieu de cela, vous pouvez choisir n'importe quelle case libre adjacente à ce joueur.",
    category: "Agility"
  },
  {
    slug: "sneaky-git",
    nameFr: "Sournois",
    nameEn: "Sneaky Git",
    description: "Quand ce joueur effectue une action d'Agression, il n'est pas Expulsé pour avoir commis une Agression s'il obtient un double naturel sur le jet d'Armure. De plus, l'activation de ce joueur n'a pas besoin de se terminer une fois l'Agression commise.",
    category: "Agility"
  },
  {
    slug: "sprint",
    nameFr: "Sprint",
    nameEn: "Sprint",
    description: "Quand ce joueur effectue une action qui inclut du mouvement, il peut tenter de Foncer trois fois, plutôt que les deux habituelles.",
    category: "Agility"
  },
  {
    slug: "sure-feet",
    nameFr: "Équilibre",
    nameEn: "Sure Feet",
    description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer le D6 lors d'une tentative de Foncer.",
    category: "Agility"
  },

  // MUTATIONS
  {
    slug: "big-hand",
    nameFr: "Grande Main",
    nameEn: "Big Hand",
    description: "Ce joueur peut ignorer tout modificateur pour être Marqué ou pour les conditions météorologiques de Pluie Battante quand il tente de ramasser le ballon.",
    category: "Mutation"
  },
  {
    slug: "claws",
    nameFr: "Griffes",
    nameEn: "Claws",
    description: "Quand vous faites un jet d'Armure contre un joueur adverse qui a été Renversé à la suite d'une action de Blocage effectuée par ce joueur, un résultat de 8+ avant d'appliquer tout modificateur brisera son armure, peu importe sa valeur d'Armure réelle.",
    category: "Mutation",
    isPassive: true
  },
  {
    slug: "disturbing-presence",
    nameFr: "Présence Perturbante",
    nameEn: "Disturbing Presence",
    description: "Quand un joueur adverse effectue soit une action de Passe, soit une action de Lancer d'Équipier, soit une action Spéciale de Lancer de Bombe, ou tente soit d'interférer avec une passe soit de réceptionner le ballon, il doit appliquer un modificateur de -1 au test pour chaque joueur de votre équipe ayant cette compétence qui se trouve à trois cases de lui.",
    category: "Mutation",
    isModified: true
  },
  {
    slug: "extra-arms",
    nameFr: "Bras Supplémentaires",
    nameEn: "Extra Arms",
    description: "Ce joueur peut appliquer un modificateur de +1 quand il tente de ramasser ou de réceptionner le ballon, ou quand il tente d'interférer avec une passe.",
    category: "Mutation"
  },
  {
    slug: "foul-appearance",
    nameFr: "Répulsion*",
    nameEn: "Foul Appearance",
    description: "Chaque fois qu'un joueur adverse tente d'effectuer une action de blocage contre ce joueur, ou une action spéciale qui le cible directement, il doit lancer un D6 avant tout autre dé. Sur un résultat de 2+, l'action de blocage se poursuit normalement. Sur un résultat de 1, l'action de blocage est immédiatement annulée et l'activation du joueur adverse prend fin immédiatement.",
    category: "Mutation",
    isModified: true
  },
  {
    slug: "horns",
    nameFr: "Cornes",
    nameEn: "Horns",
    description: "Quand ce joueur effectue une action de Blocage dans le cadre d'une action de Blitz (mais pas seule), vous pouvez appliquer un modificateur de +1 à la caractéristique de Force de ce joueur.",
    category: "Mutation"
  },
  {
    slug: "iron-hard-skin",
    nameFr: "Peau de Fer",
    nameEn: "Iron Hard Skin",
    description: "La compétence Griffes ne peut pas être utilisée lors d'un jet d'Armure contre ce joueur. Les joueurs adverses ne peuvent pas modifier les jets d'Armure effectués contre ce joueur.",
    category: "Mutation"
  },
  {
    slug: "monstrous-mouth",
    nameFr: "Grande Gueule",
    nameEn: "Monstrous Mouth",
    description: "Ce joueur peut relancer toute tentative ratée de réceptionner le ballon. De plus, la compétence Arracher le Ballon ne peut pas être utilisée contre ce joueur.",
    category: "Mutation"
  },
  {
    slug: "prehensile-tail",
    nameFr: "Queue Préhensile",
    nameEn: "Prehensile Tail",
    description: "Quand un joueur adverse actif tente de faire un Esquive, Saut ou Bond pour quitter une case dans laquelle il est Marqué par ce joueur, il y a un modificateur supplémentaire de -1 appliqué au test d'Agilité du joueur actif.",
    category: "Mutation"
  },
  {
    slug: "tentacles",
    nameFr: "Tentacules",
    nameEn: "Tentacles",
    description: "Ce joueur peut utiliser cette compétence quand un joueur adverse qu'il Marque se déplace volontairement hors d'une case située dans sa Zone de Tacle. Jetez un D6, ajoutez la FO de ce joueur au résultat et soustrayez ensuite la FO du joueur adverse. Si le résultat est de 6 ou plus, le joueur adverse est fermement retenu en place et son mouvement se termine.",
    category: "Mutation"
  },
  {
    slug: "two-heads",
    nameFr: "Deux Têtes",
    nameEn: "Two Heads",
    description: "Ce joueur peut appliquer un modificateur de +1 au test d'Agilité quand il tente de faire un Esquive.",
    category: "Mutation"
  },
  {
    slug: "very-long-legs",
    nameFr: "Très Longues Jambes",
    nameEn: "Very Long Legs",
    description: "Ce joueur peut réduire tout modificateur négatif appliqué au test d'Agilité quand il tente de Sauter par-dessus un joueur À Terre ou Étourdi de 1, jusqu'à un minimum de -1. De plus, ce joueur peut appliquer un modificateur de +2 à toute tentative d'interférer avec une passe qu'il effectue.",
    category: "Mutation"
  },

  // PASSING SKILLS
  {
    slug: "accurate",
    nameFr: "Précision",
    nameEn: "Accurate",
    description: "Quand ce joueur effectue une action de Passe Rapide ou une action de Passe Courte, vous pouvez appliquer un modificateur supplémentaire de +1 au test de Capacité de Passe.",
    category: "Passing"
  },
  {
    slug: "cannoneer",
    nameFr: "Canonnier",
    nameEn: "Cannoneer",
    description: "Quand ce joueur effectue une action de Passe Longue ou une action de Passe Bombe Longue, vous pouvez appliquer un modificateur supplémentaire de +1 au test de Capacité de Passe.",
    category: "Passing"
  },
  {
    slug: "cloud-burster",
    nameFr: "Perce-Nuages",
    nameEn: "Cloud Burster",
    description: "Quand ce joueur effectue une action de Passe Longue ou une action de Passe Bombe Longue, vous pouvez choisir de faire relancer à l'entraîneur adverse une tentative réussie d'interférer avec la passe.",
    category: "Passing"
  },
  {
    slug: "dump-off",
    nameFr: "Délestage",
    nameEn: "Dump-off",
    description: "Si ce joueur est désigné comme cible d'une action de Blocage et s'il est en possession du ballon, il peut immédiatement effectuer une action de Passe Rapide, interrompant l'activation du joueur adverse effectuant l'action de Blocage.",
    category: "Passing"
  },
  {
    slug: "fumblerooskie",
    nameFr: "Fumblerooskie",
    nameEn: "Fumblerooskie",
    description: "Quand ce joueur effectue une action de Mouvement ou de Blitz alors qu'il est en possession du ballon, il peut choisir de 'lâcher' le ballon. Le ballon peut être placé dans n'importe quelle case que le joueur quitte pendant son mouvement et ne rebondit pas.",
    category: "Passing"
  },
  {
    slug: "hail-mary-pass",
    nameFr: "Passe Désespérée",
    nameEn: "Hail Mary Pass",
    description: "Quand ce joueur effectue une action de Passe, la case cible peut être n'importe où sur le terrain et la règle de portée n'a pas besoin d'être utilisée. Une passe désespérée n'est jamais précise, peu importe le résultat du test de Capacité de Passe.",
    category: "Passing"
  },
  {
    slug: "leader",
    nameFr: "Chef",
    nameEn: "Leader",
    description: "Une équipe qui a un ou plusieurs joueurs avec cette compétence gagne un seul relance d'équipe supplémentaire, appelé relance de Chef. Cependant, la relance de Chef ne peut être utilisée que s'il y a au moins un joueur avec cette compétence sur le terrain.",
    category: "Passing"
  },
  {
    slug: "nerves-of-steel",
    nameFr: "Nerfs d'Acier",
    nameEn: "Nerves of Steel",
    description: "Ce joueur peut ignorer tout modificateur pour être Marqué quand il tente d'effectuer une action de Passe, tente de réceptionner le ballon ou tente d'interférer avec une passe.",
    category: "Passing"
  },
  {
    slug: "on-the-ball",
    nameFr: "Sur le Ballon",
    nameEn: "On the Ball",
    description: "Ce joueur peut se déplacer jusqu'à trois cases quand l'entraîneur adverse déclare qu'un de ses joueurs va effectuer une action de Passe. Ce mouvement est effectué après que la portée ait été mesurée et la case cible déclarée, mais avant que le joueur actif fasse un test de Capacité de Passe.",
    category: "Passing"
  },
  {
    slug: "pass",
    nameFr: "Passe",
    nameEn: "Pass",
    description: "Ce joueur peut relancer un test de Capacité de Passe raté lors d'une action de Passe.",
    category: "Passing"
  },
  {
    slug: "running-pass",
    nameFr: "Passe dans la Course",
    nameEn: "Running Pass",
    description: "Si ce joueur effectue une action de Passe Rapide, son activation n'a pas besoin de se terminer une fois la passe résolue. Si vous le souhaitez et si ce joueur n'a pas utilisé sa totalité d'Allocation de Mouvement, il peut continuer à se déplacer après avoir résolu la passe.",
    category: "Passing",
    isModified: true
  },
  {
    slug: "safe-pass",
    nameFr: "Passe Assurée",
    nameEn: "Safe Pass",
    description: "Si ce joueur échoue une action de Passe, le ballon n'est pas lâché, ne rebondit pas depuis la case qu'occupe ce joueur, et aucun Renversement n'est causé. Au lieu de cela, ce joueur garde possession du ballon et son activation se termine.",
    category: "Passing"
  },

  // STRENGTH SKILLS
  {
    slug: "arm-bar",
    nameFr: "Clé de Bras",
    nameEn: "Arm Bar",
    description: "Si un joueur adverse Tombe à la suite d'un échec de son test d'Agilité en tentant de faire un Esquive, Saut ou Bond pour quitter une case dans laquelle il était Marqué par ce joueur, vous pouvez appliquer un modificateur de +1 soit au jet d'Armure soit au jet de Blessure.",
    category: "Strength"
  },
  {
    slug: "brawler",
    nameFr: "Bagarreur",
    nameEn: "Brawler",
    description: "Quand ce joueur effectue une action de Blocage seule (mais pas dans le cadre d'une action de Blitz), ce joueur peut relancer un seul résultat Les Deux Plaqués.",
    category: "Strength"
  },
  {
    slug: "break-tackle",
    nameFr: "Esquive en Force",
    nameEn: "Break Tackle",
    description: "Une fois pendant son activation, après avoir fait un test d'Agilité pour faire un Esquive, ce joueur peut modifier le jet de dé de +1 si sa caractéristique de Force est de 4 ou moins, ou de +2 si sa caractéristique de Force est de 5 ou plus.",
    category: "Strength"
  },
  {
    slug: "grab",
    nameFr: "Projection",
    nameEn: "Grab",
    description: "Quand ce joueur effectue une action de Blocage, il peut choisir d'appliquer un résultat de Repoussement à n'importe quelle case adjacente à la cible, plutôt qu'à la case dans laquelle la cible était repoussée.",
    category: "Strength"
  },
  {
    slug: "guard",
    nameFr: "Garde",
    nameEn: "Guard",
    description: "Ce joueur peut utiliser cette compétence quand un joueur adverse effectue une action de Blocage contre un coéquipier qui est adjacent à ce joueur. Ce joueur peut assister le coéquipier aux fins de cette action de Blocage.",
    category: "Strength"
  },
  {
    slug: "juggernaut",
    nameFr: "Boulet de Canon",
    nameEn: "Juggernaut",
    description: "Quand ce joueur effectue une action de Blocage, il peut choisir de traiter un résultat Les Deux Plaqués comme un résultat de Repoussement à la place.",
    category: "Strength"
  },
  {
    slug: "mighty-blow",
    nameFr: "Coup Puissant",
    nameEn: "Mighty Blow",
    description: "Quand un joueur adverse est Renversé à la suite d'une action de Blocage effectuée par ce joueur, vous pouvez appliquer un modificateur de +1 soit au jet d'Armure soit au jet de Blessure effectué contre lui.",
    category: "Strength"
  },
  {
    slug: "mighty-blow-1",
    nameFr: "Coup Puissant (+1)",
    nameEn: "Mighty Blow (+1)",
    description: "Quand un adversaire est Renversé à la suite d'une action de Blocage effectuée par ce joueur, le jet de Blessure effectué contre lui peut être modifié de +1. Ce modificateur peut être appliqué après que le jet ait été effectué.",
    category: "Strength"
  },
  {
    slug: "mighty-blow-2",
    nameFr: "Coup Puissant (+2)",
    nameEn: "Mighty Blow (+2)",
    description: "Quand un adversaire est Renversé à la suite d'une action de Blocage effectuée par ce joueur, le jet de Blessure effectué contre lui peut être modifié de +2. Ce modificateur peut être appliqué après que le jet ait été effectué.",
    category: "Strength"
  },
  {
    slug: "multiple-block",
    nameFr: "Blocage Multiple",
    nameEn: "Multiple Block",
    description: "Quand ce joueur effectue une action de Blocage, il peut cibler deux joueurs adverses adjacents au lieu d'un. Les deux cibles doivent être adjacentes à ce joueur et l'une à l'autre.",
    category: "Strength"
  },
  {
    slug: "pile-driver",
    nameFr: "Pilonneur",
    nameEn: "Pile Driver",
    description: "Quand un joueur adverse est Renversé à la suite d'une action de Blocage effectuée par ce joueur, vous pouvez appliquer un modificateur de +1 au jet de Blessure effectué contre lui.",
    category: "Strength"
  },
  {
    slug: "stand-firm",
    nameFr: "Stabilité",
    nameEn: "Stand Firm",
    description: "Ce joueur peut choisir de ne pas être repoussé à la suite d'une action de Blocage. S'il choisit de ne pas être repoussé, il est Placé À Terre à la place.",
    category: "Strength"
  },
  {
    slug: "strong-arm",
    nameFr: "Bras Musclé",
    nameEn: "Strong Arm",
    description: "Quand ce joueur effectue une action de Passe, vous pouvez réduire la portée d'un niveau (par exemple, une Passe Longue devient une Passe Courte).",
    category: "Strength"
  },
  {
    slug: "thick-skull",
    nameFr: "Crâne Épais",
    nameEn: "Thick Skull",
    description: "Quand ce joueur est Renversé, vous pouvez appliquer un modificateur de +1 au jet de Blessure effectué contre lui.",
    category: "Strength"
  },
  {
    slug: "armored-skull",
    nameFr: "Armure Blindée",
    nameEn: "Armored Skull",
    description: "Ce joueur bénéficie d'une protection supplémentaire grâce à son armure blindée.",
    category: "Strength"
  },

  // TRAITS
  {
    slug: "animal-savagery",
    nameFr: "Sauvagerie Animale*",
    nameEn: "Animal Savagery",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur doit effectuer une action de Blocage contre un coéquipier adjacent aléatoire s'il y en a un présent.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "bone-head",
    nameFr: "Cerveau Lent*",
    nameEn: "Bone Head",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "really-stupid",
    nameFr: "Gros Débile*",
    nameEn: "Really Stupid",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "regeneration",
    nameFr: "Régénération",
    nameEn: "Regeneration",
    description: "Quand ce joueur est retiré du jeu à la suite d'un jet de Blessure, jetez un D6. Sur un résultat de 4+, ce joueur n'est pas retiré du jeu et peut revenir jouer plus tard dans le match. Faire le jet de D6 de régénération avant le jet d'élimination => le jet pour apothicaire se fait donc après.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "right-stuff",
    nameFr: "Poids Plume*",
    nameEn: "Right Stuff",
    description: "Ce joueur peut être lancé par un coéquipier ayant la compétence Lancer d'Équipier.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "stunty",
    nameFr: "Minus*",
    nameEn: "Stunty",
    description: "Lorsque ce joueur tente d'esquiver, il ne subit aucun modificateur négatif à son test d'agilité pour avoir été marqué par des joueurs adverses. De plus, ce joueur applique un modificateur de -1 au test d'agilité lorsqu'il tente d'intercepter le ballon. Un joueur doté de ce trait est plus sujet aux blessures. Ainsi, si un jet de blessure est effectué pour lui, lancez le dé sur la table des blessures de Minus à la place.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "swarming",
    nameFr: "Essaimage",
    nameEn: "Swarming",
    description: "Ce joueur peut être placé sur le terrain au début du match même si cela dépasserait le nombre maximum de joueurs autorisés sur le terrain.",
    category: "Trait"
  },
  {
    slug: "take-root",
    nameFr: "Prendre Racine*",
    nameEn: "Take Root",
    description: "Chaque fois qu'on active ce joueur, après avoir annoncé son action, s'il est Debout il doit jeter un D6. Sur 2+, il peut effectuer l'action annoncée normalement. Sur un 1, il ne peut effectuer aucune action et son activation se termine immédiatement.",
    descriptionEn: "Each time this player is activated, immediately after declaring their action, if they are Standing they must roll a D6. On 2+, they may perform the declared action as normal. On a 1, they cannot perform any action and their activation ends immediately.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "titchy",
    nameFr: "Microbe*",
    nameEn: "Titchy",
    description: "Lorsque ce joueur tente d'esquiver, il applique un modificateur de +1 à son test d'agilité. De plus, il n'applique pas le modificateur de -1 pour « marquage » aux adversaires qui tentent d'esquiver pour sortir de sa zone de tacle.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "loner-3",
    nameFr: "Solitaire (3+)*",
    nameEn: "Loner (3+)",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 3+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "loner-4",
    nameFr: "Solitaire (4+)*",
    nameEn: "Loner (4+)",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 4+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "loner-5",
    nameFr: "Solitaire (5+)*",
    nameEn: "Loner (5+)",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 5+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "throw-team-mate",
    nameFr: "Lancer d'Équipier",
    nameEn: "Throw Team-mate",
    description: "Ce joueur peut effectuer une action de Lancer d'Équipier. C'est une action de Passe qui peut être effectuée contre un coéquipier adjacent ayant le trait Poids Plume*.",
    category: "Trait"
  },
  {
    slug: "wild-animal",
    nameFr: "Fureur Débridée*",
    nameEn: "Wild Animal",
    description: "Au début de l'activation, jetez un D6 (+2 si Block/Blitz). Sur un total de 1-3, l'activation se termine immédiatement. Pas de turnover.",
    category: "Trait"
  },
  {
    slug: "always-hungry",
    nameFr: "Toujours Affamé*",
    nameEn: "Always Hungry",
    description: "Ce joueur doit effectuer un test lorsqu'il tente de lancer un coéquipier. Sur un résultat de 1, il essaie de manger le coéquipier à la place.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "no-hands",
    nameFr: "Sans Ballon",
    nameEn: "No Hands",
    description: "Ce joueur ne peut ni ramasser, ni attraper, ni transporter le ballon.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "secret-weapon",
    nameFr: "Arme Secrète*",
    nameEn: "Secret Weapon",
    description: "Ce joueur est expulsé après avoir effectué une action ou à la fin du tour.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "bombardier",
    nameFr: "Bombardier*",
    nameEn: "Bombardier",
    description: "Lorsqu'il est activé et s'il est Debout, ce joueur peut effectuer une action Spéciale 'Lancer de Bombe'.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "chainsaw",
    nameFr: "Tronçonneuse*",
    nameEn: "Chainsaw",
    description: "Ce joueur possède une tronçonneuse qui lui donne des avantages au combat mais nécessite des jets spéciaux.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "ball-and-chain",
    nameFr: "Chaîne et Boulet",
    nameEn: "Ball and Chain",
    description: "Ce joueur possède une chaîne et un boulet qui le font se déplacer de manière aléatoire.",
    category: "Trait"
  },
  {
    slug: "hypnotic-gaze",
    nameFr: "Regard Hypnotique",
    nameEn: "Hypnotic Gaze",
    description: "Ce joueur peut tenter d'hypnotiser un joueur adverse adjacent. Il faut un 3+ pour réussir tout le temps. Plus de malus pour marquage.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "decay",
    nameFr: "Décomposition*",
    nameEn: "Decay",
    description: "Ce joueur se décompose progressivement au cours du match.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "stab",
    nameFr: "Poignard",
    nameEn: "Stab",
    description: "Ce joueur peut utiliser un poignard pour blesser un adversaire.",
    category: "Trait"
  },
  {
    slug: "pile-on",
    nameFr: "Piqué",
    nameEn: "Pile On",
    description: "Ce joueur peut se jeter sur un adversaire à terre pour lui infliger des dégâts supplémentaires. Si choisi de ne pas valdinger, D6 et gabarit de renvois puis 1D6 cases. Et permet de relancer un jet d'agilité d'atterrissage raté.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "animosity",
    nameFr: "Animosité*",
    nameEn: "Animosity",
    description: "Ce joueur est jaloux de et n'aime pas certains autres joueurs de son équipe, comme indiqué entre parenthèses après le nom de la compétence. Lorsque ce joueur souhaite effectuer une action de Remise à un coéquipier du type listé, ou tente d'effectuer une action de Passe et que la case cible est occupée par un coéquipier du type listé, ce joueur peut refuser de le faire. Lancez un D6. Sur un résultat de 1, ce joueur refuse d'effectuer l'action et son activation se termine.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "bloodlust",
    nameFr: "Soif de Sang*",
    nameEn: "Bloodlust",
    description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait est activé, après avoir déclaré son action, il doit lancer un D6, en ajoutant 1 au jet s'il a déclaré une action de Blocage ou de Blitz. S'il obtient un résultat égal ou supérieur au nombre indiqué entre parenthèses, il peut s'activer normalement. Si le joueur obtient un résultat inférieur au nombre indiqué entre parenthèses, ou obtient un 1 naturel, il peut choisir de mordre un coéquipier Thrall adjacent.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "bloodlust-2",
    nameFr: "Soif de Sang (2+)*",
    nameEn: "Bloodlust (2+)",
    description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait est activé, après avoir déclaré son action, il doit lancer un D6, en ajoutant 1 au jet s'il a déclaré une action de Blocage ou de Blitz. S'il obtient un résultat égal ou supérieur au nombre indiqué entre parenthèses (2+), il peut s'activer normalement. Si le joueur obtient un résultat inférieur au nombre indiqué entre parenthèses, ou obtient un 1 naturel, il peut choisir de mordre un coéquipier Thrall adjacent.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "bloodlust-3",
    nameFr: "Soif de Sang (3+)*",
    nameEn: "Bloodlust (3+)",
    description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait est activé, après avoir déclaré son action, il doit lancer un D6, en ajoutant 1 au jet s'il a déclaré une action de Blocage ou de Blitz. S'il obtient un résultat égal ou supérieur au nombre indiqué entre parenthèses (3+), il peut s'activer normalement. Si le joueur obtient un résultat inférieur au nombre indiqué entre parenthèses, ou obtient un 1 naturel, il peut choisir de mordre un coéquipier Thrall adjacent.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "plague-ridden",
    nameFr: "Porteur de Peste*",
    nameEn: "Plague Ridden",
    description: "Une fois par match, si un joueur adverse avec une caractéristique de Force de 4 ou moins qui n'a pas les traits Décomposition, Régénération ou Microbe subit un résultat de Blessure de 15-16, MORT suite à une action de Blocage effectuée ou une action d'Agression commise par un joueur avec ce trait appartenant à votre équipe, et si ce joueur ne peut pas être sauvé par un apothicaire, vous pouvez choisir d'utiliser ce trait. Si vous le faites, ce joueur ne meurt pas ; il a été infecté par une peste virulente !",
    category: "Trait"
  },
  {
    slug: "stakes",
    nameFr: "Pieux*",
    nameEn: "Stakes",
    description: "Ce joueur est armé de pieux spéciaux bénis pour causer des dégâts supplémentaires aux morts-vivants et à ceux qui travaillent avec eux. Ce joueur peut ajouter 1 au jet d'Armure lorsqu'il effectue une attaque de Poignard contre tout joueur jouant pour une équipe Khemri, Nécromantique, Mort-Vivant ou Vampire.",
    category: "Trait"
  },
  {
    slug: "timmm-ber",
    nameFr: "Timmm-ber!*",
    nameEn: "Timmm-ber!",
    description: "Si le joueur a une Allocation de Mouvement de 2 ou moins, appliquez un modificateur de +1 au jet de dé lorsqu'il tente de se relever pour chaque coéquipier Debout et en position ouverte actuellement adjacent à lui. Un 1 naturel est toujours un échec, peu importe le nombre de coéquipiers qui aident. Ce trait peut toujours être utilisé si le joueur est À Terre ou a perdu sa Zone de Tacle.",
    category: "Trait"
  },
  {
    slug: "pogo-stick",
    nameFr: "Monté sur Ressort",
    nameEn: "Pogo Stick",
    description: "Pendant son mouvement, au lieu de sauter par-dessus une seule case occupée par un joueur À Terre ou Étourdi, un joueur avec ce trait peut choisir de Sauter par-dessus n'importe quelle case adjacente, y compris les cases libres et les cases occupées par des joueurs Debout. De plus, lorsque ce joueur effectue un test d'Agilité pour sauter par-dessus un joueur À Terre ou Étourdi, ou pour Sauter par-dessus une case vide ou occupée par un joueur Debout, il peut appliquer un modificateur de +1.",
    category: "Trait"
  },
  {
    slug: "drunkard",
    nameFr: "Ivrogne*",
    nameEn: "Drunkard",
    description: "Ce joueur subit une pénalité de -1 au jet de dé lorsqu'il tente de Foncer.",
    category: "Trait"
  },
  {
    slug: "animosity-all",
    nameFr: "Animosité (Tous)*",
    nameEn: "Animosity (All)",
    description: "Ce joueur est jaloux de et n'aime pas tous les autres joueurs de son équipe. Lorsque ce joueur souhaite effectuer une action de Remise à un coéquipier, ou tente d'effectuer une action de Passe et que la case cible est occupée par un coéquipier, ce joueur peut refuser de le faire. Lancez un D6. Sur un résultat de 1, ce joueur refuse d'effectuer l'action et son activation se termine.",
    category: "Trait",
    isModified: true
  },
  {
    slug: "animosity-underworld",
    nameFr: "Animosité (Gobelins)*",
    nameEn: "Animosity (Underworld Goblins)",
    description: "Ce joueur est jaloux de et n'aime pas certains autres joueurs de son équipe, comme indiqué entre parenthèses après le nom de la compétence. Lorsque ce joueur souhaite effectuer une action de Remise à un coéquipier du type listé, ou tente d'effectuer une action de Passe et que la case cible est occupée par un coéquipier du type listé, ce joueur peut refuser de le faire. Lancez un D6. Sur un résultat de 1, ce joueur refuse d'effectuer l'action et son activation se termine.",
    category: "Trait"
  },
  {
    slug: "animosity-all-dwarf-halfling",
    nameFr: "Animosité (Tous Nains & Demi-Hommes)*",
    nameEn: "Animosity (All Dwarfs & Halflings)",
    description: "Ce joueur est jaloux de et n'aime pas certains autres joueurs de son équipe, comme indiqué entre parenthèses après le nom de la compétence. Lorsque ce joueur souhaite effectuer une action de Remise à un coéquipier du type listé, ou tente d'effectuer une action de Passe et que la case cible est occupée par un coéquipier du type listé, ce joueur peut refuser de le faire. Lancez un D6. Sur un résultat de 1, ce joueur refuse d'effectuer l'action et son activation se termine.",
    category: "Trait"
  },
  {
    slug: "animosity-all-dwarf-human",
    nameFr: "Animosité (Tous Nains & Humains)*",
    nameEn: "Animosity (All Dwarfs & Humans)",
    description: "Ce joueur est jaloux de et n'aime pas certains autres joueurs de son équipe, comme indiqué entre parenthèses après le nom de la compétence. Lorsque ce joueur souhaite effectuer une action de Remise à un coéquipier du type listé, ou tente d'effectuer une action de Passe et que la case cible est occupée par un coéquipier du type listé, ce joueur peut refuser de le faire. Lancez un D6. Sur un résultat de 1, ce joueur refuse d'effectuer l'action et son activation se termine.",
    category: "Trait"
  },
  {
    slug: "projectile-vomit",
    nameFr: "Gerbe de Vomi",
    nameEn: "Projectile Vomit",
    description: "Au lieu d'effectuer une action de Blocage, ce joueur peut effectuer une action Spéciale 'Vomissement Projectile'.",
    category: "Trait"
  },
  {
    slug: "really-stupid-2",
    nameFr: "Gros Débile (+2)*",
    nameEn: "Really Stupid (+2)",
    description: "Quand ce joueur est activé, même s'il est À Terre ou a perdu sa Zone de Tacle, jetez un D6 juste après avoir annoncé l'action qu'il va faire mais avant d'effectuer l'action, en appliquant un modificateur de +2 au jet si ce joueur est actuellement adjacent à un ou plusieurs coéquipiers Debout et n'ayant pas ce trait: Sur 1-3, ce joueur oublie ce qu'il était censé faire et son activation se termine immédiatement. De plus, il perd sa Zone de Tacle jusqu'à sa prochaine activation. Sur 4+, il continue normalement son activation et effectue l'action annoncée.",
    category: "Trait"
  },
  {
    slug: "kick-team-mate",
    nameFr: "Botter de Coéquipier",
    nameEn: "Kick Team-mate",
    description: "Une fois par tour d'équipe, en plus d'un autre joueur effectuant soit une Passe soit une action de Lancer d'Équipier, un seul joueur avec ce trait sur l'équipe active peut effectuer une action Spéciale 'Kick Team-mate'.",
    category: "Trait"
  },

  // NOUVELLES COMPÉTENCES SAISON 3 - SCÉLÉRATES
  {
    slug: "solitary-aggressor",
    nameFr: "Agresseur Solitaire",
    nameEn: "Solitary Aggressor",
    description: "Quand ce joueur effectue une Action d'Agression sans Soutien Offensif ou Défensif, alors ce joueur peut relancer un Jet d'Armure raté.",
    category: "Scélérates",
    season3Only: true
  },
  {
    slug: "lightning-aggression",
    nameFr: "Agression Eclair",
    nameEn: "Lightning Aggression",
    description: "L'Activation de ce joueur ne prend pas fin après qu'il a effectué une Action d'Agression, et il peut continuer son Action de Mouvement avec son mouvement restant.",
    category: "Scélérates",
    season3Only: true
  },
  {
    slug: "boot-to-the-head",
    nameFr: "Coup de Crampons",
    nameEn: "Boot to the Head",
    description: "Ce joueur peut fournir un Soutien Offensif quand un coéquipier effectue une Action d'Agression, quel que soit le nombre de joueurs adverse qui Marquent ce joueur",
    category: "Scélérates",
    season3Only: true
  },
  {
    slug: "fork",
    nameFr: "Fourchette",
    nameEn: "Fork",
    description: "Quand un joueur adverse est Repoussée par ce joueur, le joueur adverse ne peut plus fournir de soutien Offensif ni Défensif jusqu'à la fin de sa prochaine activation",
    category: "Scélérates",
    season3Only: true
  },
  {
    slug: "violent-innovator",
    nameFr: "Innovateur Violent",
    nameEn: "Violent Innovator",
    description: "Si un joueur adverse subit une Élimination suite à une Action Spéciale que ce joueur à effectuée, ce joueur gagne des PSP correspondants pour avoir infligé une Élimination.",
    category: "Scélérates",
    isModified: true,
    season3Only: true
  },
  {
    slug: "provocation",
    nameFr: "Provocation",
    nameEn: "Provocation",
    description: "Quand un joueur ayant cette Compétence est Repoussée suite à un blocage contre lui, il peut forcer le joueur adverse à Poursuivre. (sauf si enraciné)",
    category: "Scélérates",
    isModified: true,
    season3Only: true
  },
  {
    slug: "saboteur",
    nameFr: "Saboteur",
    nameEn: "Saboteur",
    description: "Quand ce joueur est Plaqué suite à l'Action de Blocage d'un joueur Adverse, avant de faire le jet d'Armure, il peut jeter un D6. Sur un 1-3, rien et on fait le jet d'Armure. Sur 4+, l'arme sabotée de joueur explose et le joueur adverse est aussi Plaquée, sans provoquer de Turnover sauf si le joueur adverse était en possession du Ballon. Si l'arme de ce joueur explose, le joueur est automatiquement KO et pas de jet d'Armure pour lui. Nécessite le trait Arme Secrète",
    category: "Scélérates",
    season3Only: true
  },
  {
    slug: "fatal-flight",
    nameFr: "Vol Fatal",
    nameEn: "Fatal Flight",
    description: "Lors d'un Lancer de Coéquipier, permet au joueur lancé, s'il atterrit ou rebondit sur une case occupée et si le joueur adverse est plaqué, d'appliquer un +1 au jet d'Armure ou au jet de Blessure. Si le joueur adverse subit une Élimination, ce joueur gagne des PSP correspondants pour avoir infligé une Élimination.",
    category: "Scélérates",
    season3Only: true
  },
  {
    slug: "clearance",
    nameFr: "Dégagement",
    nameEn: "Clearance",
    description: "Ce joueur peut annoncer une Action Spéciale de Dégagement. 1 seul par tour. Peut faire d'abord un mouvement. Choisir une direction, utiliser le Gabarit de Renvois et un D6 pour déterminer la direction et un D6 pour le nombre de cases. Pas de Turnover si ballon au sol.",
    category: "Scélérates",
    isModified: true,
    season3Only: true
  },

  // NOUVELLES COMPÉTENCES SAISON 3 - AUTRES CATÉGORIES
  {
    slug: "surefoot",
    nameFr: "Appuis Sûrs",
    nameEn: "Surefoot",
    description: "Chaque fois que ce joueur est censé être Plaqué ou Chute, jetez un D6. Sur un 6, ce joueur n'est pas Plaqué ou ne Chute pas. Si ceci se produit pendant son activation, il peut la continuer normalement, sans Turnover.",
    category: "General",
    isModified: true,
    season3Only: true
  },
  {
    slug: "bullseye",
    nameFr: "Dans le Mille",
    nameEn: "Bullseye",
    description: "Lors d'une Action de Lancer de Coéquipier de joueur, si le résultat du lancer est un Lancer Superbe, alors le joueur lancé ne Valdingue pas et atterrit sur la case ciblée.",
    category: "Strength",
    season3Only: true
  },
  {
    slug: "running-pass-2025",
    nameFr: "Transmission dans la course",
    nameEn: "Running Pass",
    description: "Si ce joueur effectue une Action de Passe qui est une Passe Rapide ou une Action de Transmission, son activation ne prend pas fin et il peut continuer son Action de Mouvement.",
    category: "Passing",
    isModified: true,
    season3Only: true
  },

  // NOUVEAUX TRAITS SAISON 3
  {
    slug: "trickster",
    nameFr: "Farceur",
    nameEn: "Trickster",
    description: "Chaque fois qu'un joueur adverse tente d'effectuer une Action de Blocage contre ce joueur, ou une Action Spéciale qui cible directement ce joueur (à l'exception d'une Action de Blocage causée par Chaîne et Boulet), ce joueur peut utiliser ce Trait. Avant de déterminer combien de dés on jette, ce joueur peut être retiré du terrain et placé sur n'importe quelle autre case inoccupée adjacente au joueur effectuant l'action. L'action se déroule ensuite normalement.",
    descriptionEn: "Whenever an opposition player attempts a Block action against this player, or a Special action targeting this player directly (except a Block triggered by Ball and Chain), this player may use this Trait. Before determining how many dice to roll, this player may be removed from the pitch and placed on any other unoccupied square adjacent to the player performing the action. The action then proceeds normally.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "hate",
    nameFr: "Haine (X)*",
    nameEn: "Hate (X)",
    description: "Chaque fois que ce joueur effectue une Action de Blocage contre un joueur ayant le même Mot-clé que celui entre parenthèses, ce joueur peut relancer un résultat Attaquant Plaqué.",
    descriptionEn: "Whenever this player performs a Block action against a player with the same keyword as the one in parentheses, this player may re-roll an Attacker Down result.",
    category: "Trait",
    season3Only: true
  },
  {
    // A20 — variante paramétrée pour le Tueur de Trolls (Haine du Mot-clé Troll).
    slug: "hate-troll",
    nameFr: "Haine (Troll)",
    nameEn: "Hate (Troll)",
    description: "Chaque fois que ce joueur effectue une Action de Blocage contre un joueur ayant le Mot-clé Troll, ce joueur peut relancer un résultat Attaquant Plaqué.",
    descriptionEn: "Whenever this player performs a Block action against a player with the Troll keyword, this player may re-roll an Attacker Down result.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "insignifiant",
    nameFr: "Insignifiant*",
    nameEn: "Insignificant",
    description: "Quand vous créez une Liste d'Équipe, vous ne pouvez pas inclure plus de joueurs ayant ce Trait que de joueurs n'ayant pas ce Trait.",
    descriptionEn: "When you create a roster, you cannot include more players with this Trait than players without it.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "contagieux",
    nameFr: "Contagieux",
    nameEn: "Contagious",
    description: "Une fois par match, quand un joueur ayant ce Trait inflige une Élimination à un joueur adverse suite à une Action de Blocage et que celui-ci subit un résultat Mort sur son Jet d'Élimination, s'il n'est pas sauvé par un Apothicaire, vous pouvez immédiatement ajouter 1 nouveau joueur Trois-quart de votre Fiche d'Équipe à votre Box des Réserves (cela peut amener votre équipe à compter plus de 16 joueurs pour le restant du match). Pendant la Séquence d'Après Match, vous pouvez embaucher ce joueur comme un Joueur Journalier. Inutilisable contre les Gros Bras, ni contre un joueur ayant les Traits Décomposition, Régénération ou Minus.",
    descriptionEn: "Once per match, when a player with this Trait inflicts a Casualty on an opposing player via a Block action and that player suffers a Dead result on the Casualty roll, if they are not saved by an Apothecary, you may immediately add a new Lineman from your roster to your Reserves Box (this can temporarily exceed 16 players). During the Post-Game Sequence you may permanently hire this player like a Journeyman. Cannot be used against Big Guys or against a player with Decay, Regeneration or Titchy.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "instable",
    nameFr: "Instable*",
    nameEn: "Unstable",
    description: "Ce joueur ne peut pas déclarer d'Action de Sécurisation du Ballon.",
    descriptionEn: "This player cannot declare a Secure the Ball action.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "breathe-fire",
    nameFr: "Souffle Ardent",
    nameEn: "Breathe Fire",
    description: "Quand on active ce joueur, il peut annoncer une Action Spéciale de Souffle Ardent (pas de limite par tour). Choisissez un joueur adverse Debout qu'il Marque et jetez un D6, en appliquant un modificateur de -1 si la cible a une Force de 5 ou plus. Sur un 1, ce joueur est immédiatement Plaqué. Sur 2-3, rien ne se passe. Sur 4+, le joueur adverse est Mis À Terre. Sur un 6 naturel, le joueur adverse est Plaqué à la place. L'Action Spéciale peut remplacer le Bloc d'un Blitz, mais l'activation prend fin sitôt qu'elle est effectuée.",
    descriptionEn: "When activated, this player may declare a Breathe Fire Special Action (no per-turn limit). Choose an adjacent Standing opposing player they Mark and roll a D6 (apply a -1 modifier if the target has Strength 5+). On a 1, this player is immediately Knocked Down. On 2-3, nothing happens. On 4+, the target is Placed Prone. On a natural 6, the target is Knocked Down instead. The Special Action may replace the Block of a Blitz, but the activation ends after it.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "my-ball",
    nameFr: "Mon Ballon*",
    nameEn: "My Ball",
    description: "Un joueur ayant ce Trait ne peut pas abandonner volontairement le ballon quand il en est en possession, et ne peut donc pas déclarer d'Actions de Passe ni de Transmission, ni utiliser la moindre Compétence ou Trait qui l'autoriserait à renoncer à la possession du ballon.",
    descriptionEn: "A player with this Trait cannot voluntarily give up the ball while they possess it, and therefore cannot declare Pass or Hand-off actions, nor use any Skill or Trait that would let them relinquish possession.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "pick-me-up",
    nameFr: "Petit Remontant",
    nameEn: "Pick-me-up",
    description: "À la fin de chaque Tour adverse, jetez un D6 pour chaque coéquipier À Terre à 3 cases ou moins d'un ou plusieurs joueurs Debout ayant ce Trait. Sur 5+, le joueur À Terre peut immédiatement se relever. Si un joueur ayant ce Trait se relève suite à un coéquipier utilisant ce Trait, il ne peut pas aussi utiliser ce Trait pendant le même Tour.",
    descriptionEn: "At the end of each opposing turn, roll a D6 for each Prone teammate within 3 squares of one or more Standing players with this Trait. On 5+, the Prone player may immediately stand up. A player who stood up via another teammate's use of this Trait cannot themselves use it during the same turn.",
    category: "Trait",
    season3Only: true
  },
  {
    slug: "hit-and-run",
    nameFr: "Frappe-et-court",
    nameEn: "Hit and Run",
    description: "Quand un joueur ayant cette Compétence effectue une Action de Blocage ou une Action Spéciale de Poignard, après avoir entièrement résolu l'Action avec succès, il peut immédiatement se déplacer de 1 case gratuitement en ignorant les Zones de Tacle, tant qu'il est toujours Debout. Le joueur doit s'assurer qu'après ce mouvement gratuit, il ne Marque ni n'est Marqué par aucun joueur adverse. Incompatible avec Frénésie.",
    descriptionEn: "When a player with this Skill performs a Block action or a Stab Special Action, after fully resolving it successfully, they may immediately move 1 square for free, ignoring Tackle Zones, as long as they are still Standing. After this free move, they must not be Marking or Marked by any opposing player. Incompatible with Frenzy.",
    category: "Agility",
    season3Only: true
  },
  // ─── RÈGLES SPÉCIALES STAR PLAYERS ────────────────────────────────
  {
    slug: "blind-rage",
    nameFr: "Rage Aveugle",
    nameEn: "Blind Rage",
    description: "Peut relancer le D6 pour Intrépide (Dauntless).",
    category: "Trait"
  },
  {
    slug: "slayer",
    nameFr: "Tueur",
    nameEn: "Slayer",
    description: "Peut relancer les jets d'Intrépide (Dauntless) ratés.",
    category: "Trait"
  },
  {
    slug: "coup-sauvage",
    nameFr: "Coup Sauvage",
    nameEn: "Savage Blow",
    description: "Une fois par partie, peut relancer n'importe quel nombre de dés de Blocage.",
    category: "Trait"
  },
  {
    slug: "la-baliste",
    nameFr: "La Baliste",
    nameEn: "The Ballista",
    description: "Une fois par match, peut relancer un jet de Passe raté (Passe ou Lancer de Coéquipier).",
    category: "Trait"
  },
  {
    slug: "consummate-professional",
    nameFr: "Professionnel Accompli",
    nameEn: "Consummate Professional",
    description: "Une fois par match, peut relancer n'importe quel dé.",
    category: "Trait"
  },
  {
    slug: "crushing-blow",
    nameFr: "Coup Dévastateur",
    nameEn: "Crushing Blow",
    description: "Une fois par match, +1 au jet d'armure après un blocage réussi.",
    category: "Trait"
  },
  {
    slug: "lord-of-chaos",
    nameFr: "Seigneur du Chaos",
    nameEn: "Lord of Chaos",
    description: "L'équipe gagne +1 relance d'équipe pour la première mi-temps.",
    category: "Trait"
  },
  {
    slug: "pirouette",
    nameFr: "Pirouette",
    nameEn: "Pirouette",
    description: "Une fois par tour, +1 au jet d'esquive.",
    category: "Trait"
  },
  {
    slug: "casse-os",
    nameFr: "Casse-Os",
    nameEn: "Bone Breaker",
    description: "Une fois par match, +1 en Force lors d'un blocage.",
    category: "Trait"
  },
  {
    slug: "reliable",
    nameFr: "Fiable",
    nameEn: "Reliable",
    description: "Un Lancer de Coéquipier raté ne cause pas de turnover.",
    category: "Trait"
  },
];

// Index par slug pour accès rapide
export const SKILLS_BY_SLUG: Record<string, SkillDefinition> = SKILLS_DEFINITIONS.reduce(
  (acc, skill) => {
    acc[skill.slug] = skill;
    return acc;
  },
  {} as Record<string, SkillDefinition>
);

// Index par nom français
export const SKILLS_BY_NAME_FR: Record<string, SkillDefinition> = SKILLS_DEFINITIONS.reduce(
  (acc, skill) => {
    acc[skill.nameFr] = skill;
    return acc;
  },
  {} as Record<string, SkillDefinition>
);

// Index par nom anglais
export const SKILLS_BY_NAME_EN: Record<string, SkillDefinition> = SKILLS_DEFINITIONS.reduce(
  (acc, skill) => {
    acc[skill.nameEn] = skill;
    return acc;
  },
  {} as Record<string, SkillDefinition>
);

/**
 * Obtient une compétence par son slug
 */
export function getSkillBySlug(slug: string): SkillDefinition | null {
  return SKILLS_BY_SLUG[slug] || null;
}

/**
 * Obtient une compétence par son nom français
 */
export function getSkillByNameFr(name: string): SkillDefinition | null {
  return SKILLS_BY_NAME_FR[name] || null;
}

/**
 * Obtient une compétence par son nom anglais
 */
export function getSkillByNameEn(name: string): SkillDefinition | null {
  return SKILLS_BY_NAME_EN[name] || null;
}

/**
 * Convertit une chaîne de compétences (format: "slug1,slug2,slug3") en tableau de slugs
 */
export function parseSkillSlugs(skillsString: string): string[] {
  if (!skillsString || skillsString.trim() === "") {
    return [];
  }
  return skillsString.split(",").map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Convertit un tableau de slugs en chaîne de compétences
 */
export function formatSkillSlugs(slugs: string[]): string {
  return slugs.join(",");
}

/**
 * Convertit une chaîne de noms (français ou anglais) en tableau de slugs
 * Utile pour la migration des données existantes
 */
export function convertNamesToSlugs(skillsString: string): string {
  const names = skillsString.split(",").map(s => s.trim()).filter(s => s.length > 0);
  const slugs = names.map(name => {
    // Essayer d'abord avec le nom français
    let skill = getSkillByNameFr(name);
    if (!skill) {
      // Essayer avec le nom anglais
      skill = getSkillByNameEn(name);
    }
    return skill ? skill.slug : name; // Si pas trouvé, garder le nom original
  });
  return formatSkillSlugs(slugs);
}

/**
 * Obtient les noms d'affichage (français) à partir d'une chaîne de slugs
 */
export function getDisplayNames(skillsString: string, language: "fr" | "en" = "fr"): string[] {
  const slugs = parseSkillSlugs(skillsString);
  return slugs.map(slug => {
    const skill = getSkillBySlug(slug);
    if (!skill) return slug; // Si pas trouvé, retourner le slug
    return language === "fr" ? skill.nameFr : skill.nameEn;
  });
}

