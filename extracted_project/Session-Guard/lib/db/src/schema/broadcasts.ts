import { pgTable, text, serial, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { botsTable } from "./bots";

export const broadcastStatusEnum = pgEnum("broadcast_status", [
  "draft",
  "sending",
  "completed",
  "failed",
]);

export const broadcastsTable = pgTable("broadcasts", {
  id: serial("id").primaryKey(),
  botId: integer("bot_id").notNull().references(() => botsTable.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  status: broadcastStatusEnum("status").notNull().default("draft"),
  totalRecipients: integer("total_recipients").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertBroadcastSchema = createInsertSchema(broadcastsTable).omit({
  id: true,
  status: true,
  totalRecipients: true,
  sentCount: true,
  failedCount: true,
  createdAt: true,
  completedAt: true,
});

export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type Broadcast = typeof broadcastsTable.$inferSelect;
