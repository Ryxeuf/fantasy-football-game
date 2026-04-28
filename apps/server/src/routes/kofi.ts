import { Router, type Request, type Response } from "express";
import bodyParser from "body-parser";
import { prisma } from "../prisma";
import { KOFI_VERIFICATION_TOKEN } from "../config";
import {
  kofiWebhookPayloadSchema,
  amountToCents,
  type KofiWebhookPayload,
} from "../schemas/kofi.schemas";
import {
  computeSupporterUpdate,
  extractKofiLinkCode,
  matchKofiPayloadToUser,
  normaliseEmail,
} from "../services/kofi";
import { serverLog } from "../utils/server-log";

const router = Router();

/**
 * Ko-fi envoie ses webhooks en `application/x-www-form-urlencoded` avec un
 * unique champ `data` contenant le JSON complet, ou en `application/json`
 * direct selon la configuration. On accepte les deux.
 */
const webhookBodyParsers = [
  bodyParser.urlencoded({ extended: false, limit: "100kb" }),
  bodyParser.json({ limit: "100kb" }),
];

/**
 * Lit la map devise→centimes existante (Json côté Postgres, string côté SQLite),
 * ajoute le delta sur la devise indiquée et retourne la nouvelle map dans le
 * format attendu par la couche Prisma de la plateforme courante.
 */
export function mergeCurrencyTotals(
  current: unknown,
  currency: string,
  amountCentsDelta: number,
  isSqlite: boolean,
): unknown {
  let parsed: Record<string, number> = {};
  if (typeof current === "string" && current.length > 0) {
    try {
      const candidate: unknown = JSON.parse(current);
      if (candidate && typeof candidate === "object") {
        parsed = candidate as Record<string, number>;
      }
    } catch {
      parsed = {};
    }
  } else if (current && typeof current === "object") {
    parsed = current as Record<string, number>;
  }

  const next: Record<string, number> = {
    ...parsed,
    [currency]: (parsed[currency] ?? 0) + amountCentsDelta,
  };

  return isSqlite ? JSON.stringify(next) : next;
}

function extractPayload(req: Request): KofiWebhookPayload | null {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawData = body.data ?? body;

  let candidate: unknown;
  if (typeof rawData === "string") {
    try {
      candidate = JSON.parse(rawData);
    } catch {
      return null;
    }
  } else {
    candidate = rawData;
  }

  const parsed = kofiWebhookPayloadSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function handleKofiWebhook(
  req: Request,
  res: Response,
): Promise<Response> {
  const payload = extractPayload(req);
  if (!payload) {
    return res.status(400).json({ error: "Invalid Ko-fi payload" });
  }

  if (payload.verification_token !== KOFI_VERIFICATION_TOKEN) {
    return res.status(401).json({ error: "Invalid verification token" });
  }

  try {
    // Déduplication : Ko-fi retente si on ne répond pas 200, on doit ignorer
    // silencieusement les doublons.
    const existing = await prisma.kofiTransaction.findUnique({
      where: { kofiTransactionId: payload.kofi_transaction_id },
      select: { id: true },
    });
    if (existing) {
      return res.status(200).json({ status: "duplicate" });
    }

    // Candidats pour le matching : on ne charge que les rares utilisateurs
    // dont l'email, le kofiLinkCode ou le discordUserId correspondent au payload.
    const code = extractKofiLinkCode(payload.message);
    const email = normaliseEmail(payload.email);
    const discordUserId = payload.discord_userid?.trim() || null;
    const orFilters: Array<Record<string, unknown>> = [];
    if (code) orFilters.push({ kofiLinkCode: code });
    if (email) orFilters.push({ email });
    if (discordUserId) orFilters.push({ discordUserId });

    const candidates =
      orFilters.length > 0
        ? await prisma.user.findMany({
            where: { OR: orFilters },
            select: {
              id: true,
              email: true,
              kofiLinkCode: true,
              discordUserId: true,
            },
          })
        : [];

    const match = matchKofiPayloadToUser(payload, candidates);
    const supporterDelta = computeSupporterUpdate(payload);
    const isSqlite = process.env.TEST_SQLITE === "1";
    // Le payload "timestamp" est ISO 8601. On le préserve distinctement de
    // receivedAt (= now) pour pouvoir trier par horloge Ko-fi en cas de
    // livraison retardée. null si parse échoue (ne bloque pas l'écriture).
    const kofiTimestamp = (() => {
      const d = new Date(payload.timestamp);
      return Number.isNaN(d.getTime()) ? null : d;
    })();

    await prisma.$transaction(async (tx: typeof prisma) => {
      await tx.kofiTransaction.create({
        data: {
          kofiTransactionId: payload.kofi_transaction_id,
          messageId: payload.message_id,
          kofiTimestamp,
          type: payload.type,
          isSubscriptionPayment: payload.is_subscription_payment,
          isFirstSubscriptionPayment: payload.is_first_subscription_payment,
          tierName: payload.tier_name ?? null,
          amountCents: amountToCents(payload.amount),
          currency: payload.currency,
          fromName: payload.from_name ?? null,
          email: email,
          message: payload.message ?? null,
          discordUserId: payload.discord_userid?.trim() || null,
          userId: match?.userId ?? null,
          matchedVia: match?.matchedVia ?? null,
          rawPayload: (isSqlite
            ? JSON.stringify(payload)
            : payload) as never,
        },
      });

      if (match) {
        // Lecture-modification-écriture de la map devise→centimes. La
        // sérialisation est garantie par la transaction Prisma (les retries
        // Ko-fi sont déjà bloqués en amont par le check de déduplication).
        const current = await tx.user.findUnique({
          where: { id: match.userId },
          select: { totalDonatedCentsByCurrency: true },
        });
        const nextMap = mergeCurrencyTotals(
          current?.totalDonatedCentsByCurrency,
          supporterDelta.currency,
          supporterDelta.amountCentsDelta,
          isSqlite,
        );
        const nextUpdate: Record<string, unknown> = {
          totalDonatedCentsByCurrency: nextMap,
        };
        if (payload.is_subscription_payment) {
          nextUpdate.supporterTier = supporterDelta.supporterTier;
          nextUpdate.supporterActiveUntil = supporterDelta.supporterActiveUntil;
        }
        await tx.user.update({
          where: { id: match.userId },
          data: nextUpdate as never,
        });
      }
    });

    return res.status(200).json({
      status: "ok",
      matched: match !== null,
      matchedVia: match?.matchedVia ?? null,
    });
  } catch (err) {
    serverLog.error("[kofi-webhook] error processing payload:", err);
    // On retourne 500 pour que Ko-fi retente la livraison.
    return res.status(500).json({ error: "Server error" });
  }
}

router.post("/", ...webhookBodyParsers, handleKofiWebhook);

export default router;
