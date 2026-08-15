// Derived from recent public Reddit gardening/homesteading/permaculture discussion themes:
// water resilience, soil/water safety, companion planting, no-till/mulch, and slug/pest pressure.
export const householdGardenTrends = [
  {
    id: "water-resilience",
    emoji: "💧",
    title: "Water resilience",
    tip: "Track dry spells, mulch early, and plan rain-barrel backup for patio or raised-bed crops.",
  },
  {
    id: "soil-safety",
    emoji: "🧪",
    title: "Soil & water safety",
    tip: "Test older-yard soil and well/rain runoff before planting edible beds near roads or old structures.",
  },
  {
    id: "companion-planting",
    emoji: "🌿",
    title: "Companion planting",
    tip: "Pair tomatoes with basil, use flowers for pollinators, and log which combinations thrive in your yard.",
  },
  {
    id: "no-till-mulch",
    emoji: "🍂",
    title: "No-till mulch beds",
    tip: "Keep soil covered with compost or leaves to reduce weeds, protect microbes, and hold moisture.",
  },
  {
    id: "slug-pest-watch",
    emoji: "🐌",
    title: "Slug & pest watch",
    tip: "After rainy periods, inspect tender seedlings and use barriers or traps before damage spreads.",
  },
];

export const getTrendTipForSession = (context: {
  currentSeason: "normal" | "dry" | "raining";
  waterLevel: number;
  nutrientLevel: number;
  hasThreat: boolean;
}) => {
  if (context.hasThreat || context.currentSeason === "raining") {
    return householdGardenTrends.find((trend) => trend.id === "slug-pest-watch")!;
  }
  if (context.currentSeason === "dry" || context.waterLevel < 30) {
    return householdGardenTrends.find((trend) => trend.id === "water-resilience")!;
  }
  if (context.nutrientLevel < 35) {
    return householdGardenTrends.find((trend) => trend.id === "no-till-mulch")!;
  }
  return householdGardenTrends.find((trend) => trend.id === "companion-planting")!;
};

export const getPersonalizedGardenTrends = (context: {
  averageHealth: number;
  harvests: number;
  averageOfflineHealthGap?: number;
  simultaneousPlantings?: number;
}) => {
  const base = [...householdGardenTrends];
  const scored = base.map((trend) => {
    let score = 50;
    if (trend.id === "water-resilience" && context.averageHealth < 70) score += 35;
    if (trend.id === "no-till-mulch" && context.averageHealth < 80) score += 25;
    if (trend.id === "companion-planting" && (context.simultaneousPlantings || 0) >= Math.max(2, context.harvests)) score += 30;
    if (trend.id === "soil-safety" && (context.averageOfflineHealthGap || 0) < 0) score += 30;
    if (trend.id === "slug-pest-watch" && context.averageHealth < 60) score += 25;
    if (context.harvests === 0) score += trend.id === "water-resilience" ? 20 : 0;

    return {
      ...trend,
      matchScore: Math.min(99, score),
      liveReason:
        context.harvests > 0
          ? `Matched to your ${context.harvests} harvests, ${context.averageHealth}% average health, and ${context.simultaneousPlantings || 0} crop placements.`
          : "Starter recommendation until your first harvest creates live performance data.",
    };
  });

  return scored.sort((a, b) => b.matchScore - a.matchScore);
};
