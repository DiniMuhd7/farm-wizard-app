import AsyncStorage from "@react-native-async-storage/async-storage";

export type FarmCycleRecord = {
  id: string;
  plantName: string;
  displayName: string;
  emoji: string;
  cycleDays: number;
  stageName: string;
  stageIndex: number;
  score: number;
  plantHealth: number;
  companionPlants?: string[];
  simulationDays?: number;
  nutritionStrength?: string;
  nutritionImpact?: string;
  offlineGarden?: {
    plantName: string;
    health: number;
    growthStage: number;
    daysGrowing: number;
  };
  offlineComparison?: {
    healthGap: number;
    stageGap: number;
    dayGap: number;
  };
  completedAt: string;
};

const STORAGE_KEY = "farmCycleDashboardRecords";
const MAX_RECORDS = 80;

export const saveFarmCycleRecord = async (
  record: Omit<FarmCycleRecord, "id" | "completedAt">
) => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  const records: FarmCycleRecord[] = raw ? JSON.parse(raw) : [];
  const next: FarmCycleRecord = {
    ...record,
    id: `${record.plantName}-${Date.now()}`,
    completedAt: new Date().toISOString(),
  };

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([next, ...records].slice(0, MAX_RECORDS))
  );
  return next;
};

export const getFarmCycleRecords = async (): Promise<FarmCycleRecord[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const summarizeFarmCycleRecords = (records: FarmCycleRecord[]) => {
  const harvests = records.length;
  const averageHealth = harvests
    ? Math.round(records.reduce((sum, item) => sum + item.plantHealth, 0) / harvests)
    : 0;
  const totalPoints = records.reduce((sum, item) => sum + item.score, 0);
  const longestCycleDays = records.reduce(
    (max, item) => Math.max(max, item.cycleDays),
    0
  );
  const groceryDaysPlanned = records.reduce(
    (sum, item) => sum + item.cycleDays,
    0
  );
  const simultaneousPlantings = records.reduce(
    (sum, item) => sum + 1 + (item.companionPlants?.length || 0),
    0
  );
  const offlineComparisons = records.filter((item) => item.offlineComparison);
  const averageOfflineHealthGap = offlineComparisons.length
    ? Math.round(
        offlineComparisons.reduce(
          (sum, item) => sum + (item.offlineComparison?.healthGap || 0),
          0
        ) / offlineComparisons.length
      )
    : 0;

  return {
    harvests,
    averageHealth,
    totalPoints,
    longestCycleDays,
    groceryDaysPlanned,
    simultaneousPlantings,
    averageOfflineHealthGap,
  };
};
