import AsyncStorage from "@react-native-async-storage/async-storage";
import client from "@/config/client";

// Client wrappers for the engagement endpoints (daily challenge, cosmetics,
// referral). All require the JWT the rest of the app stores under "token".

const authHeaders = async () => {
  const token = await AsyncStorage.getItem("token");
  return {
    headers: {
      Authorization: `JWT ${token}`,
      "Content-Type": "application/json",
    },
  };
};

// ---- Daily challenge ----
export const getDailyChallenge = async () => {
  const res = await client.get("/leaderboard/daily");
  return res.data; // { success, date, crop, leaderboard }
};

export const submitDailyScore = async (score: number) => {
  const res = await client.post(
    "/leaderboard/daily/submit",
    { score },
    await authHeaders()
  );
  return res.data;
};

// ---- Cosmetics ----
export const getCosmetics = async () => {
  const res = await client.get("/cosmetics", await authHeaders());
  return res.data; // { success, catalog, owned, equipped, balance }
};

export const buyCosmetic = async (id: string) => {
  const res = await client.post("/cosmetics/buy", { id }, await authHeaders());
  return res.data; // { success, message, userDetails }
};

export const equipCosmetic = async (id: string) => {
  const res = await client.post(
    "/cosmetics/equip",
    { id },
    await authHeaders()
  );
  return res.data; // { success, message, userDetails }
};

// ---- Short videos (watch & earn) ----
const SHORTS_SEARCH_PARAMS = {
  // Keep Watch & Earn content focused on U.S. household-scale farming topics.
  q: [
    "United States backyard farming",
    "home garden plants",
    "household vegetable gardening",
    "small farm agriculture",
    "urban homestead gardening",
  ].join(" OR "),
  regionCode: "US",
  relevanceLanguage: "en",
  videoDuration: "short",
  safeSearch: "strict",
};

export const getShorts = async () => {
  const res = await client.get("/shorts", { params: SHORTS_SEARCH_PARAMS });
  return res.data; // { success, date, videos: [{ videoId, title, channelTitle, thumbnail, subscribers }] }
};

// ---- Idle / offline earning ----
export const getIdle = async () => {
  const res = await client.get("/user/idle", await authHeaders());
  return res.data; // { success, pending, ratePerHour, maxHours, full }
};

export const collectIdle = async () => {
  const res = await client.post("/user/idle/collect", {}, await authHeaders());
  return res.data; // { success, granted, message, userDetails }
};

// ---- Referral ----
export const getReferral = async () => {
  const res = await client.get("/referral", await authHeaders());
  return res.data; // { success, referralCode, referralCount, alreadyReferred, rewards }
};

export const redeemReferral = async (code: string) => {
  const res = await client.post(
    "/referral/redeem",
    { code },
    await authHeaders()
  );
  return res.data; // { success, message, userDetails }
};
