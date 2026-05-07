import TelegramBot from "node-telegram-bot-api";
import { logger } from "../lib/logger";

export async function validateBotToken(token: string): Promise<{ username: string } | null> {
  try {
    const bot = new TelegramBot(token);
    const me = await bot.getMe();
    return { username: me.username ?? "" };
  } catch (err) {
    logger.warn({ err }, "Failed to validate bot token");
    return null;
  }
}

export async function sendMessage(
  token: string,
  chatId: string,
  message: string,
  options?: TelegramBot.SendMessageOptions,
): Promise<boolean> {
  try {
    const bot = new TelegramBot(token);
    await bot.sendMessage(chatId, message, { parse_mode: "HTML", ...options });
    return true;
  } catch (err) {
    logger.warn({ err, chatId }, "Failed to send message to chat");
    return false;
  }
}

export async function editMessage(
  token: string,
  chatId: string,
  messageId: number,
  text: string,
  options?: TelegramBot.EditMessageTextOptions,
): Promise<boolean> {
  try {
    const bot = new TelegramBot(token);
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      ...options,
    });
    return true;
  } catch (err) {
    logger.warn({ err, chatId }, "Failed to edit message");
    return false;
  }
}

export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  try {
    const bot = new TelegramBot(token);
    await bot.answerCallbackQuery(callbackQueryId, { text });
  } catch (err) {
    logger.warn({ err }, "Failed to answer callback query");
  }
}

export async function registerWebhook(token: string, webhookUrl: string): Promise<boolean> {
  try {
    const bot = new TelegramBot(token);
    await bot.setWebHook(webhookUrl);
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to register webhook");
    return false;
  }
}

export async function deleteWebhook(token: string): Promise<boolean> {
  try {
    const bot = new TelegramBot(token);
    await bot.deleteWebHook();
    return true;
  } catch (err) {
    logger.warn({ err }, "Failed to delete webhook");
    return false;
  }
}
