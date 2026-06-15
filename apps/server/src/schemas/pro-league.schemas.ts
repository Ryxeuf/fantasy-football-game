import { z } from "zod";

/**
 * Schemas des routes mutantes de `pro-league.ts`.
 *
 * Chaque schema est derive du cast `req.body as {...}` existant dans le
 * handler (sur-ensemble fidele). Les regles metier additionnelles
 * (fonds, marche ouvert, fenetre de vote...) restent portees par les
 * services (`submitVote`, `placeBet`, `dedicateHallOfFame`...).
 */

/** POST /pro-league/matches/:id/mvp-vote */
export const submitMvpVoteSchema = z.object({
  votedRosterId: z.string().min(1, "votedRosterId requis"),
});

/** POST /pro-league/matches/:id/predictions */
export const submitFanPredictionSchema = z.object({
  body: z.string(),
});

/** POST /pro-league/bets */
export const placeBetSchema = z.object({
  marketId: z.string().min(1, "marketId requis"),
  selection: z.string().min(1, "selection requise"),
  stake: z.number(),
  oddsAtPlace: z.number(),
  clientToken: z.string().min(1, "clientToken requis"),
});

/** POST /pro-league/hall-of-fame/:id/dedicate */
export const dedicateHallOfFameSchema = z.object({
  message: z.string(),
});
