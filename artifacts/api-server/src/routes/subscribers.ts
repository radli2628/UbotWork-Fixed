import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, subscribersTable, botsTable } from "@workspace/db";

const router: IRouter = Router({ mergeParams: true });

router.get("/bots/:botId/subscribers", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  try {
    const subscribers = await db
      .select()
      .from(subscribersTable)
      .where(eq(subscribersTable.botId, botId))
      .orderBy(subscribersTable.subscribedAt);
    res.json(subscribers);
  } catch (err) {
    req.log.error({ err }, "Failed to list subscribers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bots/:botId/subscribers", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const { chatId, username, firstName, lastName } = req.body as {
    chatId?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  };

  if (!chatId) {
    res.status(400).json({ error: "chatId is required" });
    return;
  }

  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const existing = await db
      .select()
      .from(subscribersTable)
      .where(and(eq(subscribersTable.botId, botId), eq(subscribersTable.chatId, chatId)));

    if (existing.length > 0) {
      if (existing[0]!.isActive) {
        res.status(400).json({ error: "Subscriber already exists" });
        return;
      }
      const [updated] = await db
        .update(subscribersTable)
        .set({ isActive: true, unsubscribedAt: null })
        .where(eq(subscribersTable.id, existing[0]!.id))
        .returning();
      res.status(201).json(updated);
      return;
    }

    const [subscriber] = await db
      .insert(subscribersTable)
      .values({ botId, chatId, username, firstName, lastName })
      .returning();
    res.status(201).json(subscriber);
  } catch (err) {
    req.log.error({ err }, "Failed to add subscriber");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bots/:botId/subscribers/:subscriberId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  const subscriberId = Number(req.params["subscriberId"]);
  if (Number.isNaN(botId) || Number.isNaN(subscriberId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(subscribersTable)
      .where(and(eq(subscribersTable.id, subscriberId), eq(subscribersTable.botId, botId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Subscriber not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to remove subscriber");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
