#!/usr/bin/env node

/**
 * Test de création d'équipes avec Star Players
 * 
 * Ce script teste les nouveaux endpoints de création d'équipes avec Star Players intégrés.
 */

const API_BASE = "http://localhost:3001";

// Fonction helper pour les requêtes
async function apiRequest(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();
  return { status: response.status, data };
}

// Fonction helper pour logger les résultats
function logResult(testName, success, details) {
  const emoji = success ? "✅" : "❌";
  console.log(`\n${emoji} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
}

async function runTests() {
  console.log("=".repeat(60));
  console.log("TEST : CRÉATION D'ÉQUIPES AVEC STAR PLAYERS");
  console.log("=".repeat(60));

  let authToken = null;

  // Test 1: Connexion
  console.log("\n📝 Test 1: Connexion utilisateur");
  try {
    const loginRes = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: "test",
        password: "test123",
      }),
    });

    if (loginRes.status === 200 && loginRes.data.token) {
      authToken = loginRes.data.token;
      logResult("Connexion réussie", true, `Token: ${authToken.substring(0, 20)}...`);
    } else {
      logResult("Connexion échouée", false, JSON.stringify(loginRes.data));
      return;
    }
  } catch (error) {
    logResult("Connexion échouée", false, error.message);
    return;
  }

  const authHeaders = { Authorization: `Bearer ${authToken}` };

  // Test 2: Création d'équipe Skaven avec Star Players (create-from-roster)
  console.log("\n📝 Test 2: Création d'équipe Skaven avec Hakflem via create-from-roster");
  try {
    const teamRes = await apiRequest("/team/create-from-roster", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Les Ratiers avec Hakflem",
        roster: "skaven",
        teamValue: 1500,
        starPlayers: ["hakflem_skuttlespike"],
      }),
    });

    if (teamRes.status === 201 && teamRes.data.team) {
      const team = teamRes.data.team;
      const hasStarPlayers = team.starPlayers && team.starPlayers.length > 0;
      const hakflem = team.starPlayers?.find(sp => sp.slug === "hakflem_skuttlespike");
      
      logResult(
        "Équipe Skaven créée avec Star Player", 
        hasStarPlayers && hakflem,
        `Équipe: ${team.name}, Star Players: ${team.starPlayers.length}, Joueurs: ${team.players.length}`
      );

      if (hakflem) {
        console.log(`   → Hakflem: ${hakflem.displayName}, Coût: ${hakflem.cost / 1000}K po`);
      }
    } else {
      logResult("Création d'équipe échouée", false, JSON.stringify(teamRes.data));
    }
  } catch (error) {
    logResult("Création d'équipe échouée", false, error.message);
  }

  // Test 3: Création d'équipe Goblin avec paire Grak & Crumbleberry (build)
  console.log("\n📝 Test 3: Création d'équipe Goblin avec Grak & Crumbleberry via build");
  try {
    const teamRes = await apiRequest("/team/build", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Les Gobelins avec Grak",
        roster: "goblin",
        teamValue: 1500,
        choices: [
          { key: "goblin_lineman", count: 11 },
        ],
        starPlayers: ["grak", "crumbleberry"],
      }),
    });

    if (teamRes.status === 201 && teamRes.data.team) {
      const team = teamRes.data.team;
      const hasGrak = team.starPlayers?.find(sp => sp.slug === "grak");
      const hasCrumbleberry = team.starPlayers?.find(sp => sp.slug === "crumbleberry");
      
      logResult(
        "Équipe Goblin créée avec paire Grak & Crumbleberry", 
        hasGrak && hasCrumbleberry,
        `Star Players: ${team.starPlayers.length}, Breakdown: ${JSON.stringify(teamRes.data.breakdown)}`
      );

      if (hasGrak) {
        console.log(`   → Grak: ${hasGrak.displayName}, Coût: ${hasGrak.cost / 1000}K po`);
      }
      if (hasCrumbleberry) {
        console.log(`   → Crumbleberry: ${hasCrumbleberry.displayName}, Coût: ${hasCrumbleberry.cost / 1000}K po`);
      }
    } else {
      logResult("Création d'équipe échouée", false, JSON.stringify(teamRes.data));
    }
  } catch (error) {
    logResult("Création d'équipe échouée", false, error.message);
  }

  // Test 4: Tentative de création avec paire incomplète (doit échouer)
  console.log("\n📝 Test 4: Tentative de création avec paire incomplète (Grak sans Crumbleberry)");
  try {
    const teamRes = await apiRequest("/team/build", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test paire invalide",
        roster: "goblin",
        teamValue: 1500,
        choices: [
          { key: "goblin_lineman", count: 11 },
        ],
        starPlayers: ["grak"], // Manque crumbleberry
      }),
    });

    if (teamRes.status === 400) {
      logResult(
        "Validation de paire fonctionne", 
        true,
        `Erreur attendue: ${teamRes.data.error}`
      );
    } else {
      logResult("Validation de paire échouée", false, "La paire incomplète aurait dû être rejetée");
    }
  } catch (error) {
    logResult("Test de validation échoué", false, error.message);
  }

  // Test 5: Tentative de dépassement de budget (doit échouer)
  console.log("\n📝 Test 5: Tentative de dépassement de budget");
  try {
    const teamRes = await apiRequest("/team/build", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test budget dépassé",
        roster: "skaven",
        teamValue: 1000, // Petit budget
        choices: [
          { key: "skaven_lineman", count: 11 },
        ],
        starPlayers: ["hakflem_skuttlespike", "headsplitter"], // Trop cher ensemble
      }),
    });

    if (teamRes.status === 400) {
      logResult(
        "Validation de budget fonctionne", 
        true,
        `Erreur attendue: ${teamRes.data.error}`
      );
    } else {
      logResult("Validation de budget échouée", false, "Le dépassement de budget aurait dû être rejeté");
    }
  } catch (error) {
    logResult("Test de validation échoué", false, error.message);
  }

  // Test 6: Tentative de dépassement de limite de 16 joueurs (doit échouer)
  console.log("\n📝 Test 6: Tentative de dépassement de limite de 16 joueurs");
  try {
    const teamRes = await apiRequest("/team/build", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test limite 16 joueurs",
        roster: "goblin",
        teamValue: 2000,
        choices: [
          { key: "goblin_lineman", count: 16 }, // 16 joueurs
        ],
        starPlayers: ["grak", "crumbleberry"], // +2 = 18 total
      }),
    });

    if (teamRes.status === 400) {
      logResult(
        "Validation de limite de joueurs fonctionne", 
        true,
        `Erreur attendue: ${teamRes.data.error}`
      );
    } else {
      logResult("Validation de limite échouée", false, "Le dépassement de 16 joueurs aurait dû être rejeté");
    }
  } catch (error) {
    logResult("Test de validation échoué", false, error.message);
  }

  // Test 7: Création d'équipe Halfling avec Deeproot Strongbranch
  console.log("\n📝 Test 7: Création d'équipe Halfling avec Deeproot Strongbranch");
  try {
    const teamRes = await apiRequest("/team/create-from-roster", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Les Demi-Hommes avec Deeproot",
        roster: "halfling",
        teamValue: 1500,
        starPlayers: ["deeproot_strongbranch"],
      }),
    });

    if (teamRes.status === 201 && teamRes.data.team) {
      const team = teamRes.data.team;
      const deeproot = team.starPlayers?.find(sp => sp.slug === "deeproot_strongbranch");
      
      logResult(
        "Équipe Halfling créée avec Deeproot", 
        deeproot !== undefined,
        `Star Players: ${team.starPlayers.length}`
      );

      if (deeproot) {
        console.log(`   → Deeproot: ${deeproot.displayName}, Coût: ${deeproot.cost / 1000}K po`);
        console.log(`   → Caractéristiques: MA ${deeproot.ma}, ST ${deeproot.st}, AG ${deeproot.ag}, AV ${deeproot.av}`);
      }
    } else {
      logResult("Création d'équipe échouée", false, JSON.stringify(teamRes.data));
    }
  } catch (error) {
    logResult("Création d'équipe échouée", false, error.message);
  }

  // Test 8: Tentative de recruter un Star Player non disponible pour le roster
  console.log("\n📝 Test 8: Tentative de recruter un Star Player non disponible");
  try {
    const teamRes = await apiRequest("/team/build", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Test Star Player indisponible",
        roster: "halfling",
        teamValue: 1500,
        choices: [
          { key: "halfling_hopeful", count: 11 },
        ],
        starPlayers: ["hakflem_skuttlespike"], // Skaven uniquement
      }),
    });

    if (teamRes.status === 400) {
      logResult(
        "Validation de disponibilité régionale fonctionne", 
        true,
        `Erreur attendue: ${teamRes.data.error}`
      );
    } else {
      logResult("Validation de disponibilité échouée", false, "Le Star Player indisponible aurait dû être rejeté");
    }
  } catch (error) {
    logResult("Test de validation échoué", false, error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("TESTS TERMINÉS");
  console.log("=".repeat(60));
}

// Exécuter les tests
runTests().catch(console.error);

