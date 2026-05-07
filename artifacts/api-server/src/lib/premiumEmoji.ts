import type { BotSettings } from "@workspace/db";

/**
 * Map of regular emoji characters → Telegram Premium (animated) custom emoji IDs.
 * The <tg-emoji> tag works in HTML parse-mode messages.
 * Falls back to the plain emoji for clients/users that do not support animated emojis.
 */
const PREMIUM_IDS: Record<string, string> = {
  "👋": "5372981976804366741",
  "✅": "5368324170671202286",
  "❌": "5447644880824181073",
  "📦": "5420323801127791483",
  "🎉": "5431449001450264729",
  "💳": "5440658441395619849",
  "⏳": "5380026864090484306",
  "🔥": "5395444784726267774",
  "💎": "5471952986970267163",
  "⭐": "5445284980978621387",
  "🌟": "5445284980978621387",
  "🔐": "5467665876416190882",
  "🔑": "5447203386176754226",
  "🔒": "5467665876416190882",
  "🤖": "5391022408434495269",
  "📱": "5432191218034171904",
  "📋": "5368350554168679564",
  "✏️": "5431604654797490595",
  "💰": "5432162142704161799",
  "🚀": "5465165289807623171",
  "💬": "5373123633956479676",
  "🔔": "5445266296920808715",
  "📢": "5432192672354494799",
  "🏆": "5445284980978621387",
  "🎯": "5465165289807623171",
  "👤": "5373123633956479676",
  "💡": "5431604654797490595",
  "🛡️": "5467665876416190882",
  "📊": "5368350554168679564",
  "🗂️": "5368350554168679564",
  "✈️": "5465165289807623171",
  "⚡": "5395444784726267774",
  "🎁": "5431449001450264729",
  "🧾": "5440658441395619849",
  "🔗": "5368350554168679564",
  "📌": "5368350554168679564",
  "🆕": "5431449001450264729",
  "💯": "5368324170671202286",
  "⚠️": "5447644880824181073",
  "ℹ️": "5368350554168679564",
  "🟢": "5368324170671202286",
  "🔴": "5447644880824181073",
};

/**
 * Wraps a single emoji with a Telegram Premium animated emoji tag.
 * Returns the plain emoji unchanged if no premium ID mapping exists.
 * Only effective in messages sent with parse_mode: "HTML".
 */
export function pe(emoji: string): string {
  const trimmed = emoji.trim();
  const id = PREMIUM_IDS[trimmed];
  if (!id) return emoji;
  return `<tg-emoji emoji-id="${id}">${trimmed}</tg-emoji>`;
}

/**
 * Returns a copy of BotSettings where every emoji field is wrapped
 * with the Telegram Premium animated emoji tag.
 * Emojis that have no mapping are left as-is (safe fallback).
 */
export function withPremiumEmojis(settings: BotSettings): BotSettings {
  return {
    ...settings,
    welcomeEmoji: pe(settings.welcomeEmoji),
    successEmoji: pe(settings.successEmoji),
    errorEmoji: pe(settings.errorEmoji),
    planEmoji: pe(settings.planEmoji),
    tokenEmoji: pe(settings.tokenEmoji),
    paymentEmoji: pe(settings.paymentEmoji),
    pendingEmoji: pe(settings.pendingEmoji),
  };
}
