import { tr } from "@/utils/tr";
import { authedJson } from "@/services/http";

export type VideoSession = { token: string; room: string };

export async function startVideoCall(to: string): Promise<VideoSession> {
  const data = await authedJson<Partial<VideoSession>>("/api/v1/voice/video/token", {
    method: "POST",
    body: { to },
    signInMessage: tr("Sign in to place a video call."),
  });
  if (typeof data.token !== "string" || typeof data.room !== "string") {
    throw new Error(tr("The server returned an invalid video session. Please try again."));
  }
  return { token: data.token, room: data.room };
}
