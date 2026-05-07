import { eq } from "drizzle-orm";
import { db, botSettingsTable } from "@workspace/db";
import type { BotSettings } from "@workspace/db";

export type EditableSettingKey =
  | "welcomeText"
  | "contactRequestText"
  | "tokenActivatedText"
  | "paymentConfirmedText"
  | "loginOtpText"
  | "supportText"
  | "welcomeEmoji"
  | "successEmoji"
  | "errorEmoji"
  | "planEmoji"
  | "tokenEmoji"
  | "paymentEmoji"
  | "pendingEmoji"
  | "commandPrefix";

export const ALLOWED_PREFIXES = [".", ",", "?", "!", "/"] as const;
export type AllowedPrefix = (typeof ALLOWED_PREFIXES)[number];

export const SETTING_LABELS: Record<EditableSettingKey, string> = {
  welcomeText: "Welcome Message",
  contactRequestText: "Contact Request Message",
  tokenActivatedText: "Token Activated Message",
  paymentConfirmedText: "Payment Confirmed Message",
  loginOtpText: "Login OTP Message",
  supportText: "Support Text",
  welcomeEmoji: "Welcome Emoji",
  successEmoji: "Success Emoji",
  errorEmoji: "Error Emoji",
  planEmoji: "Plans Emoji",
  tokenEmoji: "Token Emoji",
  paymentEmoji: "Payment Emoji",
  pendingEmoji: "Pending Emoji",
  commandPrefix: "Command Prefix",
};

export const SETTING_HINTS: Record<EditableSettingKey, string> = {
  welcomeText: "Shown to new users on /start. Use {name} for their first name.",
  contactRequestText: "Shown when asking user to share their contact.",
  tokenActivatedText: "Shown after a token is successfully activated. Use {expires} for expiry date.",
  paymentConfirmedText: "Sent to user when their payment is approved. Use {token} and {plan} as placeholders.",
  loginOtpText: "Sent when user requests a login OTP. Use {{otp}} for the spaced code.",
  supportText: "Shown as support/contact info.",
  welcomeEmoji: "Emoji for welcome messages (single emoji).",
  successEmoji: "Emoji for success messages (single emoji).",
  errorEmoji: "Emoji for error messages (single emoji).",
  planEmoji: "Emoji for plan lists (single emoji).",
  tokenEmoji: "Emoji for token messages (single emoji).",
  paymentEmoji: "Emoji for payment messages (single emoji).",
  pendingEmoji: "Emoji for pending/waiting messages (single emoji).",
  commandPrefix: `Trigger character for commands. Allowed values: . , ? ! /`,
};

export async function getSettings(botId: number): Promise<BotSettings> {
  const [existing] = await db
    .select()
    .from(botSettingsTable)
    .where(eq(botSettingsTable.botId, botId));

  if (existing) return existing;

  const [created] = await db
    .insert(botSettingsTable)
    .values({ botId })
    .returning();
  return created!;
}

export async function saveSetting(
  botId: number,
  key: EditableSettingKey,
  value: string,
): Promise<void> {
  await db
    .insert(botSettingsTable)
    .values({ botId, [key]: value, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [botSettingsTable.botId],
      set: { [key]: value, updatedAt: new Date() },
    });
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (str, [k, v]) => str.replace(new RegExp(`\\{\\{?${k}\\}?\\}`, "g"), v),
    template,
  );
}
