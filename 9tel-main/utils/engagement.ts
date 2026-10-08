import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "@/config/client";

// Local engagement layer: daily quests + lifetime achievements.
// Game screens call recordEvent(...) as things happen; the Quests &
// Achievements screen reads the state and lets the player claim rewards.

export type GameEvent =
  | "session_played"
  | "harvest"
  | "perfect_harvest" // harvest with health >= 90
  | "water_used"
  | "fertilizer_used"
  | "pesticide_used"
  | "threat_survived"
  | "level_up";

// ---------------------------------------------------------------------------
// Daily quests
// ---------------------------------------------------------------------------
export type QuestDef = {
  id: string;
  title: string;
  event: GameEvent;
  target: number;
  reward: number; // WizPoints
};

const QUEST_POOL: QuestDef[] = [
  { id: "play3", title: "Play 3 game sessions", event: "session_played", target: 3, reward: 100 },
  { id: "harvest2", title: "Harvest 2 crops", event: "harvest", target: 2, reward: 150 },
  { id: "water10", title: "Water your plant 10 times", event: "water_used", target: 10, reward: 80 },
  { id: "fert8", title: "Use fertilizer 8 times", event: "fertilizer_used", target: 8, reward: 80 },
  { id: "pest5", title: "Spray pesticide 5 times", event: "pesticide_used", target: 5, reward: 100 },
  { id: "survive3", title: "Survive 3 threats", event: "threat_survived", target: 3, reward: 120 },
  { id: "perfect1", title: "Get a perfect harvest (90%+ health)", event: "perfect_harvest", target: 1, reward: 200 },
  { id: "level2", title: "Level up a plant twice", event: "level_up", target: 2, reward: 150 },
];

const DAILY_QUESTS_PER_DAY = 3;

export type QuestState = {
  id: string;
  title: string;
  event: GameEvent;
  target: number;
  reward: number;
  progress: number;
  claimed: boolean;
};

type DailyQuestsStore = {
  date: string; // YYYY-MM-DD
  quests: QuestState[];
};

const QUESTS_KEY = "daily-quests";

const todayStr = () => new Date().toISOString().slice(0, 10);

// Deterministic pick of N quests for a given date so it's stable all day.
const pickQuestsForDate = (date: string): QuestState[] => {
  let seed = 0;
  for (let i = 0; i < date.length; i++) seed = (seed * 31 + date.charCodeAt(i)) >>> 0;
  const pool = [...QUEST_POOL];
  const chosen: QuestDef[] = [];
  while (chosen.length < DAILY_QUESTS_PER_DAY && pool.length) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const idx = seed % pool.length;
    chosen.push(pool.splice(idx, 1)[0]);
  }
  return chosen.map((q) => ({ ...q, progress: 0, claimed: false }));
};

export const getDailyQuests = async (): Promise<QuestState[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUESTS_KEY);
    const store: DailyQuestsStore | null = raw ? JSON.parse(raw) : null;
    if (store && store.date === todayStr()) return store.quests;

    const fresh: DailyQuestsStore = {
      date: todayStr(),
      quests: pickQuestsForDate(todayStr()),
    };
    await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(fresh));
    return fresh.quests;
  } catch (e) {
    return pickQuestsForDate(todayStr());
  }
};

export const claimQuest = async (id: string): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem(QUESTS_KEY);
    if (!raw) return;
    const store: DailyQuestsStore = JSON.parse(raw);
    const q = store.quests.find((x) => x.id === id);
    if (q) q.claimed = true;
    await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(store));
  } catch (e) {
    // ignore
  }
};

// ---------------------------------------------------------------------------
// Achievements (lifetime)
// ---------------------------------------------------------------------------
export type AchievementDef = {
  id: string;
  title: string;
  desc: string;
  event: GameEvent;
  target: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "first_harvest", title: "First Sprout", desc: "Harvest your first crop", event: "harvest", target: 1 },
  { id: "harvest_10", title: "Green Thumb", desc: "Harvest 10 crops", event: "harvest", target: 10 },
  { id: "harvest_50", title: "Master Farmer", desc: "Harvest 50 crops", event: "harvest", target: 50 },
  { id: "sessions_25", title: "Dedicated", desc: "Play 25 sessions", event: "session_played", target: 25 },
  { id: "threats_25", title: "Farm Guardian", desc: "Survive 25 threats", event: "threat_survived", target: 25 },
  { id: "perfect_5", title: "Perfectionist", desc: "5 perfect harvests", event: "perfect_harvest", target: 5 },
  { id: "water_100", title: "Rainmaker", desc: "Water 100 times", event: "water_used", target: 100 },
  { id: "level_master", title: "Cultivator", desc: "Level up plants 10 times", event: "level_up", target: 10 },
];

const COUNTERS_KEY = "lifetime-event-counters";

type Counters = Partial<Record<GameEvent, number>>;

const getCounters = async (): Promise<Counters> => {
  try {
    const raw = await AsyncStorage.getItem(COUNTERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export type AchievementState = AchievementDef & {
  progress: number;
  unlocked: boolean;
};

export const getAchievements = async (): Promise<AchievementState[]> => {
  const counters = await getCounters();
  return ACHIEVEMENTS.map((a) => {
    const progress = counters[a.event] || 0;
    return { ...a, progress: Math.min(progress, a.target), unlocked: progress >= a.target };
  });
};

// ---------------------------------------------------------------------------
// Progression goals (long-term milestones with one-time WizPoint rewards)
// ---------------------------------------------------------------------------
export type GoalDef = {
  id: string;
  title: string;
  event: GameEvent;
  target: number;
  reward: number;
};

export const GOALS: GoalDef[] = [
  { id: "g_harvest_25", title: "Harvest 25 crops", event: "harvest", target: 25, reward: 1000 },
  { id: "g_harvest_100", title: "Harvest 100 crops", event: "harvest", target: 100, reward: 3000 },
  { id: "g_sessions_50", title: "Play 50 sessions", event: "session_played", target: 50, reward: 1500 },
  { id: "g_perfect_10", title: "10 perfect harvests", event: "perfect_harvest", target: 10, reward: 2000 },
  { id: "g_threats_50", title: "Survive 50 threats", event: "threat_survived", target: 50, reward: 1500 },
  { id: "g_levels_25", title: "Level up plants 25 times", event: "level_up", target: 25, reward: 2500 },
];

const CLAIMED_GOALS_KEY = "claimed-goals";

const getClaimedGoals = async (): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(CLAIMED_GOALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export type GoalState = GoalDef & {
  progress: number;
  completed: boolean;
  claimed: boolean;
};

export const getGoals = async (): Promise<GoalState[]> => {
  const counters = await getCounters();
  const claimed = await getClaimedGoals();
  return GOALS.map((g) => {
    const progress = counters[g.event] || 0;
    return {
      ...g,
      progress: Math.min(progress, g.target),
      completed: progress >= g.target,
      claimed: claimed.includes(g.id),
    };
  });
};

export const claimGoal = async (id: string): Promise<void> => {
  try {
    const claimed = await getClaimedGoals();
    if (!claimed.includes(id)) {
      claimed.push(id);
      await AsyncStorage.setItem(CLAIMED_GOALS_KEY, JSON.stringify(claimed));
    }
  } catch {
    // ignore
  }
};

// ---------------------------------------------------------------------------
// Event recording (called from gameplay)
// ---------------------------------------------------------------------------
export const recordEvent = async (event: GameEvent, count = 1): Promise<void> => {
  try {
    // lifetime counters (achievements)
    const counters = await getCounters();
    counters[event] = (counters[event] || 0) + count;
    await AsyncStorage.setItem(COUNTERS_KEY, JSON.stringify(counters));

    // daily quest progress
    const raw = await AsyncStorage.getItem(QUESTS_KEY);
    let store: DailyQuestsStore | null = raw ? JSON.parse(raw) : null;
    if (!store || store.date !== todayStr()) {
      store = { date: todayStr(), quests: pickQuestsForDate(todayStr()) };
    }
    let changed = false;
    store.quests.forEach((q) => {
      if (q.event === event && q.progress < q.target) {
        q.progress = Math.min(q.target, q.progress + count);
        changed = true;
      }
    });
    if (changed || raw === null) {
      await AsyncStorage.setItem(QUESTS_KEY, JSON.stringify(store));
    }
  } catch (e) {
    // engagement tracking must never break gameplay
  }
};

// ---------------------------------------------------------------------------
// Reward crediting (shared with the home screen rewarded ad)
// ---------------------------------------------------------------------------
const extractUser = (json: any) =>
  json?.userDetails || json?.data?.userDetails || json?.data?.user || json?.user;

// Credits WizPoints via the existing backend endpoint; returns the updated
// user object on success, or null on failure.
export const creditReward = async (amount: number): Promise<any | null> => {
  try {
    const token = await AsyncStorage.getItem("token");
    if (!token) return null;
    const res = await fetch(`${API_BASE}/api/v1/user/reward-earned`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `JWT ${token}`,
      },
      body: JSON.stringify({ amount }),
    });
    const json = await res.json();
    if (!res.ok || json.success === false) return null;
    return extractUser(json) || null;
  } catch (e) {
    return null;
  }
};
