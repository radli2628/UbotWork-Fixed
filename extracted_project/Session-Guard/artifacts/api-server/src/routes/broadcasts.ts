import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, broadcastsTable, subscribersTable, botsTable, sendLogsTable } from "@workspace/db";
import { sendMessage } from "../services/telegram";

const router: IRouter = Router({ mergeParams: true });

router.get("/bots/:botId/broadcasts", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  try {
    const broadcasts = await db
      .select()
      .from(broadcastsTable)
      .where(eq(broadcastsTable.botId, botId))
      .orderBy(broadcastsTable.createdAt);
    res.json(broadcasts);
  } catch (err) {
    req.log.error({ err }, "Failed to list broadcasts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bots/:botId/broadcasts", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const { message } = req.body as { message?: string };
  if (!message || message.trim().length === 0) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const activeSubscribers = await db
      .select()
      .from(subscribersTable)
      .where(and(eq(subscribersTable.botId, botId), eq(subscribersTable.isActive, true)));

    const [broadcast] = await db
      .insert(broadcastsTable)
      .values({
        botId,
        message: message.trim(),
        status: "sending",
        totalRecipients: activeSubscribers.length,
      })
      .returning();

    res.status(201).json(broadcast);

    setImmediate(async () => {
      let sentCount = 0;
      let failedCount = 0;

      for (const subscriber of activeSubscribers) {
        const success = await sendMessage(bot.token, subscriber.chatId, message.trim());

        await db.insert(sendLogsTable).values({
          broadcastId: broadcast!.id,
          subscriberId: subscriber.id,
          success,
          errorMessage: success ? null : "Failed to send",
        });

        if (success) {
          sentCount++;
        } else {
          failedCount++;
        }
      }

      await db
        .update(broadcastsTable)
        .set({
          status: "completed",
          sentCount,
          failedCount,
          completedAt: new Date(),
        })
        .where(eq(broadcastsTable.id, broadcast!.id));
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create broadcast");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bots/:botId/broadcasts/:broadcastId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  const broadcastId = Number(req.params["broadcastId"]);
  if (Number.isNaN(botId) || Number.isNaN(broadcastId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [broadcast] = await db
      .select()
      .from(broadcastsTable)
      .where(and(eq(broadcastsTable.id, broadcastId), eq(broadcastsTable.botId, botId)));
    if (!broadcast) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
    res.json(broadcast);
  } catch (err) {
    req.log.error({ err }, "Failed to get broadcast");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
