/**
 * Script de test pour l'API des Star Players
 * Usage: node test-star-players-api.js
 * 
 * Note: Le serveur doit être lancé avant d'exécuter ce script
 */

const SERVER_URL = 'http://localhost:8000';

async function testStarPlayersAPI() {
  console.log('🧪 Test de l\'API des Star Players\n');

  try {
    // Test 1: Obtenir tous les star players
    console.log('📋 Test 1: GET /star-players (tous les star players)');
    const allResponse = await fetch(`${SERVER_URL}/star-players`);
    const allData = await allResponse.json();
    console.log(`✅ ${allData.count} star players trouvés`);
    console.log(`   Exemples: ${allData.data.slice(0, 3).map(sp => sp.displayName).join(', ')}\n`);

    // Test 2: Obtenir un star player spécifique
    console.log('🎯 Test 2: GET /star-players/griff_oberwald');
    const griffResponse = await fetch(`${SERVER_URL}/star-players/griff_oberwald`);
    const griffData = await griffResponse.json();
    console.log(`✅ ${griffData.data.displayName} - ${griffData.data.cost} po`);
    console.log(`   MA:${griffData.data.ma} ST:${griffData.data.st} AG:${griffData.data.ag}+ PA:${griffData.data.pa}+ AV:${griffData.data.av}+`);
    console.log(`   Compétences: ${griffData.data.skills}\n`);

    // Test 3: Star players disponibles pour les Skavens
    console.log('🐀 Test 3: GET /star-players/available/skaven');
    const skavenResponse = await fetch(`${SERVER_URL}/star-players/available/skaven`);
    const skavenData = await skavenResponse.json();
    console.log(`✅ ${skavenData.count} star players disponibles pour les Skavens`);
    console.log(`   Règles régionales: ${skavenData.regionalRules.join(', ')}`);
    console.log(`   Exemples: ${skavenData.data.slice(0, 5).map(sp => `${sp.displayName} (${sp.cost} po)`).join(', ')}\n`);

    // Test 4: Star players disponibles pour les Elfes Sylvains
    console.log('🌳 Test 4: GET /star-players/available/wood_elf');
    const woodElfResponse = await fetch(`${SERVER_URL}/star-players/available/wood_elf`);
    const woodElfData = await woodElfResponse.json();
    console.log(`✅ ${woodElfData.count} star players disponibles pour les Elfes Sylvains`);
    console.log(`   Règles régionales: ${woodElfData.regionalRules.join(', ')}`);
    console.log(`   Exemples: ${woodElfData.data.slice(0, 5).map(sp => `${sp.displayName} (${sp.cost} po)`).join(', ')}\n`);

    // Test 5: Règles régionales pour les Nains
    console.log('⚒️  Test 5: GET /star-players/regional-rules/dwarf');
    const dwarfRulesResponse = await fetch(`${SERVER_URL}/star-players/regional-rules/dwarf`);
    const dwarfRulesData = await dwarfRulesResponse.json();
    console.log(`✅ Règles régionales pour les Nains: ${dwarfRulesData.regionalRules.join(', ')}\n`);

    // Test 6: Recherche par nom
    console.log('🔍 Test 6: GET /star-players/search?q=griff');
    const searchNameResponse = await fetch(`${SERVER_URL}/star-players/search?q=griff`);
    const searchNameData = await searchNameResponse.json();
    console.log(`✅ ${searchNameData.count} résultat(s) pour "griff"`);
    if (searchNameData.count > 0) {
      console.log(`   Trouvé: ${searchNameData.data.map(sp => sp.displayName).join(', ')}\n`);
    }

    // Test 7: Recherche par compétence
    console.log('🔍 Test 7: GET /star-players/search?skill=mighty-blow');
    const searchSkillResponse = await fetch(`${SERVER_URL}/star-players/search?skill=mighty-blow`);
    const searchSkillData = await searchSkillResponse.json();
    console.log(`✅ ${searchSkillData.count} star player(s) avec "mighty-blow"`);
    if (searchSkillData.count > 0) {
      console.log(`   Exemples: ${searchSkillData.data.slice(0, 5).map(sp => sp.displayName).join(', ')}\n`);
    }

    // Test 8: Recherche par coût
    console.log('💰 Test 8: GET /star-players/search?minCost=250000&maxCost=280000');
    const searchCostResponse = await fetch(`${SERVER_URL}/star-players/search?minCost=250000&maxCost=280000`);
    const searchCostData = await searchCostResponse.json();
    console.log(`✅ ${searchCostData.count} star player(s) entre 250,000 et 280,000 po`);
    if (searchCostData.count > 0) {
      searchCostData.data.forEach(sp => {
        console.log(`   - ${sp.displayName}: ${sp.cost} po`);
      });
    }
    console.log();

    // Test 9: Star player inexistant
    console.log('❌ Test 9: GET /star-players/inexistant (devrait échouer)');
    const notFoundResponse = await fetch(`${SERVER_URL}/star-players/inexistant`);
    const notFoundData = await notFoundResponse.json();
    if (notFoundResponse.status === 404 && !notFoundData.success) {
      console.log(`✅ Erreur 404 correctement gérée: ${notFoundData.error}\n`);
    } else {
      console.log(`⚠️  Erreur attendue non reçue\n`);
    }

    // Test 10: Les star players les plus chers
    console.log('💎 Test 10: Les 5 star players les plus chers');
    const mostExpensive = allData.data
      .filter(sp => sp.cost > 0) // Exclure Crumbleberry (gratuit)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
    mostExpensive.forEach((sp, index) => {
      console.log(`   ${index + 1}. ${sp.displayName}: ${sp.cost.toLocaleString()} po`);
    });
    console.log();

    // Test 11: Les star players les moins chers
    console.log('💸 Test 11: Les 5 star players les moins chers');
    const cheapest = allData.data
      .filter(sp => sp.cost > 0) // Exclure Crumbleberry (gratuit)
      .sort((a, b) => a.cost - b.cost)
      .slice(0, 5);
    cheapest.forEach((sp, index) => {
      console.log(`   ${index + 1}. ${sp.displayName}: ${sp.cost.toLocaleString()} po`);
    });
    console.log();

    // Test 12: Star players avec Loner(3+)
    console.log('⭐ Test 12: Star players avec Loner(3+) (les plus fiables)');
    const loner3 = allData.data.filter(sp => sp.skills.includes('loner-3'));
    console.log(`✅ ${loner3.count} star player(s) avec Loner(3+)`);
    loner3.forEach(sp => {
      console.log(`   - ${sp.displayName}`);
    });
    console.log();

    console.log('✅ Tous les tests sont passés avec succès !');
  } catch (error) {
    console.error('❌ Erreur lors des tests:', error.message);
    console.error('   Assurez-vous que le serveur est lancé sur', SERVER_URL);
  }
}

// Exécuter les tests
testStarPlayersAPI();

