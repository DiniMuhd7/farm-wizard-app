import AsyncStorage from "@react-native-async-storage/async-storage";
import { tr } from "@/utils/tr";
import { API_BASE, refreshGuestSession } from "@/config/client";

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
let lastAwakeAt = 0;

// The API runs on a free Render instance that goes to sleep when idle. While
// it boots, Render answers with an HTML 502/503 page — which the old code
// could not parse, so every feature showed its generic fallback text
// ("Unable to send message." / "Unable to start a video call."). Ping /health
// first (cheap when awake) so the real request only goes out once the server
// is actually up.
export async function wakeBackend(maxWaitMs = 60000): Promise<void> {
  if (Date.now() - lastAwakeAt < 2 * 60 * 1000) return;
  const startedAt = Date.now();
  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const response = await fetch(`${API_BASE}/health`);
      if (response.ok) {
        lastAwakeAt = Date.now();
        return;
      }
    } catch {
      // network error — retry below
    }
    await sleep(2500);
  }
}

function explain(status: number, parsed: any): string {
  if (parsed && typeof parsed.message === "string" && parsed.message) return parsed.message;
  if (status === 401) return tr("Your session has expired. Please sign in again.");
  if (status === 404) return tr("This feature isn't available on the server yet (404). The backend needs to be redeployed with the latest code.");
  if (status === 429) return tr("Too many requests. Please wait a moment and try again.");
  if (status >= 500) return tr("The server is temporarily unavailable ({{status}}). Please try again in a moment.", { status });
  return tr("Request failed ({{status}}).", { status });
}

type Options = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown; signInMessage?: string };

export async function authedJson<T = any>(path: string, options: Options = {}): Promise<T> {
  let token = await AsyncStorage.getItem("token");
  if (!token) throw new ApiError(options.signInMessage || tr("Sign in to continue."), 401);

  await wakeBackend();

  const send = (jwt: string) =>
    fetch(`${API_BASE}${path}`, {
      method: options.method || "GET",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

  let response: Response;
  try {
    response = await send(token);
    if (response.status === 401) {
      const fresh = await refreshGuestSession();
      if (fresh) response = await send(fresh);
    }
  } catch {
    throw new ApiError(tr("Can't reach the server. Check your internet connection and try again."));
  }

  const parsed = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(explain(response.status, parsed), response.status);
  return parsed as T;
}
