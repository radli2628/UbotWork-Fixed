import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, paymentRequestsTable, plansTable, botsTable, tokensTable } from "@workspace/db";
import { sendMessage } from "../services/telegram";
import { generateToken } from "../lib/tokenUtils";

const router: IRouter = Router();

router.get("/bots/:botId/payment-requests", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }
  try {
    const requests = await db
      .select()
      .from(paymentRequestsTable)
      .where(eq(paymentRequestsTable.botId, botId))
      .orderBy(paymentRequestsTable.createdAt);
    res.json(requests);
  } catch (err) {
    req.log.error({ err }, "Failed to list payment requests");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bots/:botId/payment-requests/:requestId/approve", async (req, res) => {
  const botId = Number(req.params["botId"]);
  const requestId = Number(req.params["requestId"]);
  if (Number.isNaN(botId) || Number.isNaN(requestId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [request] = await db
      .select()
      .from(paymentRequestsTable)
      .where(and(eq(paymentRequestsTable.id, requestId), eq(paymentRequestsTable.botId, botId)));

    if (!request) {
      res.status(404).json({ error: "Payment request not found" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ error: `Request is already ${request.status}` });
      return;
    }

    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, request.planId));

    if (!bot || !plan) {
      res.status(404).json({ error: "Bot or plan not found" });
      return;
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);

    const [newToken] = await db
      .insert(tokensTable)
      .values({ token, botId, planId: plan.id, paymentRequestId: request.id, expiresAt })
      .returning();

    await db
      .update(paymentRequestsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(paymentRequestsTable.id, requestId));

    const expires = expiresAt.toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    await sendMessage(
      bot.token,
      request.chatId,
      `🎉 <b>Payment Confirmed!</b>\n\nYour activation token is ready:\n\n<code>${token}</code>\n\nPlan: <b>${plan.name}</b>\nExpires: <b>${expires}</b>\n\nSend /start and enter this token to activate your subscription.`,
    );

    res.json({ token: newToken });
  } catch (err) {
    req.log.error({ err }, "Failed to approve payment request");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bots/:botId/payment-requests/:requestId/reject", async (req, res) => {
  const botId = Number(req.params["botId"]);
  const requestId = Number(req.params["requestId"]);
  if (Number.isNaN(botId) || Number.isNaN(requestId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const { reason } = req.body as { reason?: string };

  try {
    const [request] = await db
      .select()
      .from(paymentRequestsTable)
      .where(and(eq(paymentRequestsTable.id, requestId), eq(paymentRequestsTable.botId, botId)));

    if (!request) {
      res.status(404).json({ error: "Payment request not found" });
      return;
    }
    if (request.status !== "pending") {
      res.status(400).json({ error: `Request is already ${request.status}` });
      return;
    }

    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    await db
      .update(paymentRequestsTable)
      .set({ status: "rejected", rejectionReason: reason ?? null, updatedAt: new Date() })
      .where(eq(paymentRequestsTable.id, requestId));

    await sendMessage(
      bot.token,
      request.chatId,
      `❌ <b>Payment Not Confirmed</b>\n\nYour payment request #${requestId} was not approved.\n\n<b>Reason:</b> ${reason ?? "No reason provided."}\n\nPlease try again or contact support.`,
      {
        reply_markup: {
          inline_keyboard: [[{ text: "📦 View plans", callback_data: "choose_plan" }]],
        },
      },
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reject payment request");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
