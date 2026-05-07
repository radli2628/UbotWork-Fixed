import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, plansTable, botsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/bots/:botId/plans", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }
  try {
    const plans = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.botId, botId))
      .orderBy(plansTable.durationMonths);
    res.json(plans);
  } catch (err) {
    req.log.error({ err }, "Failed to list plans");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/bots/:botId/plans", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const { name, durationMonths, price } = req.body as {
    name?: string;
    durationMonths?: number;
    price?: string;
  };

  if (!name || !durationMonths || !price) {
    res.status(400).json({ error: "name, durationMonths, and price are required" });
    return;
  }

  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    const [plan] = await db
      .insert(plansTable)
      .values({ botId, name, durationMonths: Number(durationMonths), price })
      .returning();
    res.status(201).json(plan);
  } catch (err) {
    req.log.error({ err }, "Failed to create plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/bots/:botId/plans/:planId", async (req, res) => {
  const botId = Number(req.params["botId"]);
  const planId = Number(req.params["planId"]);
  if (Number.isNaN(botId) || Number.isNaN(planId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  try {
    const [deleted] = await db
      .delete(plansTable)
      .where(and(eq(plansTable.id, planId), eq(plansTable.botId, botId)))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete plan");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
