import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { Api } from "telegram";
import { logger } from "../lib/logger";

const API_ID = 2040;
const API_HASH = "b18441a1ff607e10a989891a5462e627";

function makeClient(session = "") {
  return new TelegramClient(new StringSession(session), API_ID, API_HASH, {
    connectionRetries: 5,
    retryDelay: 1000,
    baseLogger: { ...console, debug: () => {} } as never,
  });
}

export async function sendPhoneCode(phone: string): Promise<{ phoneCodeHash: string; tempSession: string }> {
  const client = makeClient();
  await client.connect();
  try {
    const result = await client.sendCode({ apiId: API_ID, apiHash: API_HASH }, phone);
    const tempSession = (client.session.save() as unknown) as string;
    return {
      phoneCodeHash: (result as { phoneCodeHash: string }).phoneCodeHash,
      tempSession,
    };
  } finally {
    await client.disconnect();
  }
}

export async function signInWithCode(
  phone: string,
  phoneCodeHash: string,
  code: string,
  tempSession?: string,
): Promise<{ sessionString: string; twoFactorRequired: boolean }> {
  const client = makeClient(tempSession ?? "");
  await client.connect();
  try {
    await client.invoke(
      new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash, phoneCode: code }),
    );
    const sessionString = (client.session.save() as unknown) as string;
    return { sessionString, twoFactorRequired: false };
  } catch (err: unknown) {
    const errMsg = (err as { errorMessage?: string }).errorMessage ?? String(err);
    if (errMsg === "SESSION_PASSWORD_NEEDED") {
      const sessionString = (client.session.save() as unknown) as string;
      return { sessionString, twoFactorRequired: true };
    }
    logger.warn({ err }, "signInWithCode error");
    throw err;
  } finally {
    await client.disconnect();
  }
}

export async function signInWithPassword(
  sessionString: string,
  password: string,
): Promise<{ sessionString: string }> {
  const client = makeClient(sessionString);
  await client.connect();
  try {
    const pwdInfo = await client.invoke(new Api.account.GetPassword());
    const { computeCheck } = await import("telegram/Password.js");
    const pwdCheck = await computeCheck(pwdInfo as never, password);
    await client.invoke(new Api.auth.CheckPassword({ password: pwdCheck as never }));
    const newSession = (client.session.save() as unknown) as string;
    return { sessionString: newSession };
  } finally {
    await client.disconnect();
  }
}

export async function getMe(sessionString: string): Promise<{
  id: string;
  username?: string;
  firstName?: string;
  phone?: string;
}> {
  const client = makeClient(sessionString);
  await client.connect();
  try {
    const me = (await client.getMe()) as Api.User;
    return {
      id: me.id.toString(),
      username: me.username,
      firstName: me.firstName,
      phone: me.phone,
    };
  } finally {
    await client.disconnect();
  }
}

export async function getGroupsAndChannels(sessionString: string): Promise<
  Array<{ id: string; name: string; type: "group" | "channel" }>
> {
  const client = makeClient(sessionString);
  await client.connect();
  try {
    const dialogs = await client.getDialogs({ limit: 100 });
    return dialogs
      .filter((d) => d.isGroup || d.isChannel)
      .map((d) => ({
        id: d.id?.toString() ?? "",
        name: d.title ?? d.name ?? "Unknown",
        type: (d.isChannel ? "channel" : "group") as "group" | "channel",
      }));
  } finally {
    await client.disconnect();
  }
}

export async function broadcastToAll(
  sessionString: string,
  message: string,
): Promise<{ sent: number; failed: number }> {
  const client = makeClient(sessionString);
  await client.connect();
  try {
    const dialogs = await client.getDialogs({ limit: 100 });
    const targets = dialogs.filter((d) => d.isGroup || d.isChannel);
    let sent = 0;
    let failed = 0;
    for (const dialog of targets) {
      try {
        await client.sendMessage(dialog.entity!, { message });
        sent++;
        await new Promise((r) => setTimeout(r, 600));
      } catch {
        failed++;
      }
    }
    return { sent, failed };
  } finally {
    await client.disconnect();
  }
}
