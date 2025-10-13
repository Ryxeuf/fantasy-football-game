/**
 * Calculateur de valeurs d'équipe selon les règles Blood Bowl
 */
/**
 * Obtient le coût d'une relance selon l'équipe
 */
export function getRerollCost(roster) {
    const rerollCosts = {
        // Coûts des relances selon les règles officielles Blood Bowl
        skaven: 50000, // 50k po selon les règles officielles
        lizardmen: 70000, // 70k po selon les règles officielles
        amazon: 60000, // 60k po selon les règles officielles
        underworld: 70000, // 70k po selon les règles officielles
        darkelf: 50000, // 50k po selon les règles officielles
        woodelf: 50000, // 50k po selon les règles officielles
        chaos: 60000, // 60k po selon les règles officielles
        gnome: 50000, // 50k po selon les règles officielles
        goblin: 60000, // 60k po selon les règles officielles
        halfling: 60000, // 60k po selon les règles officielles
        highelf: 50000, // 50k po selon les règles officielles
        necromantic: 70000, // 70k po selon les règles officielles
        human: 50000, // 50k po selon les règles officielles
        khorne: 60000, // 60k po selon les règles officielles
        undead: 70000, // 70k po selon les règles officielles
        dwarf: 50000, // 50k po selon les règles officielles
        chaosdwarf: 70000, // 70k po selon les règles officielles
        imperial: 70000, // 70k po selon les règles officielles
        norse: 60000, // 60k po selon les règles officielles
        ogre: 60000, // 60k po selon les règles officielles
        orc: 60000, // 60k po selon les règles officielles
        blackorc: 60000, // 60k po selon les règles officielles
        snotling: 60000, // 60k po selon les règles officielles
        tombkings: 70000, // 70k po selon les règles officielles
        vampire: 70000, // 70k po selon les règles officielles
        elvenunion: 50000, // 50k po selon les règles officielles
        oldworldalliance: 50000, // 50k po selon les règles officielles
        nurgle: 60000, // 60k po selon les règles officielles
        chaosrenegades: 60000, // 60k po selon les règles officielles
    };
    return rerollCosts[roster] || 50000; // Coût par défaut si équipe non trouvée
}
/**
 * Obtient tous les coûts des relances par équipe
 */
export function getAllRerollCosts() {
    return {
        // Coûts des relances selon les règles officielles Blood Bowl
        skaven: 50000, // 50k po selon les règles officielles
        lizardmen: 70000, // 70k po selon les règles officielles
        amazon: 60000, // 60k po selon les règles officielles
        underworld: 70000, // 70k po selon les règles officielles
        darkelf: 50000, // 50k po selon les règles officielles
        woodelf: 50000, // 50k po selon les règles officielles
        chaos: 60000, // 60k po selon les règles officielles
        gnome: 50000, // 50k po selon les règles officielles
        goblin: 60000, // 60k po selon les règles officielles
        halfling: 60000, // 60k po selon les règles officielles
        highelf: 50000, // 50k po selon les règles officielles
        necromantic: 70000, // 70k po selon les règles officielles
        human: 50000, // 50k po selon les règles officielles
        khorne: 60000, // 60k po selon les règles officielles
        undead: 70000, // 70k po selon les règles officielles
        dwarf: 50000, // 50k po selon les règles officielles
        chaosdwarf: 70000, // 70k po selon les règles officielles
        imperial: 70000, // 70k po selon les règles officielles
        norse: 60000, // 60k po selon les règles officielles
        ogre: 60000, // 60k po selon les règles officielles
        orc: 60000, // 60k po selon les règles officielles
        blackorc: 60000, // 60k po selon les règles officielles
        snotling: 60000, // 60k po selon les règles officielles
        tombkings: 70000, // 70k po selon les règles officielles
        vampire: 70000, // 70k po selon les règles officielles
        elvenunion: 50000, // 50k po selon les règles officielles
        oldworldalliance: 50000, // 50k po selon les règles officielles
        nurgle: 60000, // 60k po selon les règles officielles
        chaosrenegades: 60000, // 60k po selon les règles officielles
    };
}
/**
 * Calcule la VE (Valeur d'Équipe) selon les règles Blood Bowl
 * VE = Coût de tous les joueurs engagés + Coût du Staff + Relances
 */
export function calculateTeamValue(data) {
    const playersCost = data.players.reduce((total, player) => total + player.cost, 0);
    const staffCost = calculateStaffCost(data);
    const rerollsCost = data.rerolls * getRerollCost(data.roster);
    return playersCost + staffCost + rerollsCost;
}
/**
 * Calcule la VEA (Valeur d'Équipe Actuelle) selon les règles Blood Bowl
 * VEA = Coûts des joueurs disponibles + Coût du Staff + Relances
 */
export function calculateCurrentValue(data) {
    const availablePlayersCost = data.players
        .filter(player => player.available)
        .reduce((total, player) => total + player.cost, 0);
    const staffCost = calculateStaffCost(data);
    const rerollsCost = data.rerolls * getRerollCost(data.roster);
    return availablePlayersCost + staffCost + rerollsCost;
}
/**
 * Calcule le coût du staff de banc de touche
 */
function calculateStaffCost(data) {
    let cost = 0;
    // Cheerleaders: 10k po chacune
    cost += data.cheerleaders * 10000;
    // Assistants: 10k po chacun
    cost += data.assistants * 10000;
    // Apothicaire: 50k po
    if (data.apothecary) {
        cost += 50000;
    }
    // Fans Dévoués: 10k po chacun au-dessus du premier (gratuit)
    cost += (data.dedicatedFans - 1) * 10000;
    return cost;
}
/**
 * Calcule les gains après un match selon les règles Blood Bowl
 * Gains = (Fan Attendance / 2 + Touchdowns marqués) × 10,000 po
 */
export function calculateMatchWinnings(fanAttendance, touchdownsScored, conceded = false) {
    if (conceded) {
        // Si l'équipe a concédé, elle ne gagne rien
        return 0;
    }
    const baseWinnings = Math.floor(fanAttendance / 2) + touchdownsScored;
    return baseWinnings * 10000;
}
/**
 * Calcule la trésorerie après un match
 */
export function calculateTreasury(currentTreasury, winnings, expenses = 0) {
    return currentTreasury + winnings - expenses;
}
/**
 * Calcule toutes les valeurs d'équipe
 */
export function calculateAllValues(data) {
    return {
        teamValue: calculateTeamValue(data),
        currentValue: calculateCurrentValue(data),
        treasury: 0 // La trésorerie sera calculée après chaque match
    };
}
/**
 * Obtient le coût d'un joueur selon sa position et le roster
 */
export function getPlayerCost(position, roster) {
    // Coûts des joueurs selon les règles officielles Blood Bowl
    const costs = {
        skaven: {
            'Lineman': 50000,
            'Thrower': 85000,
            'Blitzer': 90000,
            'Gutter Runner': 85000,
            'Rat Ogre': 150000
        },
        lizardmen: {
            'Skink': 60000,
            'Chaméléon Skink': 70000,
            'Saurus': 85000,
            'Kroxigor': 140000
        },
        amazon: {
            'Linewoman': 50000,
            'Thrower': 80000,
            'Blitzer': 90000,
            'Bloker': 110000
        },
        underworld: {
            'Lineman': 50000,
            'Thrower': 70000,
            'Blitzer': 90000,
            'Mutant Rat Ogre': 150000
        },
        darkelf: {
            'Lineman': 70000,
            'Runner': 80000,
            'Blitzer': 100000,
            'Assassin': 85000,
            'Witch Elf': 110000
        },
        woodelf: {
            'Lineman': 70000,
            'Thrower': 95000,
            'Catcher': 90000,
            'Wardancer': 125000,
            'Treeman': 120000
        },
        chaos: {
            'Lineman': 50000,
            'Beastman': 60000,
            'Chaos Warrior': 100000,
            'Minotaur': 150000
        },
        gnome: {
            'Lineman': 40000,
            'Thrower': 60000,
            'Catcher': 50000,
            'Blitzer': 70000,
            'Treeman': 120000
        },
        goblin: {
            'Lineman': 40000,
            'Bomma': 45000,
            'Pogoer': 80000,
            'Fanatic': 70000,
            'Looney': 40000,
            'Trained Troll': 115000
        },
        halfling: {
            'Lineman': 30000,
            'Catcher': 35000,
            'Treeman': 120000
        },
        highelf: {
            'Lineman': 70000,
            'Thrower': 100000,
            'Catcher': 90000,
            'Blitzer': 100000
        },
        necromantic: {
            'Lineman': 40000,
            'Runner': 75000,
            'Wraith': 95000,
            'Werewolf': 125000,
            'Flesh Golem': 115000
        },
        human: {
            'Lineman': 50000,
            'Thrower': 70000,
            'Catcher': 65000,
            'Blitzer': 85000,
            'Ogre': 140000
        },
        khorne: {
            'Lineman': 50000,
            'Khorngor': 70000,
            'Bloodseeker': 110000,
            'Bloodspawn': 160000
        },
        undead: {
            'Skeleton': 40000,
            'Zombie': 40000,
            'Runner': 75000,
            'Blitzer': 90000,
            'Mummy': 125000
        },
        dwarf: {
            'Lineman': 70000,
            'Runner': 80000,
            'Blitzer': 80000,
            'Longbeard': 90000,
            'Deathroller': 170000
        },
        chaosdwarf: {
            'Lineman': 50000,
            'Blocker': 70000,
            'Blitzer': 130000,
            'Minotaur': 150000
        },
        imperial: {
            'Lineman': 45000,
            'Thrower': 75000,
            'Blitzer': 105000,
            'Bodyguard': 90000,
            'Ogre': 140000
        },
        norse: {
            'Lineman': 50000,
            'Runner': 70000,
            'Blitzer': 90000,
            'Ulfwerener': 105000,
            'Yhetee': 140000
        },
        ogre: {
            'Lineman': 50000,
            'Runt': 30000,
            'Ogre': 140000
        },
        orc: {
            'Lineman': 50000,
            'Thrower': 70000,
            'Blitzer': 80000,
            'Black Orc': 80000,
            'Troll': 110000
        },
        blackorc: {
            'Lineman': 60000,
            'Blitzer': 80000,
            'Troll': 110000
        },
        snotling: {
            'Lineman': 15000,
            'Pump Wagon': 120000,
            'Fungus': 200000
        },
        tombkings: {
            'Lineman': 40000,
            'Thrower': 70000,
            'Blitzer': 90000,
            'Mummy': 125000
        },
        vampire: {
            'Lineman': 40000,
            'Thrall': 40000,
            'Vampire': 110000
        },
        elvenunion: {
            'Lineman': 50000,
            'Thrower': 70000,
            'Catcher': 80000,
            'Blitzer': 100000
        },
        oldworldalliance: {
            'Lineman': 50000,
            'Thrower': 70000,
            'Catcher': 65000,
            'Blitzer': 85000
        },
        nurgle: {
            'Lineman': 50000,
            'Rotter': 40000,
            'Pestigor': 80000,
            'Beast': 140000
        },
        chaosrenegades: {
            'Lineman': 50000,
            'Marauder': 50000,
            'Renegade': 70000,
            'Mutant': 100000
        }
    };
    return costs[roster]?.[position] || 50000; // Coût par défaut
}
