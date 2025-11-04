/**
 * Système centralisé de gestion des compétences avec des slugs
 * Chaque compétence a un slug unique, un nom français, un nom anglais et une description
 */

export interface SkillDefinition {
  slug: string;           // Identifiant unique (ex: "block", "dodge")
  nameFr: string;         // Nom français (ex: "Blocage")
  nameEn: string;         // Nom anglais (ex: "Block")
  description: string;    // Description de la compétence
  category: "General" | "Agility" | "Strength" | "Passing" | "Mutation" | "Trait";
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
    category: "General"
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
    category: "Mutation"
  },
  {
    slug: "disturbing-presence",
    nameFr: "Présence Perturbante",
    nameEn: "Disturbing Presence",
    description: "Quand un joueur adverse effectue soit une action de Passe, soit une action de Lancer d'Équipier, soit une action Spéciale de Lancer de Bombe, ou tente soit d'interférer avec une passe soit de réceptionner le ballon, il doit appliquer un modificateur de -1 au test pour chaque joueur de votre équipe ayant cette compétence qui se trouve à trois cases de lui.",
    category: "Mutation"
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
    description: "Quand un joueur adverse déclare une action de Blocage ciblant ce joueur, son entraîneur doit d'abord jeter un D6. Sur un résultat de 1, le joueur ne peut pas effectuer l'action déclarée et l'action est gaspillée.",
    category: "Mutation"
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
    category: "Passing"
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

  // TRAITS
  {
    slug: "animal-savagery",
    nameFr: "Sauvagerie Animale*",
    nameEn: "Animal Savagery",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur doit effectuer une action de Blocage contre un coéquipier adjacent aléatoire s'il y en a un présent.",
    category: "Trait"
  },
  {
    slug: "bone-head",
    nameFr: "Tête de Bois",
    nameEn: "Bone Head",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  {
    slug: "really-stupid",
    nameFr: "Gros Débile*",
    nameEn: "Really Stupid",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  {
    slug: "regeneration",
    nameFr: "Régénération",
    nameEn: "Regeneration",
    description: "Quand ce joueur est retiré du jeu à la suite d'un jet de Blessure, jetez un D6. Sur un résultat de 4+, ce joueur n'est pas retiré du jeu et peut revenir jouer plus tard dans le match.",
    category: "Trait"
  },
  {
    slug: "right-stuff",
    nameFr: "Poids Plume*",
    nameEn: "Right Stuff",
    description: "Ce joueur peut être lancé par un coéquipier ayant la compétence Lancer d'Équipier.",
    category: "Trait"
  },
  {
    slug: "stunty",
    nameFr: "Microbe*",
    nameEn: "Stunty",
    description: "Ce joueur peut faire un Esquive sur un résultat de 2+ au lieu de 3+. Cependant, ce joueur ne peut pas utiliser la compétence Esquive.",
    category: "Trait"
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
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  {
    slug: "titchy",
    nameFr: "Minus*",
    nameEn: "Titchy",
    description: "Ce joueur peut faire un Esquive sur un résultat de 2+ au lieu de 3+. Cependant, ce joueur ne peut pas utiliser la compétence Esquive.",
    category: "Trait"
  },
  {
    slug: "loner-3",
    nameFr: "Solitaire (3+)*",
    nameEn: "Loner (3+)",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 3+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait"
  },
  {
    slug: "loner-4",
    nameFr: "Solitaire (4+)*",
    nameEn: "Loner (4+)",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 4+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait"
  },
  {
    slug: "loner-5",
    nameFr: "Solitaire (5+)*",
    nameEn: "Loner (5+)",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 5+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait"
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
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  {
    slug: "always-hungry",
    nameFr: "Toujours Affamé*",
    nameEn: "Always Hungry",
    description: "Ce joueur doit effectuer un test lorsqu'il tente de lancer un coéquipier. Sur un résultat de 1, il essaie de manger le coéquipier à la place.",
    category: "Trait"
  },
  {
    slug: "no-hands",
    nameFr: "Sans les Mains*",
    nameEn: "No Hands",
    description: "Ce joueur ne peut ni ramasser, ni attraper, ni transporter le ballon.",
    category: "Trait"
  },
  {
    slug: "secret-weapon",
    nameFr: "Arme Secrète*",
    nameEn: "Secret Weapon",
    description: "Ce joueur est expulsé après avoir effectué une action ou à la fin du tour.",
    category: "Trait"
  },
  {
    slug: "chainsaw",
    nameFr: "Tronçonneuse*",
    nameEn: "Chainsaw",
    description: "Ce joueur possède une tronçonneuse qui lui donne des avantages au combat mais nécessite des jets spéciaux.",
    category: "Trait"
  },
  {
    slug: "ball-and-chain",
    nameFr: "Chaîne et Boulet*",
    nameEn: "Ball & Chain",
    description: "Ce joueur possède une chaîne et un boulet qui le font se déplacer de manière aléatoire.",
    category: "Trait"
  },
  {
    slug: "hypnotic-gaze",
    nameFr: "Regard Hypnotique",
    nameEn: "Hypnotic Gaze",
    description: "Ce joueur peut tenter d'hypnotiser un joueur adverse adjacent.",
    category: "Trait"
  },
  {
    slug: "decay",
    nameFr: "Décomposition*",
    nameEn: "Decay",
    description: "Ce joueur se décompose progressivement au cours du match.",
    category: "Trait"
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
    description: "Ce joueur peut se jeter sur un adversaire à terre pour lui infliger des dégâts supplémentaires.",
    category: "Trait"
  },
  {
    slug: "animosity",
    nameFr: "Animosité*",
    nameEn: "Animosity",
    description: "Ce joueur est jaloux de et n'aime pas certains autres joueurs de son équipe, comme indiqué entre parenthèses après le nom de la compétence. Lorsque ce joueur souhaite effectuer une action de Remise à un coéquipier du type listé, ou tente d'effectuer une action de Passe et que la case cible est occupée par un coéquipier du type listé, ce joueur peut refuser de le faire. Lancez un D6. Sur un résultat de 1, ce joueur refuse d'effectuer l'action et son activation se termine.",
    category: "Trait"
  },
  {
    slug: "bloodlust",
    nameFr: "Soif de Sang*",
    nameEn: "Bloodlust",
    description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait est activé, après avoir déclaré son action, il doit lancer un D6, en ajoutant 1 au jet s'il a déclaré une action de Blocage ou de Blitz. S'il obtient un résultat égal ou supérieur au nombre indiqué entre parenthèses, il peut s'activer normalement. Si le joueur obtient un résultat inférieur au nombre indiqué entre parenthèses, ou obtient un 1 naturel, il peut choisir de mordre un coéquipier Thrall adjacent.",
    category: "Trait"
  },
  {
    slug: "bloodlust-2",
    nameFr: "Soif de Sang (2+)*",
    nameEn: "Bloodlust (2+)",
    description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait est activé, après avoir déclaré son action, il doit lancer un D6, en ajoutant 1 au jet s'il a déclaré une action de Blocage ou de Blitz. S'il obtient un résultat égal ou supérieur au nombre indiqué entre parenthèses (2+), il peut s'activer normalement. Si le joueur obtient un résultat inférieur au nombre indiqué entre parenthèses, ou obtient un 1 naturel, il peut choisir de mordre un coéquipier Thrall adjacent.",
    category: "Trait"
  },
  {
    slug: "bloodlust-3",
    nameFr: "Soif de Sang (3+)*",
    nameEn: "Bloodlust (3+)",
    description: "Pour garder le contrôle de leur esprit, les Vampires ont besoin d'un approvisionnement en sang frais. Chaque fois qu'un joueur avec ce trait est activé, après avoir déclaré son action, il doit lancer un D6, en ajoutant 1 au jet s'il a déclaré une action de Blocage ou de Blitz. S'il obtient un résultat égal ou supérieur au nombre indiqué entre parenthèses (3+), il peut s'activer normalement. Si le joueur obtient un résultat inférieur au nombre indiqué entre parenthèses, ou obtient un 1 naturel, il peut choisir de mordre un coéquipier Thrall adjacent.",
    category: "Trait"
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
    nameFr: "Échasses à Ressort*",
    nameEn: "Pogo Stick",
    description: "Pendant son mouvement, au lieu de sauter par-dessus une seule case occupée par un joueur À Terre ou Étourdi, un joueur avec ce trait peut choisir de Sauter par-dessus n'importe quelle case adjacente, y compris les cases libres et les cases occupées par des joueurs Debout. De plus, lorsque ce joueur effectue un test d'Agilité pour sauter par-dessus un joueur À Terre ou Étourdi, ou pour Sauter par-dessus une case vide ou occupée par un joueur Debout, il peut appliquer un modificateur de +1.",
    category: "Trait"
  },
  {
    slug: "drunkard",
    nameFr: "Poivrot*",
    nameEn: "Drunkard",
    description: "Ce joueur subit une pénalité de -1 au jet de dé lorsqu'il tente de Foncer.",
    category: "Trait"
  },
  {
    slug: "animosity-underworld",
    nameFr: "Animosité (Underworld)*",
    nameEn: "Animosity (Underworld)",
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
    nameFr: "Vomissement Projectile*",
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
    nameFr: "Kick Team-mate*",
    nameEn: "Kick Team-mate",
    description: "Une fois par tour d'équipe, en plus d'un autre joueur effectuant soit une Passe soit une action de Lancer d'Équipier, un seul joueur avec ce trait sur l'équipe active peut effectuer une action Spéciale 'Kick Team-mate'.",
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

