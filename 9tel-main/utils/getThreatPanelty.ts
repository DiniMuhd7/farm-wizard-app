export const getThreatPanelty = (level: number) => {
  if (level === 1) return 5;
  if (level === 2) return 10;
  if (level === 3) return 15;
  if (level === 4) return 20;
  if (level === 5) return 25;
  if (level === 6) return 30;
  return 35;
};
