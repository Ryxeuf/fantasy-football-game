export interface SkillDescription {
  name: string;
  description: string;
  category: string;
}

export const SKILLS_DESCRIPTIONS: Record<string, SkillDescription> = {
  // GENERAL SKILLS
  "Blocage": {
    name: "Blocage",
    description: "Quand on obtient le résultat Les Deux Plaqués lors d'une action de Blocage, ce joueur peut choisir de l'ignorer et ne pas être Plaqué (voir page 57).",
    category: "General"
  },
  "Intrépide": {
    name: "Intrépide",
    description: "Quand ce joueur fait une action de Blocage (y compris pendant une action de Blitz), si la cible désignée a une caractéristique de Force supérieure à celle de ce joueur avant de compter les soutiens offensifs ou défensifs, mais après avoir appliqué les autres modificateurs, jetez un D6 et ajoutez la caractéristique de Force de ce joueur au résultat. Si le total est supérieur à la caractéristique de Force de la cible, ce joueur augmente sa caractéristique de Force jusqu'à être égale à celle de la cible de l'action de Blocage, avant de compter les soutiens offensifs ou défensifs, pour la durée de cette action de Blocage.",
    category: "General"
  },
  "Joueur Déloyal (+1)": {
    name: "Joueur Déloyal (+1)",
    description: "Quand ce joueur fait une action d'Agression, vous pouvez modifier soit le jet d'Armure, soit le jet de Blessure, effectué contre la victime, du montant indiqué entre parenthèses. Ce modificateur peut être appliqué après avoir fait le jet.",
    category: "General"
  },
  "Parade": {
    name: "Parade",
    description: "Si ce joueur est repoussé à cause d'un résultat de dé de blocage s'appliquant à lui, il peut choisir d'empêcher le joueur qui l'a repoussé de le poursuivre. Toutefois, le joueur qui l'a repoussé peut continuer de se déplacer s'il est en train de faire une action de Blitz s'il lui reste du Mouvement ou en Fonçant.",
    category: "General"
  },
  "Frénésie": {
    name: "Frénésie",
    description: "Chaque fois que ce joueur fait une action de Blocage (y compris pendant une action de Blitz), il doit poursuivre si la cible est repoussée et s'il en est capable. Si la cible est encore Debout après avoir été repoussée, et si ce joueur a pu poursuivre, il doit faire une seconde action de Blocage contre la même cible, et la poursuivre à nouveau si elle est repoussée.",
    category: "General"
  },
  "Frappe Précise": {
    name: "Frappe Précise",
    description: "Si ce joueur est désigné pour donner un coup d'envoi, vous pouvez décider de diviser par deux le résultat du D6 déterminant le nombre de cases sur lesquelles le ballon dévie, en arrondissant à l'entier inférieur.",
    category: "General"
  },
  "Pro": {
    name: "Pro",
    description: "Pendant son activation, ce joueur peut tenter de relancer 1 dé. Ce dé peut être celui d'un jet de dé unique, faire partie d'un jet de plusieurs dés, ou faire partie d'un groupe de dés, mais ne peut pas être un dé d'un jet d'Armure, de Blessure ni d'Élimination.",
    category: "General"
  },
  "Poursuite": {
    name: "Poursuite",
    description: "Ce joueur peut utiliser cette compétence quand un joueur adverse qu'il Marque se déplace volontairement hors d'une case située dans sa Zone de Tacle. Jetez un D6, ajoutez le MA de ce joueur au résultat et soustrayez ensuite le MA du joueur adverse. Si le résultat est de 6 ou plus, ce joueur peut immédiatement se déplacer dans la case libérée par le joueur adverse.",
    category: "General"
  },
  "Arracher le Ballon": {
    name: "Arracher le Ballon",
    description: "Si ce joueur fait tomber un joueur adverse lors d'une action de Blocage, le joueur adverse doit jeter un D6. Sur un résultat de 1, il lâche le ballon.",
    category: "General"
  },
  "Prise Sûre": {
    name: "Prise Sûre",
    description: "Ce joueur peut relancer n'importe quel dé lors d'une tentative de ramassage du ballon.",
    category: "General"
  },
  "Tacle": {
    name: "Tacle",
    description: "Quand un joueur adverse actif tente de faire un Esquive depuis une case dans laquelle il était Marqué par un ou plusieurs joueurs de votre équipe ayant cette compétence, ce joueur adverse ne peut pas utiliser la compétence Esquive.",
    category: "General"
  },
  "Lutte": {
    name: "Lutte",
    description: "Ce joueur peut utiliser cette compétence quand le résultat Les Deux Plaqués est appliqué, soit quand il effectue une action de Blocage, soit quand il est la cible d'une action de Blocage. Au lieu d'appliquer le résultat Les Deux Plaqués normalement, les deux joueurs sont Placés À Terre.",
    category: "General"
  },

  // AGILITY SKILLS
  "Réception": {
    name: "Réception",
    description: "Ce joueur peut relancer un test d'Agilité raté lors d'une tentative de réception du ballon.",
    category: "Agility"
  },
  "Réception Plongée": {
    name: "Réception Plongée",
    description: "Ce joueur peut tenter de réceptionner le ballon si une passe, une remise en jeu ou un coup d'envoi le fait atterrir dans une case située dans sa Zone de Tacle après dispersion ou déviation. De plus, ce joueur peut appliquer un modificateur de +1 à toute tentative de réceptionner une passe précise s'il occupe la case cible.",
    category: "Agility"
  },
  "Tacle Plongé": {
    name: "Tacle Plongé",
    description: "Si un joueur adverse actif qui tente de faire un Esquive, Saut ou Bond pour quitter une case dans laquelle il est Marqué par ce joueur réussit son test d'Agilité, vous pouvez déclarer que ce joueur va utiliser cette compétence. Votre adversaire doit immédiatement soustraire 2 au résultat du test d'Agilité.",
    category: "Agility"
  },
  "Esquive": {
    name: "Esquive",
    description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer un test d'Agilité raté lors d'une tentative d'Esquive. De plus, ce joueur peut choisir d'utiliser cette compétence quand il est la cible d'une action de Blocage et qu'un résultat de Trébuchement est appliqué contre lui.",
    category: "Agility"
  },
  "Compétences d'Agilité Défenseur": {
    name: "Compétences d'Agilité Défenseur",
    description: "Pendant le tour d'équipe de votre adversaire (mais pas pendant votre propre tour d'équipe), tous les joueurs adverses Marqués par ce joueur ne peuvent pas utiliser la compétence Garde.",
    category: "Agility"
  },
  "Rétablissement": {
    name: "Rétablissement",
    description: "Si ce joueur est À Terre, il peut se relever gratuitement. De plus, si ce joueur est À Terre quand il est activé, il peut tenter de se Rétablir et effectuer une action de Blocage. Ce joueur fait un test d'Agilité, en appliquant un modificateur de +1.",
    category: "Agility"
  },
  "Saut": {
    name: "Saut",
    description: "Pendant son mouvement, au lieu de sauter par-dessus une seule case occupée par un joueur À Terre ou Étourdi, un joueur avec cette compétence peut choisir de Sauter par-dessus n'importe quelle case adjacente, y compris les cases libres et les cases occupées par des joueurs Debout.",
    category: "Agility"
  },
  "Libération Contrôlée": {
    name: "Libération Contrôlée",
    description: "Si ce joueur est Renversé ou Placé À Terre alors qu'il est en possession du ballon, le ballon ne rebondit pas. Au lieu de cela, vous pouvez placer le ballon dans une case libre adjacente à celle qu'occupe ce joueur quand il devient À Terre.",
    category: "Agility"
  },
  "Glissade Contrôlée": {
    name: "Glissade Contrôlée",
    description: "Si ce joueur est repoussé pour quelque raison que ce soit, il n'est pas déplacé dans une case choisie par l'entraîneur adverse. Au lieu de cela, vous pouvez choisir n'importe quelle case libre adjacente à ce joueur.",
    category: "Agility"
  },
  "Sournois": {
    name: "Sournois",
    description: "Quand ce joueur effectue une action d'Agression, il n'est pas Expulsé pour avoir commis une Agression s'il obtient un double naturel sur le jet d'Armure. De plus, l'activation de ce joueur n'a pas besoin de se terminer une fois l'Agression commise.",
    category: "Agility"
  },
  "Sprint": {
    name: "Sprint",
    description: "Quand ce joueur effectue une action qui inclut du mouvement, il peut tenter de Foncer trois fois, plutôt que les deux habituelles.",
    category: "Agility"
  },
  "Équilibre": {
    name: "Équilibre",
    description: "Une fois par tour d'équipe, pendant son activation, ce joueur peut relancer le D6 lors d'une tentative de Foncer.",
    category: "Agility"
  },

  // MUTATIONS
  "Grande Main": {
    name: "Grande Main",
    description: "Ce joueur peut ignorer tout modificateur pour être Marqué ou pour les conditions météorologiques de Pluie Battante quand il tente de ramasser le ballon.",
    category: "Mutation"
  },
  "Griffes": {
    name: "Griffes",
    description: "Quand vous faites un jet d'Armure contre un joueur adverse qui a été Renversé à la suite d'une action de Blocage effectuée par ce joueur, un résultat de 8+ avant d'appliquer tout modificateur brisera son armure, peu importe sa valeur d'Armure réelle.",
    category: "Mutation"
  },
  "Présence Perturbante": {
    name: "Présence Perturbante",
    description: "Quand un joueur adverse effectue soit une action de Passe, soit une action de Lancer d'Équipier, soit une action Spéciale de Lancer de Bombe, ou tente soit d'interférer avec une passe soit de réceptionner le ballon, il doit appliquer un modificateur de -1 au test pour chaque joueur de votre équipe ayant cette compétence qui se trouve à trois cases de lui.",
    category: "Mutation"
  },
  "Bras Supplémentaires": {
    name: "Bras Supplémentaires",
    description: "Ce joueur peut appliquer un modificateur de +1 quand il tente de ramasser ou de réceptionner le ballon, ou quand il tente d'interférer avec une passe.",
    category: "Mutation"
  },
  "Répulsion*": {
    name: "Répulsion*",
    description: "Quand un joueur adverse déclare une action de Blocage ciblant ce joueur, son entraîneur doit d'abord jeter un D6. Sur un résultat de 1, le joueur ne peut pas effectuer l'action déclarée et l'action est gaspillée.",
    category: "Mutation"
  },
  "Cornes": {
    name: "Cornes",
    description: "Quand ce joueur effectue une action de Blocage dans le cadre d'une action de Blitz (mais pas seule), vous pouvez appliquer un modificateur de +1 à la caractéristique de Force de ce joueur.",
    category: "Mutation"
  },
  "Peau de Fer": {
    name: "Peau de Fer",
    description: "La compétence Griffes ne peut pas être utilisée lors d'un jet d'Armure contre ce joueur. Les joueurs adverses ne peuvent pas modifier les jets d'Armure effectués contre ce joueur.",
    category: "Mutation"
  },
  "Grande Gueule": {
    name: "Grande Gueule",
    description: "Ce joueur peut relancer toute tentative ratée de réceptionner le ballon. De plus, la compétence Arracher le Ballon ne peut pas être utilisée contre ce joueur.",
    category: "Mutation"
  },
  "Queue Préhensile": {
    name: "Queue Préhensile",
    description: "Quand un joueur adverse actif tente de faire un Esquive, Saut ou Bond pour quitter une case dans laquelle il est Marqué par ce joueur, il y a un modificateur supplémentaire de -1 appliqué au test d'Agilité du joueur actif.",
    category: "Mutation"
  },
  "Tentacules": {
    name: "Tentacules",
    description: "Ce joueur peut utiliser cette compétence quand un joueur adverse qu'il Marque se déplace volontairement hors d'une case située dans sa Zone de Tacle. Jetez un D6, ajoutez la FO de ce joueur au résultat et soustrayez ensuite la FO du joueur adverse. Si le résultat est de 6 ou plus, le joueur adverse est fermement retenu en place et son mouvement se termine.",
    category: "Mutation"
  },
  "Deux Têtes": {
    name: "Deux Têtes",
    description: "Ce joueur peut appliquer un modificateur de +1 au test d'Agilité quand il tente de faire un Esquive.",
    category: "Mutation"
  },
  "Très Longues Jambes": {
    name: "Très Longues Jambes",
    description: "Ce joueur peut réduire tout modificateur négatif appliqué au test d'Agilité quand il tente de Sauter par-dessus un joueur À Terre ou Étourdi de 1, jusqu'à un minimum de -1. De plus, ce joueur peut appliquer un modificateur de +2 à toute tentative d'interférer avec une passe qu'il effectue.",
    category: "Mutation"
  },

  // PASSING SKILLS
  "Précision": {
    name: "Précision",
    description: "Quand ce joueur effectue une action de Passe Rapide ou une action de Passe Courte, vous pouvez appliquer un modificateur supplémentaire de +1 au test de Capacité de Passe.",
    category: "Passing"
  },
  "Canonnier": {
    name: "Canonnier",
    description: "Quand ce joueur effectue une action de Passe Longue ou une action de Passe Bombe Longue, vous pouvez appliquer un modificateur supplémentaire de +1 au test de Capacité de Passe.",
    category: "Passing"
  },
  "Perce-Nuages": {
    name: "Perce-Nuages",
    description: "Quand ce joueur effectue une action de Passe Longue ou une action de Passe Bombe Longue, vous pouvez choisir de faire relancer à l'entraîneur adverse une tentative réussie d'interférer avec la passe.",
    category: "Passing"
  },
  "Délestage": {
    name: "Délestage",
    description: "Si ce joueur est désigné comme cible d'une action de Blocage et s'il est en possession du ballon, il peut immédiatement effectuer une action de Passe Rapide, interrompant l'activation du joueur adverse effectuant l'action de Blocage.",
    category: "Passing"
  },
  "Fumblerooskie": {
    name: "Fumblerooskie",
    description: "Quand ce joueur effectue une action de Mouvement ou de Blitz alors qu'il est en possession du ballon, il peut choisir de 'lâcher' le ballon. Le ballon peut être placé dans n'importe quelle case que le joueur quitte pendant son mouvement et ne rebondit pas.",
    category: "Passing"
  },
  "Passe Désespérée": {
    name: "Passe Désespérée",
    description: "Quand ce joueur effectue une action de Passe, la case cible peut être n'importe où sur le terrain et la règle de portée n'a pas besoin d'être utilisée. Une passe désespérée n'est jamais précise, peu importe le résultat du test de Capacité de Passe.",
    category: "Passing"
  },
  "Chef": {
    name: "Chef",
    description: "Une équipe qui a un ou plusieurs joueurs avec cette compétence gagne un seul relance d'équipe supplémentaire, appelé relance de Chef. Cependant, la relance de Chef ne peut être utilisée que s'il y a au moins un joueur avec cette compétence sur le terrain.",
    category: "Passing"
  },
  "Nerfs d'Acier": {
    name: "Nerfs d'Acier",
    description: "Ce joueur peut ignorer tout modificateur pour être Marqué quand il tente d'effectuer une action de Passe, tente de réceptionner le ballon ou tente d'interférer avec une passe.",
    category: "Passing"
  },
  "Sur le Ballon": {
    name: "Sur le Ballon",
    description: "Ce joueur peut se déplacer jusqu'à trois cases quand l'entraîneur adverse déclare qu'un de ses joueurs va effectuer une action de Passe. Ce mouvement est effectué après que la portée ait été mesurée et la case cible déclarée, mais avant que le joueur actif fasse un test de Capacité de Passe.",
    category: "Passing"
  },
  "Passe": {
    name: "Passe",
    description: "Ce joueur peut relancer un test de Capacité de Passe raté lors d'une action de Passe.",
    category: "Passing"
  },
  "Passe dans la Course": {
    name: "Passe dans la Course",
    description: "Si ce joueur effectue une action de Passe Rapide, son activation n'a pas besoin de se terminer une fois la passe résolue. Si vous le souhaitez et si ce joueur n'a pas utilisé sa totalité d'Allocation de Mouvement, il peut continuer à se déplacer après avoir résolu la passe.",
    category: "Passing"
  },
  "Passe Assurée": {
    name: "Passe Assurée",
    description: "Si ce joueur échoue une action de Passe, le ballon n'est pas lâché, ne rebondit pas depuis la case qu'occupe ce joueur, et aucun Renversement n'est causé. Au lieu de cela, ce joueur garde possession du ballon et son activation se termine.",
    category: "Passing"
  },

  // STRENGTH SKILLS
  "Clé de Bras": {
    name: "Clé de Bras",
    description: "Si un joueur adverse Tombe à la suite d'un échec de son test d'Agilité en tentant de faire un Esquive, Saut ou Bond pour quitter une case dans laquelle il était Marqué par ce joueur, vous pouvez appliquer un modificateur de +1 soit au jet d'Armure soit au jet de Blessure.",
    category: "Strength"
  },
  "Bagarreur": {
    name: "Bagarreur",
    description: "Quand ce joueur effectue une action de Blocage seule (mais pas dans le cadre d'une action de Blitz), ce joueur peut relancer un seul résultat Les Deux Plaqués.",
    category: "Strength"
  },
  "Esquive en Force": {
    name: "Esquive en Force",
    description: "Une fois pendant son activation, après avoir fait un test d'Agilité pour faire un Esquive, ce joueur peut modifier le jet de dé de +1 si sa caractéristique de Force est de 4 ou moins, ou de +2 si sa caractéristique de Force est de 5 ou plus.",
    category: "Strength"
  },
  "Projection": {
    name: "Projection",
    description: "Quand ce joueur effectue une action de Blocage, il peut choisir d'appliquer un résultat de Repoussement à n'importe quelle case adjacente à la cible, plutôt qu'à la case dans laquelle la cible était repoussée.",
    category: "Strength"
  },
  "Garde": {
    name: "Garde",
    description: "Ce joueur peut utiliser cette compétence quand un joueur adverse effectue une action de Blocage contre un coéquipier qui est adjacent à ce joueur. Ce joueur peut assister le coéquipier aux fins de cette action de Blocage.",
    category: "Strength"
  },
  "Boulet de Canon": {
    name: "Boulet de Canon",
    description: "Quand ce joueur effectue une action de Blocage, il peut choisir de traiter un résultat Les Deux Plaqués comme un résultat de Repoussement à la place.",
    category: "Strength"
  },
  "Coup Puissant": {
    name: "Coup Puissant",
    description: "Quand un joueur adverse est Renversé à la suite d'une action de Blocage effectuée par ce joueur, vous pouvez appliquer un modificateur de +1 soit au jet d'Armure soit au jet de Blessure effectué contre lui.",
    category: "Strength"
  },
  "Coup Puissant (+1)": {
    name: "Coup Puissant (+1)",
    description: "Quand un adversaire est Renversé à la suite d'une action de Blocage effectuée par ce joueur, le jet de Blessure effectué contre lui peut être modifié de +1. Ce modificateur peut être appliqué après que le jet ait été effectué.",
    category: "Strength"
  },
  "Blocage Multiple": {
    name: "Blocage Multiple",
    description: "Quand ce joueur effectue une action de Blocage, il peut cibler deux joueurs adverses adjacents au lieu d'un. Les deux cibles doivent être adjacentes à ce joueur et l'une à l'autre.",
    category: "Strength"
  },
  "Pilonneur": {
    name: "Pilonneur",
    description: "Quand un joueur adverse est Renversé à la suite d'une action de Blocage effectuée par ce joueur, vous pouvez appliquer un modificateur de +1 au jet de Blessure effectué contre lui.",
    category: "Strength"
  },
  "Stabilité": {
    name: "Stabilité",
    description: "Ce joueur peut choisir de ne pas être repoussé à la suite d'une action de Blocage. S'il choisit de ne pas être repoussé, il est Placé À Terre à la place.",
    category: "Strength"
  },
  "Bras Musclé": {
    name: "Bras Musclé",
    description: "Quand ce joueur effectue une action de Passe, vous pouvez réduire la portée d'un niveau (par exemple, une Passe Longue devient une Passe Courte).",
    category: "Strength"
  },
  "Crâne Épais": {
    name: "Crâne Épais",
    description: "Quand ce joueur est Renversé, vous pouvez appliquer un modificateur de +1 au jet de Blessure effectué contre lui.",
    category: "Strength"
  },

  // TRAITS
  "Sauvagerie Animale*": {
    name: "Sauvagerie Animale*",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur doit effectuer une action de Blocage contre un coéquipier adjacent aléatoire s'il y en a un présent.",
    category: "Trait"
  },
  "Tête de Bois": {
    name: "Tête de Bois",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  "Gros Débile*": {
    name: "Gros Débile*",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  "Régénération": {
    name: "Régénération",
    description: "Quand ce joueur est retiré du jeu à la suite d'un jet de Blessure, jetez un D6. Sur un résultat de 4+, ce joueur n'est pas retiré du jeu et peut revenir jouer plus tard dans le match.",
    category: "Trait"
  },
  "Poids Plume*": {
    name: "Poids Plume*",
    description: "Ce joueur peut être lancé par un coéquipier ayant la compétence Lancer d'Équipier.",
    category: "Trait"
  },
  "Microbe*": {
    name: "Microbe*",
    description: "Ce joueur peut faire un Esquive sur un résultat de 2+ au lieu de 3+. Cependant, ce joueur ne peut pas utiliser la compétence Esquive.",
    category: "Trait"
  },
  "Essaimage": {
    name: "Essaimage",
    description: "Ce joueur peut être placé sur le terrain au début du match même si cela dépasserait le nombre maximum de joueurs autorisés sur le terrain.",
    category: "Trait"
  },
  "Prendre Racine*": {
    name: "Prendre Racine*",
    description: "Au début de l'activation de ce joueur, jetez un D6. Sur un résultat de 1, ce joueur ne peut effectuer aucune action et son activation se termine immédiatement.",
    category: "Trait"
  },
  "Minus*": {
    name: "Minus*",
    description: "Ce joueur peut faire un Esquive sur un résultat de 2+ au lieu de 3+. Cependant, ce joueur ne peut pas utiliser la compétence Esquive.",
    category: "Trait"
  },
  "Solitaire (4+)*": {
    name: "Solitaire (4+)*",
    description: "Ce joueur ne peut utiliser les relances d'équipe que s'il obtient un 4+ sur un D6. S'il échoue à ce jet, il ne peut pas utiliser la relance d'équipe et le résultat original reste.",
    category: "Trait"
  },
  "Lancer d'Équipier": {
    name: "Lancer d'Équipier",
    description: "Ce joueur peut effectuer une action de Lancer d'Équipier. C'est une action de Passe qui peut être effectuée contre un coéquipier adjacent ayant le trait Poids Plume*.",
    category: "Trait"
  }
};

export function getSkillDescription(skillName: string): SkillDescription | null {
  return SKILLS_DESCRIPTIONS[skillName] || null;
}

export function parseSkills(skillsString: string): string[] {
  if (!skillsString || skillsString.trim() === "") {
    return [];
  }
  return skillsString.split(",").map(skill => skill.trim()).filter(skill => skill.length > 0);
}
