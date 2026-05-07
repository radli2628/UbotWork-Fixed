import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { botsTable } from "./bots";
import { plansTable } from "./plans";

export const paymentRequestStatusEnum = pgEnum("payment_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const paymentRequestsTable = pgTable("payment_requests", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  telegramUsername: text("telegram_username"),
  telegramFirstName: text("telegram_first_name"),
  planId: integer("plan_id").notNull().references(() => plansTable.id),
  status: paymentRequestStatusEnum("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PaymentRequest = typeof paymentRequestsTable.$inferSelect;
