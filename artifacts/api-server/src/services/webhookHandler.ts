import TelegramBot from "node-telegram-bot-api";
import { eq, and, gt } from "drizzle-orm";
import {
  db,
  botsTable,
  plansTable,
  userSessionsTable,
  paymentRequestsTable,
  tokensTable,
  userbotsTable,
} from "@workspace/db";
import type { Bot, Plan, SessionState, BotSettings, Userbot } from "@workspace/db";
import { sendMessage, editMessage, answerCallbackQuery } from "./telegram";
import { logger } from "../lib/logger";
import { generateToken } from "../lib/tokenUtils";
import {
  getSettings,
  saveSetting,
  renderTemplate,
  SETTING_LABELS,
  SETTING_HINTS,
} from "./botSettings";
import type { EditableSettingKey } from "./botSettings";
import {
  sendPhoneCode,
  signInWithCode,
  signInWithPassword,
  getMe,
  getGroupsAndChannels,
  broadcastToAll,
} from "./telegramMtproto";

const OWNER_CHAT_ID = "6071113355";

// ─── Session helpers ──────────────────────────────────────────────────────────

async function getSession(botId: number, chatId: string) {
  const [session] = await db
    .select()
    .from(userSessionsTable)
    .where(and(eq(userSessionsTable.botId, botId), eq(userSessionsTable.chatId, chatId)));
  return session ?? null;
}

async function upsertSession(
  botId: number,
  chatId: string,
  state: SessionState,
  data?: Record<string, unknown>,
) {
  if (data !== undefined) {
    const dataStr = Object.keys(data).length > 0 ? JSON.stringify(data) : null;
    await db
      .insert(userSessionsTable)
      .values({ botId, chatId, state, data: dataStr, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [userSessionsTable.botId, userSessionsTable.chatId],
        set: { state, data: dataStr, updatedAt: new Date() },
      });
  } else {
    await db
      .insert(userSessionsTable)
      .values({ botId, chatId, state, data: null, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [userSessionsTable.botId, userSessionsTable.chatId],
        set: { state, updatedAt: new Date() },
      });
  }
}

function parseSessionData(session: { data: string | null }): Record<string, unknown> {
  if (!session.data) return {};
  try {
    return JSON.parse(session.data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

// ─── Subscription & userbot checks ───────────────────────────────────────────

async function getActiveToken(botId: number, chatId: string) {
  const [token] = await db
    .select()
    .from(tokensTable)
    .where(
      and(
        eq(tokensTable.botId, botId),
        eq(tokensTable.activatedByChatId, chatId),
        eq(tokensTable.isActivated, true),
        gt(tokensTable.expiresAt, new Date()),
      ),
    );
  return token ?? null;
}

async function getActiveUserbot(botId: number, chatId: string) {
  const [userbot] = await db
    .select()
    .from(userbotsTable)
    .where(
      and(
        eq(userbotsTable.botId, botId),
        eq(userbotsTable.chatId, chatId),
        eq(userbotsTable.isActive, true),
      ),
    );
  return userbot ?? null;
}

async function saveUserbotSession(
  botId: number,
  chatId: string,
  phone: string,
  sessionString: string,
  me: { id: string; username?: string; firstName?: string },
) {
  await db
    .insert(userbotsTable)
    .values({
      botId,
      chatId,
      phone,
      sessionString,
      telegramUserId: me.id,
      telegramUsername: me.username,
      telegramFirstName: me.firstName,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: [userbotsTable.botId, userbotsTable.chatId],
      set: {
        sessionString,
        isActive: true,
        telegramUserId: me.id,
        telegramUsername: me.username,
        telegramFirstName: me.firstName,
        updatedAt: new Date(),
      },
    });
}

// ─── Menus ────────────────────────────────────────────────────────────────────

async function sendUserbotMenu(
  bot: Bot,
  chatId: string,
  userbot: Userbot,
  settings: BotSettings,
) {
  const displayName = userbot.telegramUsername
    ? `@${userbot.telegramUsername}`
    : userbot.telegramFirstName ?? userbot.phone;

  await sendMessage(
    bot.token,
    chatId,
    `🤖 <b>UserBot Active</b>\n\nAccount: <b>${displayName}</b>\n\nWhat would you like to do?`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📢 New Broadcast", callback_data: "userbot_broadcast" }],
          [{ text: "📊 My Groups & Channels", callback_data: "userbot_groups" }],
          [
            { text: "🔄 Reconnect", callback_data: "userbot_reconnect" },
            { text: "🗑 Remove UserBot", callback_data: "userbot_remove" },
          ],
        ],
      },
    },
  );
  await upsertSession(bot.id, chatId, "idle");
}

async function sendSubscriberMenu(
  bot: Bot,
  chatId: string,
  firstName: string,
  settings: BotSettings,
) {
  const active = await getActiveToken(bot.id, chatId);
  if (!active) {
    await sendWelcomeChoices(bot, chatId, firstName, settings);
    return;
  }

  const userbot = await getActiveUserbot(bot.id, chatId);
  if (userbot) {
    await sendUserbotMenu(bot, chatId, userbot, settings);
    return;
  }

  const expires = active.expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const daysLeft = Math.max(
    0,
    Math.ceil((active.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );
  const [plan] = await db
    .select()
    .from(plansTable)
    .where(eq(plansTable.id, active.planId));
  const planName = plan?.name ?? "Subscription";
  const expiryNote =
    daysLeft <= 7
      ? "\n\n⚠️ <i>Subscription expiring soon — contact admin to renew.</i>"
      : "";

  await sendMessage(
    bot.token,
    chatId,
    `${settings.welcomeEmoji} <b>Welcome back, ${firstName}!</b>\n\n` +
      `${settings.successEmoji} <b>${planName}</b>\n` +
      `Expires: <b>${expires}</b> · ${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` +
      expiryNote +
      `\n\n<i>Tap below to create your UserBot and start broadcasting.</i>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "🤖 Create My UserBot", callback_data: "create_userbot" }],
        ],
      },
    },
  );
  await upsertSession(bot.id, chatId, "idle");
}

async function sendContactRequest(
  bot: Bot,
  chatId: string,
  settings: BotSettings,
  state: SessionState = "awaiting_contact",
) {
  const text =
    settings.contactRequestText ??
    `${settings.welcomeEmoji} <b>Welcome!</b>\n\nTo get started, please share your contact info so we can identify you.\n\nTap the button below — it takes just one tap.`;

  await sendMessage(bot.token, chatId, text, {
    reply_markup: {
      keyboard: [
        [
          {
            text: "📱 Share My Contact Info",
            request_contact: true,
          } as TelegramBot.KeyboardButton,
        ],
      ],
      resize_keyboard: true,
      one_time_keyboard: true,
    } as TelegramBot.ReplyKeyboardMarkup,
  });
  await upsertSession(bot.id, chatId, state);
}

async function sendWelcomeChoices(
  bot: Bot,
  chatId: string,
  firstName: string,
  settings: BotSettings,
) {
  const text = settings.welcomeText
    ? renderTemplate(settings.welcomeText, { name: firstName })
    : `${settings.successEmoji} <b>Identity verified, ${firstName}!</b>\n\nTo access this service you need an active subscription.\n\nDo you have an <b>activation token</b>?`;

  await sendMessage(bot.token, chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: `${settings.successEmoji} Yes, I have a token`, callback_data: "choose_token" },
          { text: `${settings.planEmoji} No, show me plans`, callback_data: "choose_plan" },
        ],
      ],
    },
  });
  await upsertSession(bot.id, chatId, "awaiting_choice");
}

// ─── Plan list / confirmation / payment ──────────────────────────────────────

async function sendPlanList(
  bot: Bot,
  chatId: string,
  settings: BotSettings,
  messageId?: number,
) {
  const plans = await db
    .select()
    .from(plansTable)
    .where(and(eq(plansTable.botId, bot.id), eq(plansTable.isActive, true)))
    .orderBy(plansTable.durationMonths);

  if (plans.length === 0) {
    await sendMessage(
      bot.token,
      chatId,
      "⚠️ No subscription plans available right now. Please contact the admin.",
    );
    return;
  }

  const keyboard: TelegramBot.InlineKeyboardButton[][] = plans.map((p) => [
    { text: `${p.name} — ${p.price}`, callback_data: `plan:${p.id}` },
  ]);

  const text =
    `${settings.planEmoji} <b>Choose a subscription plan:</b>\n\n` +
    plans.map((p, i) => `${i + 1}. <b>${p.name}</b> — ${p.price}`).join("\n");

  if (messageId) {
    await editMessage(bot.token, chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } else {
    await sendMessage(bot.token, chatId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }
  await upsertSession(bot.id, chatId, "awaiting_plan");
}

async function sendPlanConfirmation(
  bot: Bot,
  chatId: string,
  plan: Plan,
  settings: BotSettings,
  messageId?: number,
) {
  const text =
    `📋 <b>Order Summary</b>\n\nPlan: <b>${plan.name}</b>\nDuration: <b>${plan.durationMonths} month(s)</b>\nPrice: <b>${plan.price}</b>\n\nDo you want to proceed?`;

  const keyboard = [
    [
      { text: `${settings.successEmoji} Confirm`, callback_data: `confirm_plan:${plan.id}` },
      { text: "← Back to plans", callback_data: "choose_plan" },
    ],
  ];

  if (messageId) {
    await editMessage(bot.token, chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } else {
    await sendMessage(bot.token, chatId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }
  await upsertSession(bot.id, chatId, "confirming_plan", { planId: plan.id });
}

async function sendPaymentInfo(
  bot: Bot,
  chatId: string,
  telegramUsername: string | undefined,
  telegramFirstName: string | undefined,
  plan: Plan,
  settings: BotSettings,
  messageId?: number,
) {
  const [req] = await db
    .insert(paymentRequestsTable)
    .values({
      botId: bot.id,
      chatId,
      telegramUsername: telegramUsername ?? null,
      telegramFirstName: telegramFirstName ?? null,
      planId: plan.id,
      status: "pending",
    })
    .returning();

  const methods = settings.paymentMethods ?? [];

  let text: string;
  let keyboard: TelegramBot.InlineKeyboardButton[][] = [];

  if (methods.length > 0) {
    const methodLines = methods
      .map((m) => `• <b>${m.type}</b>\n  Nomor: <code>${m.accountNumber}</code>\n  A/n: ${m.holderName}`)
      .join("\n\n");

    text =
      `${settings.paymentEmoji} <b>Instruksi Pembayaran</b>\n\n` +
      `<b>Pesanan Anda:</b> ${plan.name} (${plan.price})\n` +
      `<b>Request ID:</b> #${req!.id}\n\n` +
      `Silakan transfer ke salah satu metode berikut:\n\n${methodLines}\n\n` +
      `${settings.pendingEmoji} Setelah transfer, tap tombol di bawah untuk menyalin nomor rekening, lalu tunggu konfirmasi dari admin.`;

    keyboard = methods.map((m) => [
      {
        text: `${m.type}: ${m.accountNumber}`,
        callback_data: `copy_payment:${m.accountNumber}`,
      },
    ]);
  } else {
    const paymentText = bot.paymentInfo ?? "Please contact the admin for payment details.";
    text =
      `${settings.paymentEmoji} <b>Payment Instructions</b>\n\n${paymentText}\n\n---\n` +
      `<b>Your order:</b> ${plan.name} (${plan.price})\n<b>Request ID:</b> #${req!.id}\n\n` +
      `${settings.pendingEmoji} Once you complete payment, the admin will verify and send your activation token shortly.`;
  }

  if (messageId) {
    await editMessage(bot.token, chatId, messageId, text, {
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    });
  } else {
    await sendMessage(bot.token, chatId, text, {
      reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined,
    });
  }
  await upsertSession(bot.id, chatId, "awaiting_payment", { paymentRequestId: req!.id });

  if (bot.superuserChatId) {
    const userRef = telegramUsername
      ? `@${telegramUsername}`
      : telegramFirstName ?? chatId;
    await sendMessage(
      bot.token,
      bot.superuserChatId,
      `🔔 <b>New Payment Request #${req!.id}</b>\n\nUser: ${userRef} (chat: <code>${chatId}</code>)\nPlan: <b>${plan.name}</b> — ${plan.price}\n\nTo approve: /approve ${req!.id}\nTo reject: /reject ${req!.id} [reason]`,
    );
  }
}

// ─── Token input ──────────────────────────────────────────────────────────────

async function handleTokenInput(
  bot: Bot,
  chatId: string,
  tokenText: string,
  firstName: string,
  settings: BotSettings,
) {
  const tokenVal = tokenText.trim().toUpperCase();

  const [found] = await db
    .select()
    .from(tokensTable)
    .where(and(eq(tokensTable.token, tokenVal), eq(tokensTable.botId, bot.id)));

  if (!found) {
    await sendMessage(
      bot.token,
      chatId,
      `${settings.errorEmoji} <b>Invalid token.</b>\n\nThe token you entered doesn't exist. Please double-check and try again.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `${settings.planEmoji} View plans instead`, callback_data: "choose_plan" }],
          ],
        },
      },
    );
    return;
  }

  if (found.isActivated && found.activatedByChatId !== chatId) {
    await sendMessage(
      bot.token,
      chatId,
      `${settings.errorEmoji} <b>Token already used.</b>\n\nThis token has already been activated by another user.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `${settings.planEmoji} View plans instead`, callback_data: "choose_plan" }],
          ],
        },
      },
    );
    return;
  }

  if (found.expiresAt < new Date()) {
    await sendMessage(
      bot.token,
      chatId,
      `⏰ <b>Token expired.</b>\n\nThis token has already expired. Please purchase a new plan.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: `${settings.planEmoji} View plans`, callback_data: "choose_plan" }],
          ],
        },
      },
    );
    return;
  }

  await db
    .update(tokensTable)
    .set({ isActivated: true, activatedByChatId: chatId, activatedAt: new Date() })
    .where(eq(tokensTable.id, found.id));

  const expires = found.expiresAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const activatedMsg = settings.tokenActivatedText
    ? renderTemplate(settings.tokenActivatedText, { expires })
    : `${settings.tokenEmoji} <b>Token activated!</b>\n\nYour subscription is now active.\nExpires: <b>${expires}</b>`;

  await sendMessage(bot.token, chatId, activatedMsg);
  await upsertSession(bot.id, chatId, "idle");
  await sendSubscriberMenu(bot, chatId, firstName, settings);
}

// ─── UserBot creation ─────────────────────────────────────────────────────────

async function startUserbotCreation(
  bot: Bot,
  chatId: string,
  phone: string,
  settings: BotSettings,
) {
  await sendMessage(
    bot.token,
    chatId,
    `${settings.pendingEmoji} <b>Sending verification code...</b>\n\nTelegram is sending a login code to your account. Please wait.`,
  );

  try {
    const { phoneCodeHash, tempSession } = await sendPhoneCode(phone);
    await upsertSession(bot.id, chatId, "awaiting_userbot_otp", { phone, phoneCodeHash, tempSession });
    await sendMessage(
      bot.token,
      chatId,
      `${settings.successEmoji} <b>Code sent!</b>\n\nTelegram has sent a verification code to your Telegram app.\n\n` +
        `Enter it here with a <b>space between each digit</b> to avoid detection:\n\nExample: <code>1 2 3 4 5</code>`,
    );
  } catch (err) {
    logger.warn({ err, chatId }, "sendPhoneCode failed");
    await sendMessage(
      bot.token,
      chatId,
      `${settings.errorEmoji} <b>Failed to send code.</b>\n\nCould not reach Telegram. Please try again later.`,
    );
  }
}

// ─── Owner panel ──────────────────────────────────────────────────────────────

async function sendOwnerPanel(bot: Bot, chatId: string) {
  const pending = await db
    .select()
    .from(paymentRequestsTable)
    .where(
      and(
        eq(paymentRequestsTable.botId, bot.id),
        eq(paymentRequestsTable.status, "pending"),
      ),
    );

  const userbots = await db
    .select()
    .from(userbotsTable)
    .where(and(eq(userbotsTable.botId, bot.id), eq(userbotsTable.isActive, true)));

  await sendMessage(
    bot.token,
    chatId,
    `🔐 <b>Bot Manager</b>\n\n<b>${bot.name}</b>${bot.username ? ` (@${bot.username})` : ""}\nPending payments: <b>${pending.length}</b>\nActive userbots: <b>${userbots.length}</b>`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `⏳ Pending Requests (${pending.length})`, callback_data: "owner_pending" }],
          [{ text: `🤖 UserBots (${userbots.length} active)`, callback_data: "owner_userbots" }],
          [
            { text: "⚙️ Customize Bot", callback_data: "owner_customize" },
            { text: "📋 View Settings", callback_data: "owner_viewsettings" },
          ],
          [{ text: "❓ Admin Help", callback_data: "owner_help" }],
        ],
      },
    },
  );
}

async function editOwnerCustomize(bot: Bot, chatId: string, messageId: number) {
  await editMessage(
    bot.token, chatId, messageId,
    `⚙️ <b>Customize ${bot.name}</b>\n\nWhat would you like to change?`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "📝 Messages", callback_data: "owner_msgs" },
            { text: "😀 Emojis", callback_data: "owner_emojis" },
          ],
          [{ text: "← Back", callback_data: "owner_menu" }],
        ],
      },
    },
  );
}

async function editOwnerMessages(bot: Bot, chatId: string, messageId: number) {
  await editMessage(
    bot.token, chatId, messageId,
    `📝 <b>Message Templates</b>\n\nTap a message to edit it. Changes take effect immediately.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "👋 Welcome", callback_data: "owner_set:welcomeText" },
            { text: "📱 Contact Request", callback_data: "owner_set:contactRequestText" },
          ],
          [
            { text: "🎉 Token Activated", callback_data: "owner_set:tokenActivatedText" },
            { text: "💳 Payment Confirmed", callback_data: "owner_set:paymentConfirmedText" },
          ],
          [
            { text: "🔐 Login OTP", callback_data: "owner_set:loginOtpText" },
            { text: "📞 Support Text", callback_data: "owner_set:supportText" },
          ],
          [{ text: "← Customize", callback_data: "owner_customize" }],
        ],
      },
    },
  );
}

async function editOwnerEmojis(
  bot: Bot,
  chatId: string,
  messageId: number,
  settings: BotSettings,
) {
  await editMessage(
    bot.token, chatId, messageId,
    `😀 <b>Emoji Settings</b>\n\nTap an emoji to change it.`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: `👋 Welcome [${settings.welcomeEmoji}]`, callback_data: "owner_set:welcomeEmoji" },
            { text: `✅ Success [${settings.successEmoji}]`, callback_data: "owner_set:successEmoji" },
          ],
          [
            { text: `❌ Error [${settings.errorEmoji}]`, callback_data: "owner_set:errorEmoji" },
            { text: `📦 Plans [${settings.planEmoji}]`, callback_data: "owner_set:planEmoji" },
          ],
          [
            { text: `🎉 Token [${settings.tokenEmoji}]`, callback_data: "owner_set:tokenEmoji" },
            { text: `💳 Payment [${settings.paymentEmoji}]`, callback_data: "owner_set:paymentEmoji" },
          ],
          [
            { text: `⏳ Pending [${settings.pendingEmoji}]`, callback_data: "owner_set:pendingEmoji" },
          ],
          [{ text: "← Customize", callback_data: "owner_customize" }],
        ],
      },
    },
  );
}

// ─── /owner command ───────────────────────────────────────────────────────────

async function handleOwnerCommand(bot: Bot, chatId: string) {
  if (chatId !== OWNER_CHAT_ID) return;

  if (bot.superuserChatId !== OWNER_CHAT_ID) {
    await db
      .update(botsTable)
      .set({ superuserChatId: OWNER_CHAT_ID, updatedAt: new Date() })
      .where(eq(botsTable.id, bot.id));
    await sendMessage(
      bot.token,
      chatId,
      `🔐 <b>Ownership claimed!</b>\n\nYou are now the superuser of <b>${bot.name}</b>.`,
    );
  }

  await sendOwnerPanel(bot, chatId);
}

// ─── Superuser text commands ──────────────────────────────────────────────────

async function handleSuperuserCommand(
  bot: Bot,
  chatId: string,
  text: string,
  settings: BotSettings,
) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();

  if (cmd === "/pending" || cmd === "/owner") {
    await sendOwnerPanel(bot, chatId);
    return;
  }

  if (cmd === "/approve" && parts[1]) {
    const reqId = Number(parts[1]);
    if (Number.isNaN(reqId)) {
      await sendMessage(bot.token, chatId, "❌ Invalid request ID.");
      return;
    }

    const [req] = await db
      .select()
      .from(paymentRequestsTable)
      .where(
        and(
          eq(paymentRequestsTable.id, reqId),
          eq(paymentRequestsTable.botId, bot.id),
        ),
      );
    if (!req) {
      await sendMessage(bot.token, chatId, `❌ Payment request #${reqId} not found.`);
      return;
    }
    if (req.status !== "pending") {
      await sendMessage(bot.token, chatId, `⚠️ Request #${reqId} is already ${req.status}.`);
      return;
    }

    const [plan] = await db
      .select()
      .from(plansTable)
      .where(eq(plansTable.id, req.planId));
    if (!plan) {
      await sendMessage(bot.token, chatId, "❌ Plan not found.");
      return;
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);

    await db.insert(tokensTable).values({
      token,
      botId: bot.id,
      planId: plan.id,
      paymentRequestId: req.id,
      expiresAt,
    });
    await db
      .update(paymentRequestsTable)
      .set({ status: "approved", updatedAt: new Date() })
      .where(eq(paymentRequestsTable.id, reqId));

    await sendMessage(
      bot.token,
      chatId,
      `✅ Payment request #${reqId} approved. Token sent to user.`,
    );

    const expires = expiresAt.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const confirmedMsg = settings.paymentConfirmedText
      ? renderTemplate(settings.paymentConfirmedText, {
          token,
          plan: plan.name,
          expires,
        })
      : `${settings.tokenEmoji} <b>Payment Confirmed!</b>\n\nYour activation token:\n\n<code>${token}</code>\n\nPlan: <b>${plan.name}</b> | Expires: <b>${expires}</b>\n\nSend /start and enter this token to activate your subscription.`;

    await sendMessage(bot.token, req.chatId, confirmedMsg);
    return;
  }

  if (cmd === "/reject" && parts[1]) {
    const reqId = Number(parts[1]);
    if (Number.isNaN(reqId)) {
      await sendMessage(bot.token, chatId, "❌ Invalid request ID.");
      return;
    }

    const reason = parts.slice(2).join(" ") || "No reason provided.";
    const [req] = await db
      .select()
      .from(paymentRequestsTable)
      .where(
        and(
          eq(paymentRequestsTable.id, reqId),
          eq(paymentRequestsTable.botId, bot.id),
        ),
      );
    if (!req) {
      await sendMessage(bot.token, chatId, `❌ Payment request #${reqId} not found.`);
      return;
    }
    if (req.status !== "pending") {
      await sendMessage(bot.token, chatId, `⚠️ Request #${reqId} is already ${req.status}.`);
      return;
    }

    await db
      .update(paymentRequestsTable)
      .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
      .where(eq(paymentRequestsTable.id, reqId));

    await sendMessage(bot.token, chatId, `❌ Payment request #${reqId} rejected.`);
    await sendMessage(
      bot.token,
      req.chatId,
      `${settings.errorEmoji} <b>Payment Not Confirmed</b>\n\nYour request #${reqId} was not approved.\n\n<b>Reason:</b> ${reason}\n\nPlease try again or contact support.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${settings.planEmoji} View plans`,
                callback_data: "choose_plan",
              },
            ],
          ],
        },
      },
    );
    return;
  }

  await sendMessage(
    bot.token,
    chatId,
    `🔧 <b>Admin Commands</b>\n\n/pending — Open bot manager\n/approve &lt;id&gt; — Approve payment\n/reject &lt;id&gt; [reason] — Reject payment\n/owner — Open bot manager`,
  );
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export async function handleUpdate(
  botId: number,
  update: TelegramBot.Update,
): Promise<void> {
  try {
    const [bot] = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.id, botId));
    if (!bot) return;

    const settings = await getSettings(botId);

    // ── Callback queries ───────────────────────────────────────────────────────
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat.id ?? cq.from.id);
      const messageId = cq.message?.message_id!;
      const data = cq.data ?? "";
      const firstName = cq.from.first_name ?? "there";
      const isSuperuser =
        bot.superuserChatId != null && chatId === bot.superuserChatId;

      await answerCallbackQuery(bot.token, cq.id);

      // ── Copy payment account number
      if (data.startsWith("copy_payment:")) {
        const accountNumber = data.replace("copy_payment:", "");
        await sendMessage(
          bot.token,
          chatId,
          `<code>${accountNumber}</code>\n\nSalin nomor di atas dan transfer sejumlah yang sesuai. Admin akan segera memverifikasi pembayaran Anda.`,
        );
        return;
      }

      // ── Subscription flow
      if (data === "choose_token") {
        await editMessage(
          bot.token,
          chatId,
          messageId,
          "🔑 Please enter your <b>activation token</b>:",
        );
        await upsertSession(bot.id, chatId, "awaiting_token");
        return;
      }
      if (data === "choose_plan") {
        await sendPlanList(bot, chatId, settings, messageId);
        return;
      }
      if (data.startsWith("plan:")) {
        const planId = Number(data.split(":")[1]);
        const [plan] = await db
          .select()
          .from(plansTable)
          .where(eq(plansTable.id, planId));
        if (!plan) return;
        await sendPlanConfirmation(bot, chatId, plan, settings, messageId);
        return;
      }
      if (data.startsWith("confirm_plan:")) {
        const planId = Number(data.split(":")[1]);
        const [plan] = await db
          .select()
          .from(plansTable)
          .where(eq(plansTable.id, planId));
        if (!plan) return;
        await sendPaymentInfo(
          bot,
          chatId,
          cq.from.username,
          cq.from.first_name,
          plan,
          settings,
          messageId,
        );
        return;
      }

      // ── UserBot flow
      if (data === "create_userbot") {
        const session = await getSession(bot.id, chatId);
        const sessionData = session ? parseSessionData(session) : {};
        const phone = sessionData["phone"] as string | undefined;
        if (phone) {
          await startUserbotCreation(bot, chatId, phone, settings);
        } else {
          await sendContactRequest(bot, chatId, settings, "creating_userbot");
        }
        return;
      }
      if (data === "userbot_broadcast") {
        const userbot = await getActiveUserbot(bot.id, chatId);
        if (!userbot) {
          await sendMessage(
            bot.token,
            chatId,
            "❌ No active UserBot. Please create one first.",
          );
          return;
        }
        await sendMessage(
          bot.token,
          chatId,
          "📢 <b>New Broadcast</b>\n\nType the message you want to broadcast to all your groups and channels:",
        );
        await upsertSession(bot.id, chatId, "userbot_composing");
        return;
      }
      if (data === "userbot_groups") {
        const userbot = await getActiveUserbot(bot.id, chatId);
        if (!userbot?.sessionString) {
          await sendMessage(bot.token, chatId, "❌ No active UserBot session.");
          return;
        }
        await sendMessage(
          bot.token,
          chatId,
          `${settings.pendingEmoji} Fetching your groups and channels...`,
        );
        try {
          const groups = await getGroupsAndChannels(userbot.sessionString);
          if (groups.length === 0) {
            await sendMessage(
              bot.token,
              chatId,
              "📊 You are not a member of any groups or channels.",
            );
            return;
          }
          const lines = groups
            .slice(0, 30)
            .map(
              (g, i) =>
                `${i + 1}. ${g.type === "channel" ? "📢" : "👥"} ${g.name}`,
            );
          await sendMessage(
            bot.token,
            chatId,
            `📊 <b>Your Groups & Channels (${groups.length})</b>\n\n${lines.join("\n")}`,
          );
        } catch {
          await sendMessage(
            bot.token,
            chatId,
            `${settings.errorEmoji} Failed to fetch groups. Try reconnecting.`,
          );
        }
        return;
      }
      if (data === "userbot_reconnect") {
        const userbot = await getActiveUserbot(bot.id, chatId);
        const session = await getSession(bot.id, chatId);
        const sessionData = session ? parseSessionData(session) : {};
        const phone =
          (sessionData["phone"] as string | undefined) ?? userbot?.phone;
        if (!phone) {
          await sendContactRequest(bot, chatId, settings, "creating_userbot");
          return;
        }
        await startUserbotCreation(bot, chatId, phone, settings);
        return;
      }
      if (data === "userbot_remove") {
        await db
          .update(userbotsTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(
            and(
              eq(userbotsTable.botId, bot.id),
              eq(userbotsTable.chatId, chatId),
            ),
          );
        await sendMessage(
          bot.token,
          chatId,
          "🗑 <b>UserBot removed.</b>\n\nYour session has been cleared.",
        );
        await sendSubscriberMenu(bot, chatId, firstName, settings);
        return;
      }

      // ── Owner panel callbacks (superuser only)
      if (isSuperuser) {
        if (data === "owner_menu") {
          const [pendingMenuCount, userbotsMenuCount] = await Promise.all([
            db.select().from(paymentRequestsTable).where(and(eq(paymentRequestsTable.botId, bot.id), eq(paymentRequestsTable.status, "pending"))),
            db.select().from(userbotsTable).where(and(eq(userbotsTable.botId, bot.id), eq(userbotsTable.isActive, true))),
          ]);
          await editMessage(
            bot.token,
            chatId,
            messageId,
            `🔐 <b>Bot Manager</b> — ${bot.name}\n\nPending payments: <b>${pendingMenuCount.length}</b>\nActive userbots: <b>${userbotsMenuCount.length}</b>`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: `⏳ Pending Requests (${pendingMenuCount.length})`, callback_data: "owner_pending" }],
                  [{ text: `🤖 UserBots (${userbotsMenuCount.length} active)`, callback_data: "owner_userbots" }],
                  [
                    { text: "⚙️ Customize Bot", callback_data: "owner_customize" },
                    { text: "📋 View Settings", callback_data: "owner_viewsettings" },
                  ],
                  [{ text: "❓ Admin Help", callback_data: "owner_help" }],
                ],
              },
            },
          );
          return;
        }

        if (data === "owner_pending") {
          const pending = await db
            .select({ req: paymentRequestsTable, plan: plansTable })
            .from(paymentRequestsTable)
            .innerJoin(
              plansTable,
              eq(paymentRequestsTable.planId, plansTable.id),
            )
            .where(
              and(
                eq(paymentRequestsTable.botId, bot.id),
                eq(paymentRequestsTable.status, "pending"),
              ),
            );

          const bodyText =
            pending.length === 0
              ? "✅ No pending payment requests."
              : `⏳ <b>Pending Requests (${pending.length})</b>\n\n` +
                pending
                  .map(({ req, plan }) => {
                    const user = req.telegramUsername
                      ? `@${req.telegramUsername}`
                      : req.telegramFirstName ?? req.chatId;
                    return `• <b>#${req.id}</b> — ${user}\n  Plan: ${plan.name} (${plan.price})`;
                  })
                  .join("\n\n");

          const requestButtons: TelegramBot.InlineKeyboardButton[][] = pending.map(({ req }) => [
            { text: `✅ Approve #${req.id}`, callback_data: `owner_approve:${req.id}` },
            { text: `❌ Reject #${req.id}`, callback_data: `owner_reject:${req.id}` },
          ]);

          await editMessage(bot.token, chatId, messageId, bodyText, {
            reply_markup: {
              inline_keyboard: [
                ...requestButtons,
                [{ text: "← Back", callback_data: "owner_menu" }],
              ],
            },
          });
          return;
        }

        if (data.startsWith("owner_approve:")) {
          const reqId = Number(data.replace("owner_approve:", ""));
          const [req] = await db
            .select()
            .from(paymentRequestsTable)
            .where(and(eq(paymentRequestsTable.id, reqId), eq(paymentRequestsTable.botId, bot.id)));
          if (!req || req.status !== "pending") {
            await editMessage(bot.token, chatId, messageId, `⚠️ Request #${reqId} is not pending or not found.`, {
              reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "owner_pending" }]] },
            });
            return;
          }
          const [plan] = await db.select().from(plansTable).where(eq(plansTable.id, req.planId));
          if (!plan) {
            await editMessage(bot.token, chatId, messageId, "❌ Plan not found.", {
              reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "owner_pending" }]] },
            });
            return;
          }
          const token = generateToken();
          const expiresAt = new Date();
          expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);
          await db.insert(tokensTable).values({ token, botId: bot.id, planId: plan.id, paymentRequestId: req.id, expiresAt });
          await db.update(paymentRequestsTable).set({ status: "approved", updatedAt: new Date() }).where(eq(paymentRequestsTable.id, reqId));
          const expires = expiresAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
          const confirmedMsg = settings.paymentConfirmedText
            ? renderTemplate(settings.paymentConfirmedText, { token, plan: plan.name, expires })
            : `${settings.tokenEmoji} <b>Payment Confirmed!</b>\n\nYour activation token:\n\n<code>${token}</code>\n\nPlan: <b>${plan.name}</b> | Expires: <b>${expires}</b>\n\nSend /start and enter this token to activate your subscription.`;
          await sendMessage(bot.token, req.chatId, confirmedMsg);
          await editMessage(bot.token, chatId, messageId, `✅ Request #${reqId} approved. Token sent to user.`, {
            reply_markup: { inline_keyboard: [[{ text: "← Pending", callback_data: "owner_pending" }]] },
          });
          return;
        }

        if (data.startsWith("owner_reject:")) {
          const reqId = Number(data.replace("owner_reject:", ""));
          const [req] = await db
            .select()
            .from(paymentRequestsTable)
            .where(and(eq(paymentRequestsTable.id, reqId), eq(paymentRequestsTable.botId, bot.id)));
          if (!req || req.status !== "pending") {
            await editMessage(bot.token, chatId, messageId, `⚠️ Request #${reqId} is not pending or not found.`, {
              reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "owner_pending" }]] },
            });
            return;
          }
          await upsertSession(bot.id, chatId, "awaiting_reject_reason", { pendingRejectId: reqId });
          await sendMessage(
            bot.token,
            chatId,
            `✏️ <b>Rejection Reason</b>\n\nRequest <b>#${reqId}</b> — ${req.telegramUsername ? `@${req.telegramUsername}` : req.telegramFirstName ?? req.chatId}\n\nPlease type the rejection reason to send to the user:\n\n<i>Or type /cancel to go back</i>`,
          );
          return;
        }

        if (data === "owner_userbots") {
          const activeUserbots = await db
            .select()
            .from(userbotsTable)
            .where(and(eq(userbotsTable.botId, bot.id), eq(userbotsTable.isActive, true)));

          const bodyText =
            activeUserbots.length === 0
              ? "🤖 <b>UserBots</b>\n\nNo active userbots at the moment."
              : `🤖 <b>Active UserBots (${activeUserbots.length})</b>\n\n` +
                activeUserbots
                  .map((ub) => {
                    const name = ub.telegramFirstName ?? ub.phone;
                    const user = ub.telegramUsername ? `@${ub.telegramUsername}` : `Chat ${ub.chatId}`;
                    return `• <b>${name}</b> (${user})\n  📱 ${ub.phone} · Added ${new Date(ub.createdAt).toLocaleDateString()}`;
                  })
                  .join("\n\n");

          await editMessage(bot.token, chatId, messageId, bodyText, {
            reply_markup: {
              inline_keyboard: [
                ...activeUserbots.map((ub) => [
                  {
                    text: `🗑 Revoke ${ub.telegramFirstName ?? ub.phone}`,
                    callback_data: `owner_revoke_ub:${ub.chatId}`,
                  },
                ]),
                [{ text: "← Back", callback_data: "owner_menu" }],
              ],
            },
          });
          return;
        }

        if (data.startsWith("owner_revoke_ub:")) {
          const targetChatId = data.replace("owner_revoke_ub:", "");
          const [revoked] = await db
            .delete(userbotsTable)
            .where(and(eq(userbotsTable.botId, bot.id), eq(userbotsTable.chatId, targetChatId)))
            .returning();

          if (revoked) {
            const name = revoked.telegramFirstName ?? revoked.phone;
            await sendMessage(
              bot.token,
              targetChatId,
              `⚠️ Your UserBot session has been revoked by the bot owner. You can set up a new one from the subscriber menu.`,
            );
            await editMessage(
              bot.token, chatId, messageId,
              `✅ UserBot session for <b>${name}</b> has been revoked.`,
              { reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "owner_userbots" }]] } },
            );
          } else {
            await editMessage(
              bot.token, chatId, messageId,
              `❌ UserBot not found (may have already been removed).`,
              { reply_markup: { inline_keyboard: [[{ text: "← Back", callback_data: "owner_userbots" }]] } },
            );
          }
          return;
        }

        if (data === "owner_customize") {
          await editOwnerCustomize(bot, chatId, messageId);
          return;
        }
        if (data === "owner_msgs") {
          await editOwnerMessages(bot, chatId, messageId);
          return;
        }
        if (data === "owner_emojis") {
          await editOwnerEmojis(bot, chatId, messageId, settings);
          return;
        }

        if (data === "owner_viewsettings") {
          const methods = settings.paymentMethods ?? [];
          const methodsStr = methods.length > 0
            ? methods.map((m) => `• ${m.type}: ${m.accountNumber} (${m.holderName})`).join("\n")
            : "<i>none configured</i>";

          const lines = [
            `📋 <b>Current Settings — ${bot.name}</b>\n`,
            `<b>Emojis:</b>`,
            `Welcome ${settings.welcomeEmoji} | Success ${settings.successEmoji} | Error ${settings.errorEmoji}`,
            `Plans ${settings.planEmoji} | Token ${settings.tokenEmoji} | Payment ${settings.paymentEmoji} | Pending ${settings.pendingEmoji}`,
            `\n<b>Payment Methods:</b>`,
            methodsStr,
            `\n<b>Custom Messages (null = default):</b>`,
            `Welcome: ${settings.welcomeText ? `"${settings.welcomeText.slice(0, 50)}..."` : "<i>default</i>"}`,
            `Contact: ${settings.contactRequestText ? `"${settings.contactRequestText.slice(0, 50)}..."` : "<i>default</i>"}`,
            `Token activated: ${settings.tokenActivatedText ? `"${settings.tokenActivatedText.slice(0, 50)}..."` : "<i>default</i>"}`,
            `Payment confirmed: ${settings.paymentConfirmedText ? `"${settings.paymentConfirmedText.slice(0, 50)}..."` : "<i>default</i>"}`,
          ];

          await editMessage(bot.token, chatId, messageId, lines.join("\n"), {
            reply_markup: {
              inline_keyboard: [[{ text: "← Back", callback_data: "owner_menu" }]],
            },
          });
          return;
        }

        if (data === "owner_help") {
          await editMessage(
            bot.token, chatId, messageId,
            `❓ <b>Admin Help</b>\n\n<b>Commands:</b>\n/owner — Open this panel\n/pending — See pending payments\n/approve &lt;id&gt; — Approve a request\n/reject &lt;id&gt; [reason] — Reject a request\n\n<b>Customization:</b>\nUse "Customize Bot" to edit message templates and emojis.`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: "← Back", callback_data: "owner_menu" }]],
              },
            },
          );
          return;
        }

        if (data.startsWith("owner_set:")) {
          const key = data.replace("owner_set:", "") as EditableSettingKey;
          const label = SETTING_LABELS[key] ?? key;
          const hint = SETTING_HINTS[key] ?? "";
          await editMessage(
            bot.token, chatId, messageId,
            `✏️ <b>Edit: ${label}</b>\n\n${hint}\n\nSend the new value now:`,
            { reply_markup: { inline_keyboard: [[{ text: "← Cancel", callback_data: "owner_customize" }]] } },
          );
          await upsertSession(bot.id, chatId, "editing_setting", { settingKey: key });
          return;
        }
      }

      return;
    }

    // ── Contact shared ─────────────────────────────────────────────────────────
    if (update.message?.contact) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const contact = msg.contact!;
      const firstName = msg.from?.first_name ?? contact.first_name ?? "there";
      const phone = contact.phone_number.replace(/\D/g, "");

      const session = await getSession(bot.id, chatId);
      const state = (session?.state ?? "idle") as SessionState;

      if (state === "creating_userbot") {
        await upsertSession(bot.id, chatId, "creating_userbot", { phone });
        await startUserbotCreation(bot, chatId, phone, settings);
        return;
      }

      await upsertSession(bot.id, chatId, "idle", { phone });
      const active = await getActiveToken(bot.id, chatId);
      if (active) {
        await sendSubscriberMenu(bot, chatId, firstName, settings);
      } else {
        await sendWelcomeChoices(bot, chatId, firstName, settings);
      }
      return;
    }



    // ── Text messages ──────────────────────────────────────────────────────────
    if (update.message?.text) {
      const msg = update.message;
      const chatId = String(msg.chat.id);
      const text = msg.text!;
      const firstName = msg.from?.first_name ?? "there";
      const isSuperuser =
        bot.superuserChatId != null && chatId === bot.superuserChatId;

      // /start command
      if (text === "/start" || text.startsWith("/start ")) {
        const active = await getActiveToken(bot.id, chatId);
        if (active) {
          await sendSubscriberMenu(bot, chatId, firstName, settings);
        } else {
          await sendWelcomeChoices(bot, chatId, firstName, settings);
        }
        return;
      }

      // /owner command
      if (text === "/owner") {
        await handleOwnerCommand(bot, chatId);
        return;
      }

      // Superuser text commands
      if (isSuperuser && text.startsWith("/")) {
        await handleSuperuserCommand(bot, chatId, text, settings);
        return;
      }

      const session = await getSession(bot.id, chatId);
      const state = (session?.state ?? "idle") as SessionState;
      const sessionData = session ? parseSessionData(session) : {};

      // ── Editing a setting
      if (state === "editing_setting") {
        const key = sessionData["settingKey"] as EditableSettingKey | undefined;
        if (key && key in SETTING_LABELS) {
          await saveSetting(bot.id, key, text.trim());
          await upsertSession(bot.id, chatId, "idle");
          await sendMessage(
            bot.token,
            chatId,
            `${settings.successEmoji} <b>${SETTING_LABELS[key]}</b> updated!\n\nNew value: ${text.trim()}`,
          );
          await sendOwnerPanel(bot, chatId);
        }
        return;
      }

      // ── Awaiting reject reason (superuser entering rejection reason)
      if (state === "awaiting_reject_reason") {
        if (text === "/cancel") {
          await upsertSession(bot.id, chatId, "idle");
          await sendOwnerPanel(bot, chatId);
          return;
        }
        const pendingRejectId = sessionData["pendingRejectId"] as number | undefined;
        if (!pendingRejectId) {
          await upsertSession(bot.id, chatId, "idle");
          return;
        }
        const reason = text.trim();
        const [req] = await db
          .select()
          .from(paymentRequestsTable)
          .where(and(eq(paymentRequestsTable.id, pendingRejectId), eq(paymentRequestsTable.botId, bot.id)));
        if (!req || req.status !== "pending") {
          await upsertSession(bot.id, chatId, "idle");
          await sendMessage(bot.token, chatId, `⚠️ Request #${pendingRejectId} is no longer pending.`);
          return;
        }
        await db
          .update(paymentRequestsTable)
          .set({ status: "rejected", rejectionReason: reason, updatedAt: new Date() })
          .where(eq(paymentRequestsTable.id, pendingRejectId));
        await sendMessage(
          bot.token,
          req.chatId,
          `${settings.errorEmoji} <b>Payment Not Confirmed</b>\n\nYour request #${pendingRejectId} was not approved.\n\n<b>Reason:</b> ${reason}\n\nPlease try again or contact support.`,
          { reply_markup: { inline_keyboard: [[{ text: `${settings.planEmoji} View plans`, callback_data: "choose_plan" }]] } },
        );
        await upsertSession(bot.id, chatId, "idle");
        await sendMessage(bot.token, chatId, `❌ Request #${pendingRejectId} rejected.\n\n<b>Reason sent:</b> ${reason}`);
        await sendOwnerPanel(bot, chatId);
        return;
      }

      // ── UserBot OTP
      if (state === "awaiting_userbot_otp") {
        const phone = (sessionData["phone"] as string | undefined) ?? "";
        const phoneCodeHash = (sessionData["phoneCodeHash"] as string | undefined) ?? "";
        const tempSession = (sessionData["tempSession"] as string | undefined);
        const code = text.replace(/\s+/g, "").trim();

        try {
          const { sessionString, twoFactorRequired } = await signInWithCode(
            phone,
            phoneCodeHash,
            code,
            tempSession,
          );

          if (twoFactorRequired) {
            await upsertSession(bot.id, chatId, "awaiting_userbot_2fa", {
              phone,
              sessionString,
            });
            await sendMessage(
              bot.token,
              chatId,
              `🔒 <b>Two-Step Verification</b>\n\nYour account has two-step verification enabled.\n\nPlease enter your <b>Telegram password</b>:`,
            );
            return;
          }

          const me = await getMe(sessionString);
          await saveUserbotSession(bot.id, chatId, phone, sessionString, me);
          await upsertSession(bot.id, chatId, "idle");

          await sendMessage(
            bot.token,
            chatId,
            `${settings.tokenEmoji} <b>Login Successful!</b>\n\nWelcome, ${me.firstName ?? me.username ?? phone}! Your UserBot is now active.`,
          );

          const userbot = await getActiveUserbot(bot.id, chatId);
          if (userbot) await sendUserbotMenu(bot, chatId, userbot, settings);
        } catch (err: unknown) {
          logger.warn({ err, chatId }, "UserBot OTP verification failed");
          const errMsg =
            (err as { errorMessage?: string }).errorMessage ?? "";
          if (
            errMsg === "PHONE_CODE_INVALID" ||
            errMsg === "PHONE_CODE_EXPIRED"
          ) {
            await sendMessage(
              bot.token,
              chatId,
              `${settings.errorEmoji} <b>Invalid or expired code.</b>\n\nRequest a new one by tapping "🔄 Reconnect" from the menu.`,
            );
          } else {
            await sendMessage(
              bot.token,
              chatId,
              `${settings.errorEmoji} Login failed. Please try again from /start.`,
            );
          }
          await upsertSession(bot.id, chatId, "idle");
        }
        return;
      }

      // ── UserBot 2FA password
      if (state === "awaiting_userbot_2fa") {
        const phone = (sessionData["phone"] as string | undefined) ?? "";
        const partialSession = sessionData["sessionString"] as
          | string
          | undefined;

        if (!partialSession) {
          await upsertSession(bot.id, chatId, "idle");
          await sendMessage(
            bot.token,
            chatId,
            "❌ Session expired. Please start over with /start.",
          );
          return;
        }

        await sendMessage(
          bot.token,
          chatId,
          `${settings.pendingEmoji} Verifying password...`,
        );

        try {
          const { sessionString } = await signInWithPassword(
            partialSession,
            text.trim(),
          );
          const me = await getMe(sessionString);
          await saveUserbotSession(bot.id, chatId, phone, sessionString, me);
          await upsertSession(bot.id, chatId, "idle");

          await sendMessage(
            bot.token,
            chatId,
            `${settings.tokenEmoji} <b>Login Successful!</b>\n\nWelcome, ${me.firstName ?? me.username ?? phone}! Your UserBot is now active.`,
          );

          const userbot = await getActiveUserbot(bot.id, chatId);
          if (userbot) await sendUserbotMenu(bot, chatId, userbot, settings);
        } catch (err: unknown) {
          logger.warn({ err, chatId }, "UserBot 2FA failed");
          const errMsg =
            (err as { errorMessage?: string }).errorMessage ?? "";
          if (errMsg === "PASSWORD_HASH_INVALID") {
            await sendMessage(
              bot.token,
              chatId,
              `${settings.errorEmoji} <b>Wrong password.</b> Please try again:`,
            );
          } else {
            await sendMessage(
              bot.token,
              chatId,
              `${settings.errorEmoji} Verification failed. Please try again from /start.`,
            );
            await upsertSession(bot.id, chatId, "idle");
          }
        }
        return;
      }

      // ── UserBot composing broadcast
      if (state === "userbot_composing") {
        const userbot = await getActiveUserbot(bot.id, chatId);
        if (!userbot?.sessionString) {
          await upsertSession(bot.id, chatId, "idle");
          await sendMessage(
            bot.token,
            chatId,
            "❌ No active UserBot session. Please reconnect.",
          );
          return;
        }

        await upsertSession(bot.id, chatId, "idle");
        await sendMessage(
          bot.token,
          chatId,
          `${settings.pendingEmoji} <b>Broadcasting...</b>\n\nSending to all your groups and channels. This may take a moment.`,
        );

        try {
          const { sent, failed } = await broadcastToAll(
            userbot.sessionString,
            text,
          );
          await sendMessage(
            bot.token,
            chatId,
            `${settings.successEmoji} <b>Broadcast Complete!</b>\n\n✅ Sent: <b>${sent}</b>\n❌ Failed: <b>${failed}</b>`,
          );
        } catch (err) {
          logger.warn({ err, chatId }, "Broadcast failed");
          await sendMessage(
            bot.token,
            chatId,
            `${settings.errorEmoji} Broadcast failed. Try reconnecting your UserBot.`,
          );
        }

        await sendUserbotMenu(bot, chatId, userbot, settings);
        return;
      }

      // ── Awaiting subscription token
      if (state === "awaiting_token") {
        await handleTokenInput(bot, chatId, text, firstName, settings);
        return;
      }

      // ── Nudge contact share
      if (state === "awaiting_contact" || state === "creating_userbot") {
        await sendMessage(
          bot.token,
          chatId,
          "👆 Please tap the <b>Share My Contact Info</b> button below to continue.",
          {
            reply_markup: {
              keyboard: [
                [
                  {
                    text: "📱 Share My Contact Info",
                    request_contact: true,
                  } as TelegramBot.KeyboardButton,
                ],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            } as TelegramBot.ReplyKeyboardMarkup,
          },
        );
        return;
      }

      // ── Awaiting payment
      if (state === "awaiting_payment") {
        await sendMessage(
          bot.token,
          chatId,
          `${settings.pendingEmoji} Your payment is being reviewed. The admin will confirm shortly.`,
        );
        return;
      }

      // Default — check subscription and route
      const active = await getActiveToken(bot.id, chatId);
      if (active) {
        await sendSubscriberMenu(bot, chatId, firstName, settings);
      } else {
        await sendContactRequest(bot, chatId, settings);
      }
    }
  } catch (err) {
    logger.error({ err, botId }, "Error handling webhook update");
  }
}
