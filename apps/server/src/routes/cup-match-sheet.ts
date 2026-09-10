/**
 * Feuille de match d'une rencontre de COUPE.
 *
 * Ces routes montent EXACTEMENT les mêmes handlers que la ligue
 * (`routes/league.ts`) : la feuille est la même, sa saisie est la même, et
 * seule la compétition d'origine change ce que la validation écrit
 * (`services/competition-match-sheet-context`). Les handlers ne connaissent
 * que `:pairingId` — la résolution polymorphe fait le reste.
 *
 * Dupliquer la saisie côté coupe aurait recréé une deuxième mécanique qui
 * aurait dérivé de la première ; ici, un correctif de feuille profite aux
 * deux compétitions le jour où il est écrit.
 *
 * Monté sur `/cup` AVANT `cupRoutes`, dont le `GET /:id` avalerait
 * `/pairings/...`.
 */

import { Router } from "express";
import { authUser } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import {
  handleAddMatchSheetEvent,
  handleCanInvalidate,
  handleCreateMatchSheet,
  handleGetMatchSheet,
  handleInvalidateMatchSheet,
  handleRemoveMatchSheetEvent,
  handleRollJourneymanRandomPrimary,
  handleSubmitMatchSheet,
  handleUnsubmitMatchSheet,
  handleUpdatePostMatch,
  handleUpdatePreMatch,
  handleValidateMatchSheet,
} from "./league";
import {
  addEventSchema,
  invalidateSheetSchema,
  postMatchSchema,
  preMatchSchema,
} from "../schemas/league-match-sheet.schemas";
import { rollRandomPrimarySchema } from "../schemas/advancement.schemas";

const router = Router();

router.get("/pairings/:pairingId/sheet", authUser, handleGetMatchSheet);
router.post("/pairings/:pairingId/sheet", authUser, handleCreateMatchSheet);
router.patch(
  "/pairings/:pairingId/sheet/pre-match",
  authUser,
  validate(preMatchSchema),
  handleUpdatePreMatch,
);
router.patch(
  "/pairings/:pairingId/sheet/post-match",
  authUser,
  validate(postMatchSchema),
  handleUpdatePostMatch,
);
router.post(
  "/pairings/:pairingId/sheet/events",
  authUser,
  validate(addEventSchema),
  handleAddMatchSheetEvent,
);
router.post(
  "/pairings/:pairingId/sheet/journeymen/:journeymanId/roll-random-primary",
  authUser,
  validate(rollRandomPrimarySchema),
  handleRollJourneymanRandomPrimary,
);
router.delete(
  "/pairings/:pairingId/sheet/events/:eventId",
  authUser,
  handleRemoveMatchSheetEvent,
);
router.post(
  "/pairings/:pairingId/sheet/submit",
  authUser,
  handleSubmitMatchSheet,
);
router.post(
  "/pairings/:pairingId/sheet/unsubmit",
  authUser,
  handleUnsubmitMatchSheet,
);
router.post(
  "/pairings/:pairingId/sheet/validate",
  authUser,
  handleValidateMatchSheet,
);
router.get(
  "/pairings/:pairingId/sheet/can-invalidate",
  authUser,
  handleCanInvalidate,
);
router.post(
  "/pairings/:pairingId/sheet/invalidate",
  authUser,
  validate(invalidateSheetSchema),
  handleInvalidateMatchSheet,
);

export default router;
