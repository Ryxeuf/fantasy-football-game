/**
 * Types de météo et leurs tables de résultats
 */

export type WeatherType = 
  | 'classique'
  | 'printaniere'
  | 'estivale'
  | 'automnale'
  | 'hivernale'
  | 'souterraine'
  | 'foret-primordiale'
  | 'cimetiere'
  | 'terres-gastes'
  | 'montagnard'
  | 'cotiere'
  | 'desertique';

export interface WeatherCondition {
  condition: string;
  description: string;
}

export interface WeatherTypeDefinition {
  id: WeatherType;
  name: string;
  table: { [key: number]: WeatherCondition };
}

export const WEATHER_TYPES: WeatherTypeDefinition[] = [
  {
    id: 'classique',
    name: 'Classique',
    table: {
      2: { condition: 'Chaleur écrasante', description: 'Certains joueurs s\'évanouissent dans la chaleur insupportable ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve à la fin de chaque drive.' },
      3: { condition: 'Très ensoleillé', description: 'Un jour glorieux, mais le ciel clair et le soleil brillant interfèrent avec le jeu de passe ! -1 modificateur pour tous les tests de Passing Ability.' },
      4: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Ni trop froid ni trop chaud. Une journée chaude, sèche et légèrement nuageuse offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'Pluie battante', description: 'Une pluie torrentielle laisse les joueurs trempés et le ballon très glissant ! -1 modificateur pour tous les tests d\'Agilité pour attraper ou ramasser le ballon.' },
      12: { condition: 'Blizzard', description: 'Des conditions glaciales et de fortes chutes de neige rendent le terrain dangereux. -1 modificateur pour tous les Rush supplémentaires. Seuls les passes Rapides et Courtes sont possibles.' },
    },
  },
  {
    id: 'printaniere',
    name: 'Printanière',
    table: {
      2: { condition: 'Bourrasque de vent', description: 'Des vents violents perturbent le jeu. -1 modificateur pour tous les tests de Passing Ability.' },
      3: { condition: 'Pluie fine', description: 'Une pluie légère rend le terrain glissant. -1 modificateur pour tous les tests d\'Agilité pour attraper ou ramasser le ballon.' },
      4: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Un temps printanier agréable avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'Brouillard léger', description: 'Un brouillard léger réduit la visibilité. -1 modificateur pour tous les tests de Passing Ability.' },
      12: { condition: 'Averse', description: 'Une averse soudaine rend le terrain boueux. -1 modificateur pour tous les tests d\'Agilité.' },
    },
  },
  {
    id: 'estivale',
    name: 'Estivale',
    table: {
      2: { condition: 'Chaleur écrasante', description: 'Certains joueurs s\'évanouissent dans la chaleur insupportable ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve à la fin de chaque drive.' },
      3: { condition: 'Attaque de moustiques', description: 'Des nuées de moustiques gênent les joueurs. -1 modificateur pour tous les tests de Passing Ability.' },
      4: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Un bel été avec un soleil radieux offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'L\'œil des dieux', description: 'Les dieux observent le match avec bienveillance. Aucun modificateur, mais les joueurs se sentent inspirés.' },
      12: { condition: 'Canicule', description: 'Une chaleur extrême épuise les joueurs. D3 joueurs aléatoires de chaque équipe sont placés en Réserve à la fin de chaque drive.' },
    },
  },
  {
    id: 'automnale',
    name: 'Automnale',
    table: {
      2: { condition: 'Tempête de feuilles', description: 'Des feuilles mortes volent partout, gênant la visibilité. -1 modificateur pour tous les tests de Passing Ability.' },
      3: { condition: 'Pluie verglaçante', description: 'Une pluie froide rend le terrain glissant. -1 modificateur pour tous les tests d\'Agilité.' },
      4: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Un automne doux avec des couleurs magnifiques offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'Vent violent', description: 'Des vents forts perturbent le jeu. -1 modificateur pour tous les tests de Passing Ability.' },
      12: { condition: 'Giboulée', description: 'Une giboulée soudaine rend le terrain boueux. -1 modificateur pour tous les tests d\'Agilité.' },
    },
  },
  {
    id: 'hivernale',
    name: 'Hivernale',
    table: {
      2: { condition: 'Neige forte', description: 'Une neige abondante recouvre le terrain. -1 modificateur pour tous les tests d\'Agilité et de Movement.' },
      3: { condition: 'Verglas', description: 'Le terrain est recouvert de glace. -1 modificateur pour tous les tests d\'Agilité.' },
      4: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Un hiver doux avec un ciel dégagé offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'Givre', description: 'Le givre rend le terrain glissant. -1 modificateur pour tous les tests d\'Agilité.' },
      12: { condition: 'Blizzard', description: 'Des conditions glaciales et de fortes chutes de neige rendent le terrain dangereux. -1 modificateur pour tous les Rush supplémentaires. Seuls les passes Rapides et Courtes sont possibles.' },
    },
  },
  {
    id: 'souterraine',
    name: 'Souterraine',
    table: {
      2: { condition: 'Affaissement du plafond', description: 'Des pierres tombent du plafond ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
      3: { condition: 'Ambiance lugubre', description: 'L\'atmosphère oppressante gêne les joueurs. -1 modificateur pour tous les tests de Passing Ability.' },
      4: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Les tunnels offrent des conditions stables et parfaites pour Blood Bowl.' },
      11: { condition: 'Éboulement', description: 'Un éboulement partiel perturbe le terrain. -1 modificateur pour tous les tests d\'Agilité.' },
      12: { condition: 'Gaz toxiques', description: 'Des gaz toxiques s\'échappent des fissures. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
    },
  },
  {
    id: 'foret-primordiale',
    name: 'Forêt Primordiale',
    table: {
      2: { condition: 'Le cri des banshees', description: 'Les banshees hurlent, terrorisant les joueurs. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
      3: { condition: 'Nuée d\'insectes', description: 'Des insectes géants attaquent ! -1 modificateur pour tous les tests de Passing Ability.' },
      4: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'La forêt offre un environnement mystique et parfait pour Blood Bowl.' },
      11: { condition: 'Attaque des arbres', description: 'Les arbres s\'animent et attaquent ! -1 modificateur pour tous les tests d\'Agilité.' },
      12: { condition: 'Marais toxique', description: 'Le marais émet des vapeurs toxiques. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
    },
  },
  {
    id: 'cimetiere',
    name: 'Cimetière',
    table: {
      2: { condition: 'Âmes errantes en colère', description: 'Les esprits hantent le terrain. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
      3: { condition: 'Brouillard épais', description: 'Un brouillard épais réduit la visibilité. -1 modificateur pour tous les tests de Passing Ability.' },
      4: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Le cimetière offre une atmosphère sinistre mais stable pour Blood Bowl.' },
      11: { condition: 'Pluie battante', description: 'Une pluie torrentielle laisse les joueurs trempés et le ballon très glissant ! -1 modificateur pour tous les tests d\'Agilité pour attraper ou ramasser le ballon.' },
      12: { condition: 'Froid glacial', description: 'Un froid glacial engourdit les joueurs. -1 modificateur pour tous les tests d\'Agilité et de Movement.' },
    },
  },
  {
    id: 'terres-gastes',
    name: 'Terres Gâtes',
    table: {
      2: { condition: 'Désolation', description: 'La désolation règne. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
      3: { condition: 'Pluie radioactive', description: 'Une pluie radioactive contamine le terrain. -1 modificateur pour tous les tests d\'Agilité.' },
      4: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Les terres gâtes offrent un environnement stable et parfait pour Blood Bowl.' },
      11: { condition: 'Tempête de sable', description: 'Une tempête de sable aveugle les joueurs. -1 modificateur pour tous les tests de Passing Ability.' },
      12: { condition: 'Sécheresse', description: 'Une sécheresse extrême épuise les joueurs. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
    },
  },
  {
    id: 'montagnard',
    name: 'Montagnard',
    table: {
      2: { condition: 'Vent à décorner', description: 'Des vents violents soufflent depuis les sommets. -1 modificateur pour tous les tests de Passing Ability.' },
      3: { condition: 'Tempête de neige', description: 'Une tempête de neige recouvre le terrain. -1 modificateur pour tous les tests d\'Agilité.' },
      4: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'L\'air pur de la montagne offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'Avalanche', description: 'Une avalanche partielle perturbe le terrain. -1 modificateur pour tous les tests d\'Agilité.' },
      12: { condition: 'Tempête de glace', description: 'Une tempête de glace rend le terrain extrêmement dangereux. -1 modificateur pour tous les Rush supplémentaires. Seuls les passes Rapides et Courtes sont possibles.' },
    },
  },
  {
    id: 'cotiere',
    name: 'Côtière',
    table: {
      2: { condition: 'Vent violent', description: 'Des vents violents soufflent depuis la mer. -1 modificateur pour tous les tests de Passing Ability.' },
      3: { condition: 'Tempête', description: 'Une tempête s\'abat sur le terrain. -1 modificateur pour tous les tests d\'Agilité.' },
      4: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Le climat côtier offre des conditions parfaites pour Blood Bowl.' },
      11: { condition: 'Pluie torrentielle', description: 'Une pluie torrentielle laisse les joueurs trempés et le ballon très glissant ! -1 modificateur pour tous les tests d\'Agilité pour attraper ou ramasser le ballon.' },
      12: { condition: 'Raz-de-marée', description: 'Un raz-de-marée inonde partiellement le terrain. D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
    },
  },
  {
    id: 'desertique',
    name: 'Désertique',
    table: {
      2: { condition: 'Chaleur écrasante', description: 'Certains joueurs s\'évanouissent dans la chaleur insupportable ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve à la fin de chaque drive.' },
      3: { condition: 'Tempête de sable', description: 'Une tempête de sable aveugle les joueurs. -1 modificateur pour tous les tests de Passing Ability.' },
      4: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      5: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      6: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      7: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      8: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      9: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      10: { condition: 'Conditions parfaites', description: 'Le désert offre des conditions stables et parfaites pour Blood Bowl.' },
      11: { condition: 'Mirage', description: 'Des mirages perturbent la vision. -1 modificateur pour tous les tests de Passing Ability.' },
      12: { condition: 'Pluie de scorpions', description: 'Une pluie de scorpions s\'abat sur le terrain ! D3 joueurs aléatoires de chaque équipe sont placés en Réserve.' },
    },
  },
];

export function getWeatherType(id: WeatherType): WeatherTypeDefinition | undefined {
  return WEATHER_TYPES.find(type => type.id === id);
}

export function getWeatherCondition(weatherType: WeatherType, total: number): WeatherCondition | undefined {
  const type = getWeatherType(weatherType);
  if (!type) return undefined;
  return type.table[total];
}

