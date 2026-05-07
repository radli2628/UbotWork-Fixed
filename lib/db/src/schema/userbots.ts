import { pgTable, text, serial, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";

export const userbotsTable = pgTable(
  "userbots",
  {
    id: serial("id").primaryKey(),
    botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
    chatId: text("chat_id").notNull(),
    phone: text("phone").notNull(),
    sessionString: text("session_string"),
    telegramUserId: text("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    telegramFirstName: text("telegram_first_name"),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [unique("userbots_bot_chat_unique").on(t.botId, t.chatId)],
);

export type Userbot = typeof userbotsTable.$inferSelect;
