/**
 * Lot P.B.1 — Routes admin pour la gestion des wallets (Crowns).
 *
 * Endpoints :
 *  - GET   /admin/wallets/:userId           — snapshot wallet + transactions paginees
 *  - PATCH /admin/wallets/:userId/balance   — ajustement manuel { delta, reason }
 *  - POST  /admin/bets/:betId/refund        — refund d'un pari { reason }
 *
 * Tous tracent un audit log strict (action `wallet.adjust` / `bet.refund`)
 * incluant l'identite admin, les valeurs avant/apres et la raison.
 *
 * Ces routes sont a part du gros `admin.ts` car le perimetre financier
 * requiert un audit beaucoup plus serre et une revue de securite dediee
 * (cf. roadmap Sprint P lot P.B.1).
 */

import { Router } from "express";
import { prisma } from "../prisma";
import { authUser } from "../middleware/authUser";
import { adminOnly } from "../middleware/adminOnly";
import { validate } from "../middleware/validate";
import {
  adminWalletAdjustSchema,
  adminBetRefundSchema,
} from "../schemas/admin.schemas";
import { serverLog } from "../utils/server-log";
import { safeRecordAdminActionFromRequest } from "../services/audit-log";
import type { AuthenticatedRequest } from "../middleware/authUser";
import {
  credit,
  creditInTx,
  debit,
  ensureWalletExists,
  InsufficientFundsError,
} from "../services/pro-wallet";

const router = Router();

router.use(authUser, adminOnly);

const MAX_TRANSACTIONS_PER_PAGE = 100;
const DEFAULT_TRANSACTIONS_PER_PAGE = 50;

/**
 * GET /admin/wallets/:userId
 *
 * Renvoie un snapshot complet du wallet :
 *  - infos user (id, email, coachName)
 *  - balance courante en Crowns
 *  - transactions paginees (les plus recentes en premier)
 *  - paris en attente (pour pouvoir cliquer refund)
 *
 * Query: ?page=1&limit=50 (cap a 100 pour eviter de saturer l'UI).
 */
router.get("/wallets/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = Math.min(
      Math.max(parseInt((req.query.limit as string) ?? "", 10) || DEFAULT_TRANSACTIONS_PER_PAGE, 1),
      MAX_TRANSACTIONS_PER_PAGE,
    );
    const page = Math.max(parseInt((req.query.page as string) ?? "", 10) || 1, 1);
    const skip = (page - 1) * limit;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, coachName: true },
    });
    if (!user) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const wallet = await prisma.proWallet.findUnique({
      where: { userId },
      select: { crowns: true, createdAt: true, updatedAt: true },
    });

    const [transactions, totalTransactions, pendingBets] = await Promise.all([
      prisma.proTransaction.findMany({
        where: { walletId: userId },
        select: {
          id: true,
          type: true,
          amount: true,
          ref: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.proTransaction.count({ where: { walletId: userId } }),
      prisma.proBet.findMany({
        where: { userId, status: "pending" },
        select: {
          id: true,
          marketId: true,
          selection: true,
          stake: true,
          oddsAtPlace: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    res.json({
      user,
      wallet: {
        userId,
        crowns: wallet?.crowns ?? 0,
        createdAt: wallet?.createdAt ?? null,
        updatedAt: wallet?.updatedAt ?? null,
      },
      transactions,
      pagination: {
        page,
        limit,
        total: totalTransactions,
        totalPages: Math.max(1, Math.ceil(totalTransactions / limit)),
      },
      pendingBets,
    });
  } catch (e) {
    serverLog.error(e);
    res.status(500).json({ error: "Erreur lors du chargement du wallet" });
  }
});

/**
 * PATCH /admin/wallets/:userId/balance
 *
 * Ajustement manuel du solde. `delta` signe (> 0 credit / < 0 debit).
 * Le service `pro-wallet` enforce les contraintes :
 *  - debit refuse si solde insuffisant (renvoie 422).
 *  - amount = abs(delta), type = `ADMIN_ADJUST`, ref = reason tronquee.
 *
 * Refuse de s'ajuster soi-meme (anti self-credit).
 */
router.patch(
  "/wallets/:userId/balance",
  validate(adminWalletAdjustSchema),
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { delta, reason }: { delta: number; reason: string } = req.body;

      if ((req as AuthenticatedRequest).user?.id === userId) {
        return res.status(400).json({
          error: "Vous ne pouvez pas ajuster votre propre solde",
        });
      }

      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!userExists) {
        return res.status(404).json({ error: "Utilisateur non trouvé" });
      }

      const previousBalance = (
        await prisma.proWallet.findUnique({
          where: { userId },
          select: { crowns: true },
        })
      )?.crowns ?? 0;

      // `ref` stocke la raison tronquee a 255 chars (audit log conserve
      // la version complete). Permet a un user de voir une raison
      // succincte dans son historique sans exposer un texte trop long.
      const refTruncated = reason.length > 255 ? `${reason.slice(0, 252)}...` : reason;
      const amount = Math.abs(delta);

      let newBalance: number;
      try {
        if (delta > 0) {
          newBalance = await credit(userId, amount, "ADMIN_ADJUST", refTruncated);
        } else {
          newBalance = await debit(userId, amount, "ADMIN_ADJUST", refTruncated);
        }
      } catch (e) {
        if (e instanceof InsufficientFundsError) {
          return res.status(422).json({
            error: `Solde insuffisant pour ce debit : disponible ${e.available} Crowns, demande ${e.requested}.`,
          });
        }
        throw e;
      }

      await safeRecordAdminActionFromRequest(prisma, req as AuthenticatedRequest, {
        action: "wallet.adjust",
        entity: "ProWallet",
        entityId: userId,
        oldValue: { crowns: previousBalance },
        newValue: { crowns: newBalance, delta, reason },
      });

      res.json({
        wallet: { userId, crowns: newBalance },
        delta,
        previousBalance,
      });
    } catch (e) {
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors de l'ajustement du solde" });
    }
  },
);

/**
 * POST /admin/bets/:betId/refund
 *
 * Annule un pari et rembourse la mise. Operation atomique :
 *  - bet.status = 'void' (pas de double-refund possible)
 *  - credit du wallet user (stake initial)
 *  - audit log strict
 *
 * Refuse si :
 *  - bet inexistant (404)
 *  - bet deja `void` (409, idempotence stricte)
 *  - bet `won` ou `lost` : le settlement est passe. On accepte quand
 *    meme avec un warning audit ("post-settlement refund") car cela
 *    peut etre necessaire (bug detecte apres coup). Dans ce cas seul
 *    le stake est credit (le payout reste si won, le user touche donc
 *    un double-credit). Documente comme exception, audit le signale.
 */
router.post(
  "/bets/:betId/refund",
  validate(adminBetRefundSchema),
  async (req, res) => {
    try {
      const { betId } = req.params;
      const { reason }: { reason: string } = req.body;

      const bet = await prisma.proBet.findUnique({
        where: { id: betId },
        select: {
          id: true,
          userId: true,
          stake: true,
          status: true,
          marketId: true,
        },
      });

      if (!bet) {
        return res.status(404).json({ error: "Pari non trouvé" });
      }
      if (bet.status === "void") {
        return res
          .status(409)
          .json({ error: "Pari deja annule" });
      }

      const refTruncated =
        reason.length > 255 ? `${reason.slice(0, 252)}...` : reason;

      // BUG fix audit round 7 (CRITICAL/money loss) : avant, le check
      // `bet.status === "void"` etait fait hors transaction, et la
      // void-update etait dans une $transaction SEPAREE du `credit()`
      // call (qui ouvrait sa propre tx). Deux clics simultanes :
      //  - Both read `status='pending'`
      //  - Both `update` to `"void"` (idempotent)
      //  - Both call `credit` → DOUBLE credit du stake.
      // Pire, si `credit` throw apres le void, le stake est voided
      // mais jamais refunde (money perdu).
      // Fix : `updateMany({ where: { id, status: { not: "void" } } })`
      // garantit qu'un seul appel reussit a flip status → void.
      // Le credit + audit log dans la MEME $transaction → atomicite.
      const wasPostSettlement = bet.status === "won" || bet.status === "lost";

      // Pre-ensure wallet HORS transaction (pattern round 4).
      await ensureWalletExists(bet.userId);

      let newBalance: number | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.$transaction(async (tx: any) => {
        // Optimistic-lock : un seul appel passe (status flip atomique).
        const voidResult = await tx.proBet.updateMany({
          where: { id: betId, status: { not: "void" } },
          data: { status: "void" },
        });
        if (voidResult.count === 0) {
          // Un autre admin a deja refund (ou le bet etait deja void).
          throw new Error("ALREADY_REFUNDED");
        }
        // Credit dans la meme transaction → atomicite garantie.
        newBalance = await creditInTx(
          tx,
          bet.userId,
          bet.stake,
          "ADMIN_REFUND",
          bet.id,
        );
      });

      await safeRecordAdminActionFromRequest(prisma, req as AuthenticatedRequest, {
        action: "bet.refund",
        entity: "ProBet",
        entityId: betId,
        oldValue: { status: bet.status, stake: bet.stake, userId: bet.userId },
        newValue: {
          status: "void",
          refundedStake: bet.stake,
          newBalance,
          reason: refTruncated,
          wasPostSettlement,
        },
      });

      res.json({
        bet: { id: betId, status: "void" },
        refundedStake: bet.stake,
        newBalance,
        wasPostSettlement,
      });
    } catch (e) {
      // Race condition handle : un autre admin a deja refund.
      if (e instanceof Error && e.message === "ALREADY_REFUNDED") {
        return res.status(409).json({ error: "Pari deja annule (race)" });
      }
      serverLog.error(e);
      res.status(500).json({ error: "Erreur lors du refund" });
    }
  },
);

export default router;
