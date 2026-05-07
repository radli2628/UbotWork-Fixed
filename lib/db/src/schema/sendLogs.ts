import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { broadcastsTable } from "./broadcasts";
import { subscribersTable } from "./subscribers";

export const sendLogsTable = pgTable("send_logs", {
  id: serial("id").primaryKey(),
  broadcastId: integer("broadcast_id").notNull().references(() => broadcastsTable.id, { onDelete: "cascade" }),
  subscriberId: integer("subscriber_id").notNull().references(() => subscribersTable.id, { onDelete: "cascade" }),
  success: boolean("success").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
});

export type SendLog = typeof sendLogsTable.$inferSelect;
