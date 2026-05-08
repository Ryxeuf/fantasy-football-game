import { Router } from "express";
import type { Response } from "express";
import { prisma } from "../prisma";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { sendError, sendSuccess } from "../utils/api-response";
import { updateTeamValues } from "../utils/team-values";
import {
  getPositionBySlug,
  getDisplayName,
  LEGACY_POSITION_MAPPING,
  type AllowedRoster,
  getStarPlayerBySlug,
  SURCHARGE_PER_ADVANCEMENT,
} from "@bb/game-engine";
import {
  validateStarPlayerPairs,
  validateStarPlayersForTeam,
  calculateStarPlayersCost,
} from "../utils/star-player-validation";
import { getRosterFromDb } from "../utils/roster-helpers";
import { resolveRuleset } from "../utils/ruleset-helpers";
import { validate } from "../middleware/validate";
import {
  createFromRosterSchema,
  buildTeamSchema,
  updateTeamSchema,
  updateTeamInfoSchema,
  purchaseSchema,
  addPlayerSchema,
  updatePlayerSkillsSchema,
  addStarPlayerToTeamSchema,
} from "../schemas/team.schemas";
import { chooseTeamSchema } from "../schemas/match.schemas";
import { serverLog } from "../utils/server-log";

const router = Router();
const ALLOWED_TEAMS = [
  "skaven", 
  "lizardmen", 
  "wood_elf",
  "dark_elf",
  "dwarf",
  "goblin",
  "undead",
  "chaos_renegade",
  "ogre",
  "halfling",
  "underworld",
  "chaos_chosen",
  "imperial_nobility",
  "necromantic_horror",
  "orc",
  "nurgle",
  "old_world_alliance",
  "elven_union",
  "human",
  "black_orc",
  "snotling",
  "chaos_dwarf",
  "slann",
  "amazon",
  "high_elf",
  "khorne",
  "vampire",
  "tomb_kings",
  "gnome",
  "norse"
] as const;

function rosterTemplates(roster: AllowedRoster) {
  if (roster === "skaven") {
    return [
      {
        position: "skaven_blitzer",
        count: 2,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "block",
      },
      {
        position: "skaven_thrower",
        count: 1,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      {
        position: "skaven_gutter_runner",
        count: 2,
        ma: 9,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "dodge",
      },
      {
        position: "skaven_lineman",
        count: 6,
        ma: 7,
        st: 3,
        ag: 3,
        pa: 4,
        av: 8,
        skills: "",
      },
      // Big Guy optionnel (non inclus par défaut)
    ];
  }
  
  if (roster === "wood_elf") {
    return [
      {
        position: "wood_elf_wardancer",
        count: 2,
        ma: 8,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "block,dodge,leap",
      },
      {
        position: "wood_elf_catcher",
        count: 2,
        ma: 8,
        st: 2,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "catch,dodge",
      },
      {
        position: "wood_elf_thrower",
        count: 1,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 2,
        av: 8,
        skills: "pass,sure-hands",
      },
      {
        position: "wood_elf_lineman",
        count: 6,
        ma: 7,
        st: 3,
        ag: 2,
        pa: 4,
        av: 8,
        skills: "",
      },
      // Treeman optionnel (non inclus par défaut)
    ];
  }
  
  // lizardmen
  return [
    {
      position: "lizardmen_saurus",
      count: 6,
      ma: 6,
      st: 4,
      ag: 4,
      pa: 6,
      av: 10,
      skills: "",
    },
    {
      position: "lizardmen_skink_runner",
      count: 4,
      ma: 8,
      st: 2,
      ag: 3,
      pa: 4,
      av: 8,
      skills: "dodge,stunty",
    },
    {
      position: "lizardmen_chameleon_skink",
      count: 1,
      ma: 7,
      st: 2,
      ag: 3,
      pa: 3,
      av: 8,
      skills: "dodge,on-the-ball,shadowing,stunty",
    },
    // Kroxigor optionnel (non inclus par défaut)
  ];
}

// O.8a — Générateur de noms d'équipe par roster.
// Public (pas d'auth) : aide à la création d'équipe, sans contenu sensible.
// (S25.5n — ApiResponse<T>)
// S27.8.22 — Handlers de lecture seule (name-generator / available /
// mine / rosters/:id) extraits dans `routes/team-readonly-handlers.ts`.
// Re-export pour preserver l'API publique consommee par les tests
// d'integration (`team.test.ts`).
export {
  handleGenerateTeamName,
  handleListAvailableTeams,
  handleListMyTeams,
  handleGetRoster,
} from './team-readonly-handlers';
import {
  handleGenerateTeamName as handleGenerateTeamNameImpl,
  handleListAvailableTeams as handleListAvailableTeamsImpl,
  handleListMyTeams as handleListMyTeamsImpl,
  handleGetRoster as handleGetRosterImpl,
} from './team-readonly-handlers';

router.get("/name-generator", handleGenerateTeamNameImpl);
router.get("/available", authUser, handleListAvailableTeamsImpl);
router.get("/mine", authUser, handleListMyTeamsImpl);
router.get("/rosters/:id", authUser, handleGetRosterImpl);

// Endpoint pour choisir une equipe pour un match (S25.5x — ApiResponse<T>)
// S27.8.26 — Handlers de selection / detail (choose / get-detail)
// extraits dans `routes/team-selection-handlers.ts`. Re-export pour
// preserver l'API publique consommee par `team.test.ts`.
export {
  handleChooseTeam,
  handleGetTeamDetail,
} from './team-selection-handlers';
import {
  handleChooseTeam as handleChooseTeamImpl,
  handleGetTeamDetail as handleGetTeamDetailImpl,
} from './team-selection-handlers';

router.post(
  "/choose",
  authUser,
  validate(chooseTeamSchema),
  handleChooseTeamImpl,
);
router.get("/:id", authUser, handleGetTeamDetailImpl);

router.post(
  "/create-from-roster",
  authUser,
  validate(createFromRosterSchema),
  async (req: AuthenticatedRequest, res) => {
    const {
      name,
      roster,
      teamValue,
      starPlayers: starPlayerSlugs,
      ruleset: bodyRuleset,
    } = req.body as {
      name: string;
      roster: string;
      teamValue?: number;
      starPlayers?: string[];
      ruleset?: string;
    };
    if (!ALLOWED_TEAMS.includes(roster as any))
      return res.status(400).json({ error: "Roster non autorisé" });

    const ruleset = resolveRuleset(bodyRuleset);

    const finalTeamValue = teamValue || 1000;

    // Valider les Star Players si fournis
    const starPlayersToHire = starPlayerSlugs || [];
    if (starPlayersToHire.length > 0) {
      // Valider les paires obligatoires
      const pairValidation = validateStarPlayerPairs(starPlayersToHire);
      if (!pairValidation.valid) {
        return res.status(400).json({ error: pairValidation.error });
      }

      // Calculer le nombre de joueurs du template
      const templates = rosterTemplates(roster);
      let playerCount = 0;
      for (const t of templates) {
        playerCount += t.count;
        if (playerCount >= 16) {
          playerCount = 16;
          break;
        }
      }
      playerCount = Math.max(11, playerCount); // Au moins 11 joueurs

      // Valider que Star Players + joueurs ne dépassent pas 16
      if (playerCount + starPlayersToHire.length > 16) {
        return res.status(400).json({ 
          error: `Trop de joueurs ! ${playerCount} joueurs + ${starPlayersToHire.length} Star Players = ${playerCount + starPlayersToHire.length} (maximum: 16)` 
        });
      }

      // Calculer le coût des Star Players
      const starPlayersCost = calculateStarPlayersCost(starPlayersToHire);
      const budgetInPo = finalTeamValue * 1000;
      
      if (starPlayersCost > budgetInPo) {
        return res.status(400).json({ 
          error: `Budget insuffisant pour les Star Players. Coût: ${(starPlayersCost / 1000).toLocaleString()} K po, budget: ${finalTeamValue} K po` 
        });
      }

      // Valider la disponibilité pour ce roster
      const validation = validateStarPlayersForTeam(
        starPlayersToHire,
        roster,
        playerCount,
        budgetInPo,
        ruleset,
      );
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    const team = await prisma.team.create({
      data: { 
        ownerId: req.user!.id, 
        name, 
        roster,
        ruleset,
        teamValue: finalTeamValue,
        initialBudget: finalTeamValue,
        treasury: 0,
        rerolls: 0,
        cheerleaders: 0,
        assistants: 0,
        apothecary: false,
        dedicatedFans: 1,
        currentValue: 0,
      },
    });

    // Créer les joueurs
    const templates = rosterTemplates(roster);
    const players: any[] = [];
    let number = 1;
    for (const t of templates) {
      for (let i = 0; i < t.count; i += 1) {
        players.push({
          teamId: team.id,
          name: `${t.position} ${i + 1}`,
          position: t.position,
          number: number++,
          ma: t.ma,
          st: t.st,
          ag: t.ag,
          pa: t.pa,
          av: t.av,
          skills: t.skills,
        });
        if (number > 16) break;
      }
      if (number > 16) break;
    }

    // Assurer au moins 11 joueurs
    while (players.length < 11) {
      players.push({
        teamId: team.id,
        name: `Lineman ${players.length + 1}`,
        position: "Lineman",
        number: players.length + 1,
        ma: 6,
        st: 3,
        ag: 3,
        pa: 4,
        av: 9,
        skills: "",
      });
    }
    
    await prisma.teamPlayer.createMany({ data: players.slice(0, 16) });

    // Recruter les Star Players si fournis
    if (starPlayersToHire.length > 0) {
      const starPlayersData = starPlayersToHire.map((slug: string) => {
        const sp = getStarPlayerBySlug(slug, ruleset);
        return {
          teamId: team.id,
          starPlayerSlug: slug,
          cost: sp?.cost || 0
        };
      });

      await prisma.teamStarPlayer.createMany({ data: starPlayersData });
    }
    
    // Calculer automatiquement les valeurs d'équipe
    await updateTeamValues(prisma, team.id);
    
    const withPlayers = await prisma.team.findUnique({
      where: { id: team.id },
      include: { 
        players: true,
        starPlayers: true
      },
    });

    // Enrichir les Star Players
    const enrichedTeam = {
      ...withPlayers,
      starPlayers: withPlayers?.starPlayers.map((sp: any) => {
        const starPlayerData = getStarPlayerBySlug(sp.starPlayerSlug, withPlayers.ruleset);
        return {
          id: sp.id,
          slug: sp.starPlayerSlug,
          cost: sp.cost,
          hiredAt: sp.hiredAt,
          ...starPlayerData
        };
      }) || []
    };

    res.status(201).json({ team: enrichedTeam });
  },
);

// Endpoint pour creer une equipe via le team-builder (S25.5ad — ApiResponse<T>)
// S27.8.27 — handleBuildTeam extrait dans
// `routes/team-build-handler.ts`. Re-export pour preserver l'API
// publique consommee par `team.test.ts`.
export { handleBuildTeam } from './team-build-handler';
import { handleBuildTeam as handleBuildTeamImpl } from './team-build-handler';

router.post("/build", authUser, validate(buildTeamSchema), handleBuildTeamImpl);

// Endpoint pour mettre a jour les informations d'equipe (S25.5u — ApiResponse<T>)
// S27.8.25 — Handlers de mutation team (info / recalculate / update)
// extraits dans `routes/team-mutation-handlers.ts`. Re-export pour
// preserver l'API publique consommee par `team.test.ts`.
export {
  handlePutTeamInfo,
  handleRecalculateTeam,
  handleUpdateTeam,
} from './team-mutation-handlers';
import {
  handlePutTeamInfo as handlePutTeamInfoImpl,
  handleRecalculateTeam as handleRecalculateTeamImpl,
  handleUpdateTeam as handleUpdateTeamImpl,
} from './team-mutation-handlers';

router.put(
  "/:id/info",
  authUser,
  validate(updateTeamInfoSchema),
  handlePutTeamInfoImpl,
);
router.post("/:id/recalculate", authUser, handleRecalculateTeamImpl);
router.put("/:id", authUser, validate(updateTeamSchema), handleUpdateTeamImpl);

// S27.8.24 — Handlers Player CRUD (add / delete / update-skills /
// list-available-positions) extraits dans
// `routes/team-player-handlers.ts`. Re-export pour preserver l'API
// publique consommee par les tests d'integration (`team.test.ts`).
export {
  handleAddTeamPlayer,
  handleDeleteTeamPlayer,
  handleUpdatePlayerSkills,
  handleListAvailablePositions,
} from './team-player-handlers';
import {
  handleAddTeamPlayer as handleAddTeamPlayerImpl,
  handleDeleteTeamPlayer as handleDeleteTeamPlayerImpl,
  handleUpdatePlayerSkills as handleUpdatePlayerSkillsImpl,
  handleListAvailablePositions as handleListAvailablePositionsImpl,
} from './team-player-handlers';

router.post(
  "/:id/players",
  authUser,
  validate(addPlayerSchema),
  handleAddTeamPlayerImpl,
);
router.delete(
  "/:id/players/:playerId",
  authUser,
  handleDeleteTeamPlayerImpl,
);
router.put(
  "/:id/players/:playerId/skills",
  authUser,
  validate(updatePlayerSkillsSchema),
  handleUpdatePlayerSkillsImpl,
);
router.get(
  "/:id/available-positions",
  authUser,
  handleListAvailablePositionsImpl,
);

// =============================================================================
// STAR PLAYERS ENDPOINTS
// =============================================================================

// S27.8.23 — Handlers Star Players (list / list available / hire /
// delete) extraits dans `routes/team-star-player-handlers.ts`.
// Re-export pour preserver l'API publique consommee par les tests
// d'integration (`team.test.ts`).
export {
  handleListTeamStarPlayers,
  handleListAvailableStarPlayers,
  handleHireStarPlayer,
  handleDeleteTeamStarPlayer,
} from './team-star-player-handlers';
import {
  handleListTeamStarPlayers as handleListTeamStarPlayersImpl,
  handleListAvailableStarPlayers as handleListAvailableStarPlayersImpl,
  handleHireStarPlayer as handleHireStarPlayerImpl,
  handleDeleteTeamStarPlayer as handleDeleteTeamStarPlayerImpl,
} from './team-star-player-handlers';

router.get("/:id/star-players", authUser, handleListTeamStarPlayersImpl);
router.get(
  "/:id/available-star-players",
  authUser,
  handleListAvailableStarPlayersImpl,
);
router.post(
  "/:id/star-players",
  authUser,
  validate(addStarPlayerToTeamSchema),
  handleHireStarPlayerImpl,
);
router.delete(
  "/:id/star-players/:starPlayerId",
  authUser,
  handleDeleteTeamStarPlayerImpl,
);

// Endpoint pour acheter avec la trésorerie (entre les matchs)
// Endpoint pour acheter avec la tresorerie (S25.5w — ApiResponse<T>)
// S27.8.28 — handlePurchase extrait dans
// `routes/team-purchase-handler.ts`. Re-export pour preserver l'API
// publique consommee par `team.test.ts`.
export { handlePurchase } from './team-purchase-handler';
import { handlePurchase as handlePurchaseImpl } from './team-purchase-handler';

router.post(
  "/:id/purchase",
  authUser,
  validate(purchaseSchema),
  handlePurchaseImpl,
);

export default router;
