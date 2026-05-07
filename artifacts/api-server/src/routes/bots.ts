import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, botsTable } from "@workspace/db";
import { validateBotToken } from "../services/telegram";

const router: IRouter = Router();

router.get("/bots", async (req, res) => {
  try {
    const bots = await db.select().from(botsTable).orderBy(botsTable.createdAt);
    res.json(bots);
  } catch (err) {
    req.log.error({ err }, "Failed to list bots");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bots", async (req, res) => {
  const { name, token } = req.body as { name?: string; token?: string };

  if (!name || !token) {
    res.status(400).json({ error: "name and token are required" });
    return;
  }

  const botInfo = await validateBotToken(token);
  if (!botInfo) {
    res.status(400).json({ error: "Invalid Telegram bot token" });
    return;
  }

  try {
    const [bot] = await db
      .insert(botsTable)
      .values({ name, token, username: botInfo.username })
      .returning();
    res.status(201).json(bot);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unique")) {
      res.status(400).json({ error: "A bot with this token already exists" });
      return;
    }
    req.log.error({ err }, "Failed to create bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/bots/:botId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }
  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    res.json(bot);
  } catch (err) {
    req.log.error({ err }, "Failed to get bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/bots/:botId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const { name, superuserChatId, paymentInfo } = req.body as {
    name?: string;
    superuserChatId?: string;
    paymentInfo?: string;
  };

  const updates: Partial<typeof botsTable.$inferInsert> = { updatedAt: new Date() };
  if (name !== undefined) updates.name = name;
  if (superuserChatId !== undefined) updates.superuserChatId = superuserChatId;
  if (paymentInfo !== undefined) updates.paymentInfo = paymentInfo;

  try {
    const [updated] = await db
      .update(botsTable)
      .set(updates)
      .where(eq(botsTable.id, botId))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bots/:botId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }
  try {
    const [deleted] = await db.delete(botsTable).where(eq(botsTable.id, botId)).returning();
    if (!deleted) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete bot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
