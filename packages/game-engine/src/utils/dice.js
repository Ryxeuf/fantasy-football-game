/**
 * Système de jets de dés pour Blood Bowl
 * Gère tous les types de dés : D6, 2D6, dés de blocage, etc.
 */
/**
 * Lance un dé à 6 faces
 * @param rng - Générateur de nombres aléatoires
 * @returns Un nombre entre 1 et 6
 */
export function rollD6(rng) {
    return Math.floor(rng() * 6) + 1;
}
/**
 * Lance deux dés à 6 faces
 * @param rng - Générateur de nombres aléatoires
 * @returns Un nombre entre 2 et 12
 */
export function roll2D6(rng) {
    return rollD6(rng) + rollD6(rng);
}
/**
 * Calcule le target pour un jet d'esquive
 * @param player - Le joueur qui fait le jet
 * @param modifiers - Modificateurs (positifs améliorent le jet)
 * @returns Le target (entre 2 et 6)
 */
export function calculateDodgeTarget(player, modifiers = 0) {
    // Target = AG - modifiers (modificateurs positifs améliorent le jet)
    return Math.max(2, Math.min(6, player.ag - modifiers));
}
/**
 * Effectue un jet d'esquive
 * @param player - Le joueur qui fait le jet
 * @param rng - Générateur de nombres aléatoires
 * @param modifiers - Modificateurs
 * @returns Le résultat du jet d'esquive
 */
export function performDodgeRoll(player, rng, modifiers = 0) {
    const diceRoll = rollD6(rng);
    const targetNumber = calculateDodgeTarget(player, modifiers);
    const success = diceRoll >= targetNumber;
    return {
        type: 'dodge',
        playerId: player.id,
        diceRoll,
        targetNumber,
        success,
        modifiers,
    };
}
/**
 * Calcule le target pour un jet d'armure
 * @param player - Le joueur qui fait le jet
 * @param modifiers - Modificateurs (positifs rendent l'armure plus difficile à percer)
 * @returns Le target (entre 2 et 12)
 */
export function calculateArmorTarget(player, modifiers = 0) {
    // En Blood Bowl, le jet d'armure se fait sur 2D6
    // L'armure est percée si le résultat est >= à la valeur d'armure du joueur
    // Les modificateurs positifs rendent l'armure plus difficile à percer (augmentent la valeur cible)
    // La valeur de base est l'armure du joueur (av), et on ajoute les modificateurs positifs
    return Math.min(12, player.av + modifiers);
}
/**
 * Effectue un jet d'armure
 * @param player - Le joueur qui fait le jet
 * @param rng - Générateur de nombres aléatoires
 * @param modifiers - Modificateurs
 * @returns Le résultat du jet d'armure
 */
export function performArmorRoll(player, rng, modifiers = 0) {
    const diceRoll = roll2D6(rng);
    const targetNumber = calculateArmorTarget(player, modifiers);
    // En Blood Bowl, l'armure est percée (échec) si le résultat est >= à la valeur d'armure
    // Donc success = false si diceRoll >= targetNumber
    const success = diceRoll < targetNumber;
    return {
        type: 'armor',
        playerId: player.id,
        diceRoll,
        targetNumber,
        success,
        modifiers,
    };
}
/**
 * Calcule le target pour un jet de ramassage de balle
 * @param player - Le joueur qui fait le jet
 * @param modifiers - Modificateurs (positifs améliorent le jet)
 * @returns Le target (entre 2 et 6)
 */
export function calculatePickupTarget(player, modifiers = 0) {
    // Target = AG - modifiers (modificateurs positifs améliorent le jet)
    return Math.max(2, Math.min(6, player.ag - modifiers));
}
/**
 * Effectue un jet de ramassage de balle
 * @param player - Le joueur qui fait le jet
 * @param rng - Générateur de nombres aléatoires
 * @param modifiers - Modificateurs
 * @returns Le résultat du jet de ramassage
 */
export function performPickupRoll(player, rng, modifiers = 0) {
    const diceRoll = rollD6(rng);
    const targetNumber = calculatePickupTarget(player, modifiers);
    const success = diceRoll >= targetNumber;
    return {
        type: 'pickup',
        playerId: player.id,
        diceRoll,
        targetNumber,
        success,
        modifiers,
    };
}
/**
 * Lance un dé de blocage
 * @param rng - Générateur de nombres aléatoires
 * @returns Un résultat de blocage
 */
export function rollBlockDice(rng) {
    const roll = Math.floor(rng() * 6) + 1; // 1-6 pour les 6 faces du dé de blocage
    switch (roll) {
        case 1:
            return 'PLAYER_DOWN';
        case 2:
            return 'BOTH_DOWN';
        case 3:
            return 'PUSH_BACK'; // Première face Push Back
        case 4:
            return 'STUMBLE';
        case 5:
            return 'POW';
        case 6:
            return 'PUSH_BACK'; // Deuxième face Push Back (dupliquée)
        default:
            return 'PUSH_BACK'; // Ne devrait jamais arriver
    }
}
/**
 * Lance plusieurs dés de blocage
 * @param rng - Générateur de nombres aléatoires
 * @param count - Nombre de dés à lancer
 * @returns Un tableau de résultats de blocage
 */
export function rollBlockDiceMany(rng, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(rollBlockDice(rng));
    }
    return results;
}
/**
 * Lance plusieurs dés de blocage avec les valeurs des dés
 * @param rng - Générateur de nombres aléatoires
 * @param count - Nombre de dés à lancer
 * @returns Un tableau d'objets contenant la valeur du dé et le résultat
 */
export function rollBlockDiceManyWithRolls(rng, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        const diceRoll = Math.floor(rng() * 6) + 1; // 1-6 pour les 6 faces du dé de blocage
        const result = rollBlockDice(rng);
        results.push({ diceRoll, result });
    }
    return results;
}
/**
 * Effectue un jet de blocage complet
 * @param attacker - Le joueur attaquant
 * @param target - Le joueur cible
 * @param rng - Générateur de nombres aléatoires
 * @param offensiveAssists - Nombre d'assists offensives
 * @param defensiveAssists - Nombre d'assists défensives
 * @returns Le résultat complet du blocage
 */
export function performBlockRoll(attacker, target, rng, offensiveAssists, defensiveAssists) {
    const attackerStrength = attacker.st + offensiveAssists;
    const targetStrength = target.st + defensiveAssists;
    // Pour simplifier, on lance un seul dé et on prend le résultat
    // Dans un vrai jeu, on lancerait plusieurs dés et le chooser sélectionnerait
    const diceRoll = Math.floor(rng() * 6) + 1; // 1-6 pour les 6 faces du dé de blocage
    const result = rollBlockDice(rng);
    return {
        type: 'block',
        playerId: attacker.id,
        targetId: target.id,
        diceRoll,
        result,
        offensiveAssists,
        defensiveAssists,
        totalStrength: attackerStrength,
        targetStrength: targetStrength,
    };
}
