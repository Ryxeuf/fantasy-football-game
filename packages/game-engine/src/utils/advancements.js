/**
 * Utilitaires d'avancement des joueurs (coûts PSP et surcoûts VE)
 * Référence: data/post-game*.md (table des avancements BB2020)
 */
// Tableau des coûts en SPP (PSP) par numéro d'avancement (1..6)
// Index 0 non utilisé pour aligner l'indice avec le numéro d'avancement
const SPP_COST_TABLE = {
    'primary': [0, 6, 8, 12, 16, 20, 30],           // "Choose a Primary" par avancement #1..#6
    'secondary': [0, 12, 14, 18, 22, 26, 40],      // "Choose a Secondary" par avancement #1..#6
    'random-primary': [0, 3, 4, 6, 8, 10, 15],      // "Randomly select a Primary" par avancement #1..#6
    'random-secondary': [0, 6, 8, 12, 16, 20, 30], // "Randomly select a Secondary" (même coût que Choose Primary)
};
// Surcoûts de valeur joueur par compétence selon les règles BB2020
// Référence: data/post-game-sequence.md - CURRENT VALUE INCREASE TABLE
export const SURCHARGE_PER_ADVANCEMENT = {
    primary: 20000,         // +20k po - Chosen Primary skill
    secondary: 40000,       // +40k po - Chosen Secondary skill
    'random-primary': 10000,     // +10k po - Randomly selected Primary skill
    'random-secondary': 20000,   // +20k po - Randomly selected Secondary skill
};
/**
 * Retourne le coût en PSP pour le prochain avancement donné le nombre d'avancements déjà acquis.
 * @param alreadyTaken nombre d'avancements déjà pris (0..6)
 * @param type 'primary', 'secondary', 'random-primary' ou 'random-secondary'
 */
export function getNextAdvancementPspCost(alreadyTaken, type) {
    const next = Math.min(Math.max(alreadyTaken + 1, 1), 6);
    return SPP_COST_TABLE[type][next];
}
/**
 * Calcule le surcoût total en po d'un ensemble d'avancements choisis.
 * @param advancements tableau des types d'avancement pris
 */
export function calculateAdvancementsSurcharge(advancements) {
    return advancements.reduce((sum, t) => sum + (SURCHARGE_PER_ADVANCEMENT[t] || 0), 0);
}
/**
 * Calcule la valeur courante d'un joueur = coût de base + surcoûts d'avancements
 * @param baseCostPo coût de base en po (ex: 85000)
 * @param advancements types d'avancements choisis
 */
export function calculatePlayerCurrentValue(baseCostPo, advancements) {
    return baseCostPo + calculateAdvancementsSurcharge(advancements);
}
/**
 * Vérifie si un type d'avancement est aléatoire
 */
export function isRandomAdvancement(type) {
    return type === 'random-primary' || type === 'random-secondary';
}
/**
 * Convertit un type d'avancement aléatoire en son équivalent non-aléatoire pour l'accès aux catégories
 */
export function getCategoryAccessType(type) {
    if (type === 'random-primary' || type === 'primary') {
        return 'primary';
    }
    return 'secondary';
}
