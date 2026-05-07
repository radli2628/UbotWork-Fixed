import { pgTable, text, timestamp, integer, unique } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export type SessionState =
  | "idle"
  | "awaiting_contact"
  | "awaiting_choice"
  | "awaiting_token"
  | "awaiting_plan"
  | "confirming_plan"
  | "awaiting_payment"
  | "awaiting_otp"
  | "editing_setting"
  | "creating_userbot"
  | "awaiting_userbot_otp"
  | "awaiting_userbot_2fa"
  | "userbot_composing";

export const userSessionsTable = pgTable(
  "user_sessions",
  {
    id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
    botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    state: text("state").notNull().default("idle"),
    data: text("data"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("user_sessions_bot_chat_unique").on(t.botId, t.chatId)],
);

export type UserSession = typeof userSessionsTable.$inferSelect;
