import { Router, type IRouter } from "express";
import { eq, count, and } from "drizzle-orm";
import {
  db,
  botsTable,
  subscribersTable,
  paymentRequestsTable,
  tokensTable,
  broadcastsTable,
} from "@workspace/db";

const router: IRouter = Router();

router.get("/stats", async (req, res) => {
  try {
    const [[bots], [subscribers], [pending], [tokens], [activeTokens], [broadcasts]] =
      await Promise.all([
        db.select({ value: count() }).from(botsTable),
        db.select({ value: count() }).from(subscribersTable).where(eq(subscribersTable.isActive, true)),
        db
          .select({ value: count() })
          .from(paymentRequestsTable)
          .where(eq(paymentRequestsTable.status, "pending")),
        db.select({ value: count() }).from(tokensTable),
        db
          .select({ value: count() })
          .from(tokensTable)
          .where(and(eq(tokensTable.isActivated, true))),
        db.select({ value: count() }).from(broadcastsTable),
      ]);

    res.json({
      totalBots: bots?.value ?? 0,
      totalSubscribers: subscribers?.value ?? 0,
      pendingRequests: pending?.value ?? 0,
      totalTokens: tokens?.value ?? 0,
      activeTokens: activeTokens?.value ?? 0,
      totalBroadcasts: broadcasts?.value ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
