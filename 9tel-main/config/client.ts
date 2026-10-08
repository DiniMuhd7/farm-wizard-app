import axios, { type InternalAxiosRequestConfig } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE = "https://ninetel-backend-api.onrender.com";
// export const API_BASE = "http://192.168.1.73:5000";

// export default axios.create({ baseURL: "http://192.168.1.73:5000/api/v1" });
const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
});

let guestRefreshPromise: Promise<string | null> | null = null;

export async function refreshGuestSession(): Promise<string | null> {
  if (guestRefreshPromise) return guestRefreshPromise;

  guestRefreshPromise = (async () => {
    try {
      const cachedUser = await AsyncStorage.getItem("cachedUser");
      if (!cachedUser || !JSON.parse(cachedUser)?.isGuest) return null;

      const deviceId = await AsyncStorage.getItem("guest-device-id");
      if (!deviceId) return null;

      const response = await fetch(`${API_BASE}/api/v1/auth/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, deviceName: "9tel" }),
      });
      const result = await response.json().catch(() => null);
      const token = result?.data?.token;
      const user = result?.data?.user;
      if (!response.ok || !result?.success || !token || !user) return null;

      await Promise.all([
        AsyncStorage.setItem("token", token),
        AsyncStorage.setItem("cachedUser", JSON.stringify(user)),
      ]);
      return token as string;
    } catch {
      return null;
    }
  })();

  try {
    return await guestRefreshPromise;
  } finally {
    guestRefreshPromise = null;
  }
}

type RetriableRequest = InternalAxiosRequestConfig & {
  _guestSessionRetried?: boolean;
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as RetriableRequest | undefined;
    if (
      error.response?.status !== 401 ||
      !request ||
      request._guestSessionRetried ||
      !request.headers?.Authorization
    ) {
      throw error;
    }

    request._guestSessionRetried = true;
    const token = await refreshGuestSession();
    if (!token) throw error;
    request.headers.Authorization = `JWT ${token}`;
    return client(request);
  },
);

export default client;
