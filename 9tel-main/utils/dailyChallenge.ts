// Mirrors backend/src/utils/dailyChallenge.js so the client can show the
// "crop of the day" without a round-trip. Keep CROPS in sync with the
// backend list and the app's plant names.
export const DAILY_CROPS = ["apple", "maize", "mango", "orange", "pawpaw"];

export const dailyCrop = (date = new Date().toISOString().slice(0, 10)) => {
  let seed = 0;
  for (let i = 0; i < date.length; i++) {
    seed = (seed * 31 + date.charCodeAt(i)) >>> 0;
  }
  return DAILY_CROPS[seed % DAILY_CROPS.length];
};
