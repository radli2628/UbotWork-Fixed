import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, userbotsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/bots/:botId/userbots", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }
  try {
    const userbots = await db
      .select()
      .from(userbotsTable)
      .where(eq(userbotsTable.botId, botId))
      .orderBy(userbotsTable.createdAt);
    res.json(userbots);
  } catch (err) {
    req.log.error({ err }, "Failed to list userbots");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bots/:botId/userbots/:chatId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  const chatId = req.params["chatId"];
  if (Number.isNaN(botId) || !chatId) {
    res.status(400).json({ error: "Invalid bot ID or chat ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(userbotsTable)
      .where(and(eq(userbotsTable.botId, botId), eq(userbotsTable.chatId, chatId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "UserBot not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to revoke userbot");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
