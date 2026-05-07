import { Router, type IRouter } from "express";
import { eq, and, gt } from "drizzle-orm";
import { db, otpCodesTable, tokensTable, botsTable } from "@workspace/db";

const router: IRouter = Router({ mergeParams: true });

router.post("/bots/:botId/verify-otp", async (req, res) => {
  const botId = Number(req.params["botId"]);
  if (Number.isNaN(botId)) {
    res.status(400).json({ error: "Invalid bot ID" });
    return;
  }

  const { chatId, code } = req.body as { chatId?: string; code?: string };
  if (!chatId || !code) {
    res.status(400).json({ error: "chatId and code are required" });
    return;
  }

  const normalized = code.replace(/\s+/g, "").trim();

  try {
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, botId));
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    const [otp] = await db
      .select()
      .from(otpCodesTable)
      .where(
        and(
          eq(otpCodesTable.botId, botId),
          eq(otpCodesTable.chatId, chatId),
          eq(otpCodesTable.code, normalized),
          eq(otpCodesTable.used, false),
          gt(otpCodesTable.expiresAt, new Date()),
        ),
      );

    if (!otp) {
      res.status(401).json({ valid: false, error: "Invalid, expired, or already used OTP" });
      return;
    }

    await db
      .update(otpCodesTable)
      .set({ used: true })
      .where(eq(otpCodesTable.id, otp.id));

    const [activeToken] = await db
      .select()
      .from(tokensTable)
      .where(
        and(
          eq(tokensTable.botId, botId),
          eq(tokensTable.activatedByChatId, chatId),
          eq(tokensTable.isActivated, true),
          gt(tokensTable.expiresAt, new Date()),
        ),
      );

    res.json({
      valid: true,
      chatId,
      subscriptionActive: !!activeToken,
      expiresAt: activeToken?.expiresAt ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to verify OTP");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
