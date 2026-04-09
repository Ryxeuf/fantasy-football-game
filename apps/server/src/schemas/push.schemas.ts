import { z } from "zod";

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url("endpoint doit etre une URL valide"),
  keys: z.object({
    p256dh: z.string().min(1, "p256dh requis"),
    auth: z.string().min(1, "auth requis"),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url("endpoint doit etre une URL valide"),
});

export const pushPreferencesSchema = z.object({
  pushEnabled: z.boolean().optional(),
  turnNotification: z.boolean().optional(),
  matchFoundNotification: z.boolean().optional(),
});
