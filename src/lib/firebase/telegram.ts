import "server-only";

import { createHash } from "node:crypto";

import { getFirebaseAdminFirestore } from "./admin";

export type TelegramLinkStatus =
  | "linked"
  | "already_linked"
  | "expired"
  | "chat_already_linked"
  | "invalid";

function chatLockId(chatId: string): string {
  return createHash("sha256").update(`telegram:${chatId}`).digest("hex");
}

export async function claimTelegramLink(
  tokenHash: string,
  chatId: string,
  username: string | null,
): Promise<TelegramLinkStatus> {
  const firestore = getFirebaseAdminFirestore();
  const tokens = firestore.collection("telegram_link_tokens");
  const channels = firestore.collection("user_channels");

  return firestore.runTransaction(async (transaction) => {
    const tokenQuery = tokens.where("token_hash", "==", tokenHash).limit(2);
    const tokenSnapshot = await transaction.get(tokenQuery);
    if (tokenSnapshot.size !== 1) return "invalid";

    const tokenDocument = tokenSnapshot.docs[0];
    const token = tokenDocument.data();
    const userId =
      typeof token.user_id === "string" ? token.user_id : "";
    if (!userId) return "invalid";

    const userChannelQuery = channels
      .where("user_id", "==", userId)
      .limit(10);
    const chatChannelQuery = channels
      .where("external_chat_id", "==", chatId)
      .limit(10);
    const [userChannelSnapshot, chatChannelSnapshot] = await Promise.all([
      transaction.get(userChannelQuery),
      transaction.get(chatChannelQuery),
    ]);
    const userTelegramChannels = userChannelSnapshot.docs.filter(
      (document) => document.get("channel") === "telegram",
    );
    if (userTelegramChannels.length > 1) {
      throw new Error("User has multiple Telegram channel records.");
    }

    const existingChannel = userTelegramChannels[0];
    const previousChatId = existingChannel?.get("external_chat_id");
    const lockReference = firestore
      .collection("telegram_chat_links")
      .doc(chatLockId(chatId));
    const previousLockReference =
      typeof previousChatId === "string" && previousChatId !== chatId
        ? firestore
            .collection("telegram_chat_links")
            .doc(chatLockId(previousChatId))
        : null;
    const [chatLock, previousChatLock] = await Promise.all([
      transaction.get(lockReference),
      previousLockReference
        ? transaction.get(previousLockReference)
        : Promise.resolve(null),
    ]);

    if (token.used_at != null) {
      const alreadyLinked = userTelegramChannels.some((document) => {
        const channel = document.data();
        return (
          channel.external_chat_id === chatId &&
          channel.is_active === true
        );
      });
      return alreadyLinked ? "already_linked" : "invalid";
    }

    const expiresAt =
      typeof token.expires_at === "string"
        ? Date.parse(token.expires_at)
        : token.expires_at instanceof Date
          ? token.expires_at.getTime()
          : Number.NaN;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return "expired";
    }

    const linkedToAnotherUser = chatChannelSnapshot.docs.some(
      (document) =>
        document.get("channel") === "telegram" &&
        document.get("user_id") !== userId,
    );
    if (
      linkedToAnotherUser ||
      (chatLock.exists && chatLock.get("user_id") !== userId)
    ) {
      return "chat_already_linked";
    }

    const now = new Date().toISOString();
    const channelId =
      existingChannel?.id ??
      createHash("sha256")
        .update(`user_channels:${userId}:telegram`)
        .digest("hex");
    const channelReference = channels.doc(channelId);

    transaction.set(
      channelReference,
      {
        user_id: userId,
        channel: "telegram",
        external_chat_id: chatId,
        username: username?.trim() || null,
        verified_at: now,
        is_active: true,
        updated_at: now,
        ...(existingChannel ? {} : { created_at: now }),
      },
      { merge: true },
    );
    transaction.set(lockReference, {
      user_id: userId,
      channel_id: channelId,
      updated_at: now,
    });
    if (
      previousLockReference &&
      previousChatLock?.exists &&
      previousChatLock.get("user_id") === userId
    ) {
      transaction.delete(previousLockReference);
    }
    transaction.update(tokenDocument.ref, { used_at: now });
    return "linked";
  });
}

export async function disconnectTelegramUser(userId: string): Promise<void> {
  const firestore = getFirebaseAdminFirestore();
  const channels = firestore.collection("user_channels");
  const tokens = firestore.collection("telegram_link_tokens");

  await firestore.runTransaction(async (transaction) => {
    const [channelSnapshot, tokenSnapshot] = await Promise.all([
      transaction.get(channels.where("user_id", "==", userId)),
      transaction.get(tokens.where("user_id", "==", userId)),
    ]);
    const userChannels = channelSnapshot.docs.filter(
      (document) => document.get("channel") === "telegram",
    );
    if (userChannels.length > 1) {
      throw new Error("User has multiple Telegram channel records.");
    }

    const channel = userChannels[0];
    const chatId = channel?.get("external_chat_id");
    const lockReference =
      typeof chatId === "string"
        ? firestore
            .collection("telegram_chat_links")
            .doc(chatLockId(chatId))
        : null;
    const lock = lockReference
      ? await transaction.get(lockReference)
      : null;

    const now = new Date().toISOString();
    if (channel) {
      transaction.update(channel.ref, {
        external_chat_id: null,
        username: null,
        verified_at: null,
        is_active: false,
        updated_at: now,
      });
    }
    if (lockReference && lock?.exists && lock.get("user_id") === userId) {
      transaction.delete(lockReference);
    }
    for (const token of tokenSnapshot.docs) {
      if (token.get("used_at") == null) {
        transaction.delete(token.ref);
      }
    }
  });
}
