import { tr } from "@/utils/tr";
import { authedJson } from "@/services/http";

export type Message = {
  _id: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  body: string;
  mediaUrls: string[];
  status: string;
  createdAt: string;
};

export type Conversation = {
  number: string;
  last: Message;
  unread: number;
};

export const E164 = /^\+[1-9]\d{6,14}$/;
export const cleanNumber = (value: string) => value.trim().replace(/[\s().-]/g, "");

export async function getConversations(): Promise<Conversation[]> {
  const data = await authedJson<{ conversations: Conversation[] }>("/api/v1/messages/conversations", {
    signInMessage: tr("Sign in to view your messages."),
  });
  return data.conversations ?? [];
}

// Opening a conversation also marks its inbound messages as read.
export async function getMessages(withNumber: string): Promise<Message[]> {
  const data = await authedJson<{ messages: Message[] }>(`/api/v1/messages?with=${encodeURIComponent(withNumber)}`, {
    signInMessage: tr("Sign in to view your messages."),
  });
  return data.messages ?? [];
}

export async function sendMessage(to: string, body: string, mediaUrls: string[] = []): Promise<Message> {
  const data = await authedJson<{ message: Message }>("/api/v1/messages", {
    method: "POST",
    body: { to, body, mediaUrls },
    signInMessage: tr("Sign in to send messages."),
  });
  if (!data.message) throw new Error(tr("The server did not confirm the message. Please try again."));
  return data.message;
}
