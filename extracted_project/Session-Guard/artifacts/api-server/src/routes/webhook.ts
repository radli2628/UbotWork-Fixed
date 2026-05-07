import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, botsTable } from "@workspace/db";
import { registerWebhook, deleteWebhook } from "../services/telegram";
import { handleUpdate } from "../services/webhookHandler";

const router: IRouter = Router();

router.post("/bots/:botId/webhook", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  res.status(200).send("OK");

  setImmediate(() => {
    handleUpdate(botId, req.body).catch(() => undefined);
  });
});

router.post("/bots/:botId/setup-webhook", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const domains = process.env["REPLIT_DOMAINS"] ?? "";
  const domain = domains.split(",")[0]?.trim();
  if (!domain) {
    res.status(500).json({ error: "REPLIT_DOMAINS not set — cannot determine webhook URL" });
    return;
  }

  const webhookUrl = `https://${domain}/api/bots/${botId}/webhook`;
  const ok = await registerWebhook(bot.token, webhookUrl);
  if (!ok) {
    res.status(500).json({ error: "Failed to register webhook with Telegram" });
    return;
  }

  res.json({ webhookUrl });
});

router.delete("/bots/:botId/webhook", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  await deleteWebhook(bot.token);
  res.status(204).send();
});

export default router;
