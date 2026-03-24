import { z } from "zod";

export const joinMatchSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
});

export const acceptMatchSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
});

export const moveSchema = z.object({
  move: z
    .object({
      type: z.string().min(1, "move requis avec un type valide"),
    })
    .passthrough(),
});

export const chooseTeamSchema = z.object({
  matchId: z.string().min(1, "matchId requis"),
  teamId: z.string().min(1, "teamId requis"),
});
