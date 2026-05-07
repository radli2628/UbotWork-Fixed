import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tokensTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/bots/:botId/tokens", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }
  try {
    const tokens = await db
      .select()
      .from(tokensTable)
      .where(eq(tokensTable.botId, botId))
      .orderBy(tokensTable.createdAt);
    res.json(tokens);
  } catch (err) {
    req.log.error({ err }, "Failed to list tokens");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
