import { pgTable, text, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export interface PaymentMethod {
  type: string;
  accountNumber: string;
  holderName: string;
}

export const botSettingsTable = pgTable("bot_settings", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().unique().references(() => botsTable.id, { onDelete: "cascade" }),
  welcomeEmoji: text("welcome_emoji").notNull().default("👋"),
  successEmoji: text("success_emoji").notNull().default("✅"),
  errorEmoji: text("error_emoji").notNull().default("❌"),
  planEmoji: text("plan_emoji").notNull().default("📦"),
  tokenEmoji: text("token_emoji").notNull().default("🎉"),
  paymentEmoji: text("payment_emoji").notNull().default("💳"),
  pendingEmoji: text("pending_emoji").notNull().default("⏳"),
  welcomeText: text("welcome_text"),
  contactRequestText: text("contact_request_text"),
  tokenActivatedText: text("token_activated_text"),
  paymentConfirmedText: text("payment_confirmed_text"),
  loginOtpText: text("login_otp_text"),
  supportText: text("support_text"),
  commandPrefix: text("command_prefix").notNull().default("/"),
  paymentMethods: jsonb("payment_methods").$type<PaymentMethod[]>(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type BotSettings = typeof botSettingsTable.$inferSelect;
