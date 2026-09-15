// Deterministic "crop of the day" so the client and server agree without
// any shared state. Keep CROPS in sync with the app's plant list.
const CROPS = ["apple", "maize", "mango", "orange", "pawpaw"];

const todayStr = () => new Date().toISOString().slice(0, 10);

const cropForDate = (date) => {
  let seed = 0;
  for (let i = 0; i < date.length; i++) {
    seed = (seed * 31 + date.charCodeAt(i)) >>> 0;
  }
  return CROPS[seed % CROPS.length];
};

module.exports = { CROPS, todayStr, cropForDate };
