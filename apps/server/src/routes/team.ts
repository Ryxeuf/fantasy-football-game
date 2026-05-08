import { Router } from "express";
import { authUser } from "../middleware/authUser";
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

const router = Router();

// S27.8.33 — `ALLOWED_TEAMS` + `rosterTemplates` + handler
// `handleCreateFromRoster` extraits dans
// `routes/team-create-from-roster-handler.ts` (final extraction
// pour ramener `team.ts` sous DoD secondaire 400). Re-export pour
// preserver l'API publique.
export { handleCreateFromRoster } from './team-create-from-roster-handler';
import { handleCreateFromRoster as handleCreateFromRosterImpl } from './team-create-from-roster-handler';

router.post(
  "/create-from-roster",
  authUser,
  validate(createFromRosterSchema),
  handleCreateFromRosterImpl,
);


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
