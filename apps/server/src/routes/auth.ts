import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import bcrypt from "bcryptjs";
import { authUser, AuthenticatedRequest } from "../middleware/authUser";
import { normalizeRoles } from "../utils/roles";
import { validate } from "../middleware/validate";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../schemas/auth.schemas";
import {
  PasswordResetError,
  consumeResetToken,
  requestPasswordReset,
} from "../services/password-reset";
import {
  claimOrphanKofiTransactions,
  ensureKofiLinkCode,
} from "../services/kofi-claim";
import { isSupporter } from "../services/kofi";
import { serverLog } from "../utils/server-log";
import {
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../services/auth-tokens";
import {
  getRefreshTokenStore,
  setRefreshTokenStore,
} from "../services/refresh-token-store-singleton";
import {
  REGISTRATION_REQUIRES_VALIDATION_FLAG,
  isEnabled as isFeatureEnabled,
} from "../services/featureFlags";

const router = Router();

// Lot P.C.1 — getRefreshTokenStore/setRefreshTokenStore extraits dans
// `services/refresh-token-store-singleton.ts` pour casser le cycle
// d'import auth.ts ↔ password-reset.ts. Les tests existants importent
// toujours via `./auth` (re-export ci-dessus pour back-compat).
export { getRefreshTokenStore, setRefreshTokenStore };

/**
 * S24.3 — Issues a fresh access/refresh pair for `userId` and registers the
 * refresh jti in the store. Returns both tokens to the caller.
 */
async function issueTokenPair(params: {
  userId: string;
  primaryRole: string | undefined;
  roles: string[];
}): Promise<{ token: string; refreshToken: string }> {
  const accessToken = signAccessToken({
    sub: params.userId,
    role: params.primaryRole ?? "user",
    roles: params.roles,
  });
  const refreshToken = signRefreshToken({ sub: params.userId });
  const refreshPayload = verifyRefreshToken(refreshToken);
  await getRefreshTokenStore().register({
    jti: refreshPayload.jti,
    sub: params.userId,
    expiresAt: Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
  });
  return { token: accessToken, refreshToken };
}

router.post("/register", validate(registerSchema), async (req, res) => {
  try {
    const {
      email,
      password,
      coachName,
      name,
      firstName,
      lastName,
      dateOfBirth,
    } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Lot O.B.1 — kill-switch optionnel : si le flag
    // REGISTRATION_REQUIRES_VALIDATION_FLAG est ON, on cree le user en
    // mode "pending" (valid=false, pas de token). Par defaut OFF →
    // auto-approve (UX d'acquisition normale).
    const requiresValidation = await isFeatureEnabled(
      REGISTRATION_REQUIRES_VALIDATION_FLAG,
    );

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        coachName,
        name: name ?? coachName,
        firstName: firstName && firstName !== "" ? firstName : null,
        lastName: lastName && lastName !== "" ? lastName : null,
        dateOfBirth:
          dateOfBirth && dateOfBirth !== "" ? new Date(dateOfBirth) : null,
        valid: !requiresValidation,
      },
    });

    // Alloue le code Ko-fi et rattache d'éventuels dons orphelins.
    // Ces opérations ne doivent pas bloquer l'inscription si elles échouent.
    try {
      await ensureKofiLinkCode(created.id);
      await claimOrphanKofiTransactions(created.id, created.email);
    } catch (kofiErr) {
      serverLog.error("[register] kofi post-create hooks failed:", kofiErr);
    }

    const roles = normalizeRoles((created as any).roles ?? created.role);
    const primaryRole = roles[0];
    const publicUser = {
      id: created.id,
      email: created.email,
      name: created.name,
      coachName: created.coachName,
      firstName: created.firstName,
      lastName: created.lastName,
      dateOfBirth: created.dateOfBirth,
      role: primaryRole,
      roles,
      valid: created.valid,
      createdAt: created.createdAt,
    };

    // Lot O.B.1 — si le flag REGISTRATION_REQUIRES_VALIDATION est actif,
    // on cree le compte mais on ne livre pas de token : le user voit la
    // page "pending validation" sur le frontend (deja existante).
    if (requiresValidation) {
      return res.status(201).json({
        user: publicUser,
        message:
          "Ton compte est en attente de validation par un administrateur. Tu recevras un mail des qu'il sera actif.",
      });
    }

    const { token, refreshToken } = await issueTokenPair({
      userId: created.id,
      primaryRole,
      roles,
    });
    return res.status(201).json({ user: publicUser, token, refreshToken });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return res.status(409).json({ error: "Email déjà utilisé" });
    }
    serverLog.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/login", validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      serverLog.log(`[LOGIN] Utilisateur non trouvé: ${email}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    serverLog.log(
      `[LOGIN] Tentative de connexion pour ${email}: valid=${user.valid}, role=${user.role}`,
    );
    
    // Le champ `valid` n'existe que dans le schéma Postgres (pré-alpha gate).
    // Sur les autres schémas (ex: SQLite de test), il est undefined et le
    // compte doit être traité comme valide.
    if (user.valid === false) {
      serverLog.log(`[LOGIN] Compte non validé pour ${email}`);
      return res.status(403).json({ error: "Votre compte n'est pas encore validé. Veuillez contacter un administrateur." });
    }

    // Lot P.A.2 — compte soft-deleted. Verifie AVANT bcrypt + AVANT le
    // ban pour les memes raisons (pas de leak). Message neutre.
    const deletedAt = (user as { deletedAt?: Date | null }).deletedAt ?? null;
    if (deletedAt !== null) {
      serverLog.log(`[LOGIN] Compte supprime pour ${email} (deletedAt=${deletedAt.toISOString()})`);
      return res.status(403).json({
        error: "Identifiants invalides",
      });
    }

    // Lot P.B.4 — bannissement actif. Verifie AVANT bcrypt pour eviter de
    // donner un signal "password ok" a un user banni qui retenterait sans
    // arret. Le message reste neutre, sans exposer la raison interne.
    const bannedUntil = (user as { bannedUntil?: Date | null }).bannedUntil ?? null;
    if (bannedUntil && bannedUntil.getTime() > Date.now()) {
      serverLog.log(`[LOGIN] Compte banni pour ${email} jusqu'a ${bannedUntil.toISOString()}`);
      return res.status(403).json({
        error: "Compte suspendu. Contactez un administrateur pour plus d'informations.",
        bannedUntil: bannedUntil.toISOString(),
      });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      serverLog.log(`[LOGIN] Mot de passe incorrect pour ${email}`);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    serverLog.log(`[LOGIN] Connexion réussie pour ${email}`);

    // Rattrape les dons orphelins reçus avant l'inscription et garantit que
    // le compte a un kofiLinkCode. Jamais bloquant sur le login.
    try {
      await ensureKofiLinkCode(user.id);
      await claimOrphanKofiTransactions(user.id, user.email);
    } catch (kofiErr) {
      serverLog.error("[login] kofi post-login hooks failed:", kofiErr);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const roles = normalizeRoles((user as any).roles ?? user.role);
    const primaryRole = roles[0];

    const publicUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      coachName: user.coachName,
      firstName: user.firstName,
      lastName: user.lastName,
      dateOfBirth: user.dateOfBirth,
      role: primaryRole,
      roles,
      createdAt: user.createdAt,
      // Lot P.C.2 — admin password reset override. Si true, le frontend
      // doit rediriger vers /change-password apres login.
      mustChangePassword:
        (user as { mustChangePassword?: boolean }).mustChangePassword ?? false,
    };
    const { token, refreshToken } = await issueTokenPair({
      userId: user.id,
      primaryRole,
      roles,
    });
    return res.json({ user: publicUser, token, refreshToken });
  } catch (err) {
    serverLog.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

/**
 * POST /auth/logout — S24.3
 *
 * Revokes the presented refresh token. Idempotent: missing or already-revoked
 * tokens still respond 204. Access tokens themselves are stateless — they
 * remain valid until expiry, but their <=15min TTL bounds the exposure.
 */
export async function handleLogout(req: Request, res: Response): Promise<Response> {
  const refreshToken = (req.body as { refreshToken?: string })?.refreshToken;
  if (typeof refreshToken !== "string" || refreshToken.length === 0) {
    return res.status(204).send();
  }
  try {
    const payload = verifyRefreshToken(refreshToken);
    await getRefreshTokenStore().revoke(payload.jti);
  } catch {
    // ignore: malformed/expired tokens are already useless
  }
  return res.status(204).send();
}

router.post("/logout", handleLogout);

// Désactiver le compte courant (suppression logique)
router.delete("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        valid: false,
      },
    });

    return res.json({
      message:
        "Votre compte a été désactivé avec succès. Vous ne pourrez plus vous connecter avec cet accès.",
    });
  } catch (err) {
    serverLog.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

// Lot P.C.1 — Password reset self-service.
//
// POST /auth/forgot-password : retourne toujours 200 OK (anti-
// enumeration). Si l'email matche un user actif, un token est genere
// et logue serveur-side. En dev (NODE_ENV !== "production"), la
// response inclut `devLink` pour faciliter les tests.
//
// POST /auth/reset-password : valide le token + applique le nouveau
// password. Revoque toutes les sessions actives. Erreurs typees :
// INVALID_TOKEN / TOKEN_EXPIRED / TOKEN_USED / WEAK_PASSWORD.
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { email } = req.body as { email: string };
      // Lit l'origin depuis le header (X-Forwarded-Host / Origin) en
      // fallback vers l'env publique. Cap a 256 chars pour eviter un
      // injection log.
      const origin =
        (req.get("Origin") || process.env.FRONTEND_PUBLIC_URL || "")
          .toString()
          .slice(0, 256) || "https://nufflearena.fr";
      const ip =
        (req.headers["x-forwarded-for"] as string | undefined)
          ?.split(",")[0]
          ?.trim() || req.ip;
      const result = await requestPasswordReset({
        email,
        requestIp: ip,
        origin,
      });
      res.json(result);
    } catch (e: unknown) {
      serverLog.error("[auth/forgot-password] failed:", e);
      // Meme en erreur on retourne 200 anti-enumeration. L'erreur est
      // tracee cote serveur uniquement.
      res.json({ requested: true, devLink: null });
    }
  },
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body as {
        token: string;
        newPassword: string;
      };
      const result = await consumeResetToken({ token, newPassword });
      res.json({ success: true, email: result.email });
    } catch (e: unknown) {
      if (e instanceof PasswordResetError) {
        const status =
          e.code === "WEAK_PASSWORD"
            ? 400
            : e.code === "TOKEN_EXPIRED"
              ? 410
              : 400;
        res.status(status).json({ error: e.message, code: e.code });
        return;
      }
      serverLog.error("[auth/reset-password] failed:", e);
      res.status(500).json({ error: "Erreur serveur" });
    }
  },
);

export default router;

// Profil courant
router.get("/me", authUser, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        email: true,
        name: true,
        coachName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        role: true,
        patreon: true,
        kofiLinkCode: true,
        supporterTier: true,
        supporterActiveUntil: true,
        totalDonatedCentsByCurrency: true,
        discordUserId: true,
        valid: true,
        eloRating: true,
        privateProfile: true,
        // Lot P.C.2 — flag pour declencher la redirection vers
        // /change-password si un admin a force un reset.
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            teams: true,
            matches: true,
            createdMatches: true,
            teamSelections: true,
            createdLocalMatches: true,
          },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "Introuvable" });

    const roles = normalizeRoles(user.role);
    const publicUser = {
      ...user,
      roles,
      isSupporter: isSupporter({
        patreon: user.patreon,
        supporterActiveUntil: user.supporterActiveUntil,
      }),
    };

    res.json({ user: publicUser });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Mettre à jour le profil utilisateur
router.put("/me", authUser, validate(updateProfileSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { email, coachName, firstName, lastName, dateOfBirth, discordUserId } = req.body;

    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.id) {
        return res.status(409).json({ error: "Email déjà utilisé" });
      }
    }

    // Construction des données à mettre à jour
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (coachName !== undefined) updateData.coachName = coachName;
    if (firstName !== undefined) updateData.firstName = firstName === "" ? null : firstName;
    if (lastName !== undefined) updateData.lastName = lastName === "" ? null : lastName;
    if (dateOfBirth !== undefined) {
      updateData.dateOfBirth = dateOfBirth === "" || dateOfBirth === null ? null : new Date(dateOfBirth);
    }
    if (discordUserId !== undefined) {
      updateData.discordUserId =
        discordUserId === "" || discordUserId === null ? null : discordUserId;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        coachName: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        discordUserId: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const roles = normalizeRoles(updatedUser.role);
    const publicUser = {
      ...updatedUser,
      roles,
    };

    res.json({ user: publicUser });
  } catch (e: any) {
    if (e.code === "P2002") {
      // Prisma unique constraint violation. target indique le champ en cause
      // (ex: ['email'] ou ['discordUserId']). On renvoie un message ciblé.
      const target: string[] | undefined = e?.meta?.target;
      if (target?.includes("discordUserId")) {
        return res
          .status(409)
          .json({ error: "Cet identifiant Discord est déjà associé à un autre compte" });
      }
      return res.status(409).json({ error: "Email déjà utilisé" });
    }
    serverLog.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// Changer le mot de passe
router.put("/me/password", authUser, validate(changePasswordSchema), async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Récupérer l'utilisateur avec son mot de passe hashé
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        passwordHash: true,
      },
    });
    
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }
    
    // Vérifier l'ancien mot de passe
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }
    
    // Vérifier que le nouveau mot de passe est différent de l'ancien
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'ancien" });
    }
    
    // Hasher le nouveau mot de passe
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    
    // Mettre à jour le mot de passe + Lot P.C.2 : reset le flag
    // `mustChangePassword` car le user vient de prouver qu'il maitrise
    // a nouveau son compte. Re-validation OK pour les comptes qui
    // ont ete reset par un admin.
    await prisma.user.update({
      where: { id: req.user!.id },
      data: { passwordHash: newPasswordHash, mustChangePassword: false },
    });

    res.json({ message: "Mot de passe modifié avec succès" });
  } catch (e: any) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur serveur" });
  }
});
