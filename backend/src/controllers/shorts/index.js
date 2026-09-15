const axios = require("axios");
const ShortsCache = require("../../models/ShortsCache");
const ShortsState = require("../../models/ShortsState");

// Prefer an env var; falls back to the key provided by the project owner.
// NOTE: move this to YOUTUBE_API_KEY in the environment and rotate the key.
const API_KEY =
  process.env.YOUTUBE_API_KEY || "AIzaSyDovRzp-fZq2X_WaU8cMqdi3s1Zsjpee4M";
const MIN_SUBSCRIBERS = 5000;
const SERVED_CAP = 1500; // remember this many recent video ids
const YT = "https://www.googleapis.com/youtube/v3";

// Rotated search terms so different windows surface different content.
const QUERIES = [
  "#shorts",
  "funny #shorts",
  "satisfying #shorts",
  "amazing #shorts",
  "trending #shorts",
  "cute animals #shorts",
  "food #shorts",
  "sports #shorts",
];

// Cache key changes every 3 hours -> the feed is refetched/reshuffled then.
const windowKey = () => {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const bucket = Math.floor(now.getUTCHours() / 3); // 0..7
  return `${date}-b${bucket}`;
};

const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const getServed = async () => {
  let s = await ShortsState.findOne({ key: "served" });
  if (!s) s = await ShortsState.create({ key: "served", ids: [] });
  return s;
};

// Fetch fresh shorts: public + embeddable, from channels > MIN_SUBSCRIBERS,
// excluding video ids already served.
const fetchFresh = async (servedIds) => {
  const q =
    QUERIES[Math.floor(Date.now() / (3 * 3600 * 1000)) % QUERIES.length];

  const search = await axios.get(`${YT}/search`, {
    params: {
      key: API_KEY,
      part: "snippet",
      type: "video",
      videoDuration: "short",
      q,
      maxResults: 50,
      order: "viewCount",
      safeSearch: "moderate",
    },
  });

  let cands = (search.data.items || [])
    .map((it) => ({
      videoId: it.id && it.id.videoId,
      title: it.snippet && it.snippet.title,
      channelId: it.snippet && it.snippet.channelId,
      channelTitle: it.snippet && it.snippet.channelTitle,
      thumbnail:
        it.snippet &&
        it.snippet.thumbnails &&
        (it.snippet.thumbnails.high || it.snippet.thumbnails.default || {}).url,
    }))
    .filter((v) => v.videoId && v.channelId);

  // Only keep public, embeddable, fully-processed videos (accessible).
  const statusMap = {};
  const vids = [...new Set(cands.map((v) => v.videoId))];
  for (let i = 0; i < vids.length; i += 50) {
    const chunk = vids.slice(i, i + 50);
    const vr = await axios.get(`${YT}/videos`, {
      params: { key: API_KEY, part: "status", id: chunk.join(",") },
    });
    (vr.data.items || []).forEach((v) => {
      statusMap[v.id] = v.status || {};
    });
  }
  cands = cands.filter((v) => {
    const st = statusMap[v.videoId];
    return (
      st &&
      st.privacyStatus === "public" &&
      st.embeddable === true &&
      st.uploadStatus === "processed"
    );
  });

  // Channel subscriber filter.
  const subs = {};
  const chans = [...new Set(cands.map((v) => v.channelId))];
  for (let i = 0; i < chans.length; i += 50) {
    const chunk = chans.slice(i, i + 50);
    const cr = await axios.get(`${YT}/channels`, {
      params: { key: API_KEY, part: "statistics", id: chunk.join(",") },
    });
    (cr.data.items || []).forEach((c) => {
      subs[c.id] = Number((c.statistics && c.statistics.subscriberCount) || 0);
    });
  }
  cands = cands
    .filter((v) => (subs[v.channelId] || 0) > MIN_SUBSCRIBERS)
    .map((v) => ({ ...v, subscribers: subs[v.channelId] }));

  // Exclude already-served videos; relax only if too few remain.
  const servedSet = new Set(servedIds || []);
  let fresh = cands.filter((v) => !servedSet.has(v.videoId));
  if (fresh.length < 5) fresh = cands;

  return shuffle(fresh);
};

// GET /api/v1/shorts
const getShorts = async (req, res) => {
  try {
    const key = windowKey();
    let cache = await ShortsCache.findOne({ date: key });

    if (!cache || !cache.videos || cache.videos.length === 0) {
      const served = await getServed();
      const fresh = await fetchFresh(served.ids || []);
      cache = await ShortsCache.findOneAndUpdate(
        { date: key },
        { date: key, videos: fresh },
        { upsert: true, new: true }
      );

      // Remember the served ids (FIFO-capped).
      const merged = [...(served.ids || []), ...fresh.map((v) => v.videoId)];
      const capped = merged.slice(Math.max(0, merged.length - SERVED_CAP));
      await ShortsState.updateOne({ key: "served" }, { ids: capped });
    }

    return res.json({ success: true, key, videos: cache.videos });
  } catch (err) {
    console.error("getShorts error:", err?.response?.data || err.message);
    const recent = await ShortsCache.findOne().sort({ createdAt: -1 });
    if (recent && recent.videos && recent.videos.length) {
      return res.json({
        success: true,
        key: recent.date,
        videos: recent.videos,
        stale: true,
      });
    }
    return res
      .status(500)
      .json({ success: false, message: "Could not load videos right now" });
  }
};

module.exports = { getShorts };
