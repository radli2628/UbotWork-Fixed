import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export const otpCodesTable = pgTable("otp_codes", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OtpCode = typeof otpCodesTable.$inferSelect;
