import { z } from "zod";

export const joinQueueSchema = z.object({
  teamId: z.string().min(1, "teamId requis"),
});

export const leaveQueueSchema = z.object({});
