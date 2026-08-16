import AsyncStorage from "@react-native-async-storage/async-storage";

export type OfflineInventory = {
  fertilizerQty: number;
  pesticideQty: number;
  waterQty: number;
};

type PendingInventoryOp = {
  item: string;
  qty: number;
  direction: "add" | "reduce";
  createdAt: string;
};

type PendingHarvest = {
  plantName: string;
  level: number;
  score: number;
  createdAt: string;
};

const OFFLINE_INVENTORY_KEY = "offlineGameplayInventory";
const OFFLINE_LEVELS_KEY = "offlinePlantLevels";
const PENDING_INVENTORY_KEY = "pendingOfflineInventoryOps";
const PENDING_HARVEST_KEY = "pendingOfflineHarvests";

const STARTER_INVENTORY: OfflineInventory = {
  fertilizerQty: 3,
  pesticideQty: 3,
  waterQty: 5,
};

const itemToKey = (item: string): keyof OfflineInventory => {
  const normalized = item.toLowerCase();
  if (normalized.includes("pesticide")) return "pesticideQty";
  if (normalized.includes("fertilizer")) return "fertilizerQty";
  return "waterQty";
};

export const getOfflineInventory = async (): Promise<OfflineInventory> => {
  const raw = await AsyncStorage.getItem(OFFLINE_INVENTORY_KEY);
  if (!raw) {
    await AsyncStorage.setItem(OFFLINE_INVENTORY_KEY, JSON.stringify(STARTER_INVENTORY));
    return STARTER_INVENTORY;
  }
  return { ...STARTER_INVENTORY, ...JSON.parse(raw) };
};

export const setOfflineInventory = async (inventory: OfflineInventory) => {
  await AsyncStorage.setItem(OFFLINE_INVENTORY_KEY, JSON.stringify(inventory));
};

export const applyOfflineInventoryChange = async (
  item: string,
  qty: number,
  direction: "add" | "reduce"
) => {
  const inventory = await getOfflineInventory();
  const key = itemToKey(item);
  const delta = direction === "add" ? qty : -qty;
  const next = {
    ...inventory,
    [key]: Math.max(0, (inventory[key] || 0) + delta),
  };
  await setOfflineInventory(next);
  return next;
};

export const queueOfflineInventoryChange = async (
  item: string,
  qty: number,
  direction: "add" | "reduce"
) => {
  const raw = await AsyncStorage.getItem(PENDING_INVENTORY_KEY);
  const ops: PendingInventoryOp[] = raw ? JSON.parse(raw) : [];
  ops.push({ item, qty, direction, createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(PENDING_INVENTORY_KEY, JSON.stringify(ops));
};

export const getOfflinePlantLevel = async (plantName: string) => {
  const raw = await AsyncStorage.getItem(OFFLINE_LEVELS_KEY);
  const levels = raw ? JSON.parse(raw) : {};
  return Number(levels[plantName] || 1);
};

export const setOfflinePlantLevel = async (plantName: string, level: number) => {
  const raw = await AsyncStorage.getItem(OFFLINE_LEVELS_KEY);
  const levels = raw ? JSON.parse(raw) : {};
  levels[plantName] = Math.max(Number(levels[plantName] || 1), level);
  await AsyncStorage.setItem(OFFLINE_LEVELS_KEY, JSON.stringify(levels));
};

export const queueOfflineHarvest = async (
  plantName: string,
  level: number,
  score: number
) => {
  const raw = await AsyncStorage.getItem(PENDING_HARVEST_KEY);
  const harvests: PendingHarvest[] = raw ? JSON.parse(raw) : [];
  harvests.push({ plantName, level, score, createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(PENDING_HARVEST_KEY, JSON.stringify(harvests));
};
