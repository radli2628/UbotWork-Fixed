import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";
import { plansTable } from "./plans";
import { paymentRequestsTable } from "./paymentRequests";

export const tokensTable = pgTable("tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  paymentRequestId: integer("payment_request_id").references(() => paymentRequestsTable.id),
  isActivated: boolean("is_activated").notNull().default(false),
  activatedByChatId: text("activated_by_chat_id"),
  activatedAt: timestamp("activated_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Token = typeof tokensTable.$inferSelect;
