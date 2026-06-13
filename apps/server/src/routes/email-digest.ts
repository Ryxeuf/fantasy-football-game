/**
 * Réengagement — Phase B : routes du digest e-mail hebdomadaire.
 *
 *  - GET  /email/digest-preference   (authUser) → { enabled }
 *  - PUT  /email/digest-preference   (authUser) → opt-in / opt-out
 *  - GET  /email/unsubscribe?token=  (public, rate-limité) → 1-clic
 *
 * La désinscription publique est volontairement sans login (RGPD,
 * lien dans l'e-mail) : la preuve d'identité est le token signé HMAC.
 */

import { Router } from "express";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { validate } from "../middleware/validate";
import { apiRateLimiter } from "../middleware/rateLimiter";
import { emailDigestPreferenceSchema } from "../schemas/email-digest.schemas";
import {
  getEmailDigestPreference,
  setEmailDigestPreference,
  unsubscribeByToken,
} from "../services/email-digest-preference";

const router = Router();

router.get(
  "/digest-preference",
  authUser,
  async (req: AuthenticatedRequest, res) => {
    try {
      const pref = await getEmailDigestPreference(req.user!.id);
      return res.json(pref);
    } catch {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

router.put(
  "/digest-preference",
  authUser,
  validate(emailDigestPreferenceSchema),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { enabled } = req.body as { enabled: boolean };
      const pref = await setEmailDigestPreference(req.user!.id, enabled);
      return res.json(pref);
    } catch {
      return res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

/**
 * Désinscription en un clic. Renvoie une page HTML sobre (style
 * parchemin) plutôt qu'un JSON, car ouverte directement dans le
 * navigateur depuis l'e-mail.
 */
router.get("/unsubscribe", apiRateLimiter, async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : "";
  let ok = false;
  try {
    ok = await unsubscribeByToken(token);
  } catch {
    ok = false;
  }

  const title = ok ? "Désinscription confirmée" : "Lien invalide";
  const message = ok
    ? "Vous ne recevrez plus le digest hebdomadaire de Nuffle Arena. Vous pouvez le réactiver à tout moment depuis vos paramètres."
    : "Ce lien de désinscription est invalide ou expiré. Vous pouvez gérer vos préférences depuis vos paramètres.";

  res.status(ok ? 200 : 400).type("html").send(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${title}</title></head>` +
      `<body style="margin:0;background:#2C2416;font-family:Georgia,serif;">` +
      `<div style="max-width:520px;margin:48px auto;padding:24px;background:#F5ECD7;color:#2C2416;border-radius:8px;">` +
      `<h1 style="color:#7A5C1E;font-size:22px;">${title}</h1>` +
      `<p style="font-size:16px;line-height:1.5;">${message}</p>` +
      `</div></body></html>`,
  );
});

export default router;
