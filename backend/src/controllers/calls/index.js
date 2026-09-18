const Call = require("../../models/Call");

exports.getMyCalls = async (req, res) => {
  const calls = await Call.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return res.status(200).json({
    calls: calls.map((call) => ({
      id: call._id,
      direction: call.direction,
      counterparty: call.counterparty,
      status: call.status,
      durationSeconds: call.durationSeconds,
      at: call.createdAt,
    })),
  });
};

exports.getMyCallStats = async (req, res) => {
  const now = new Date();
  // Monday-start week, matching the bar chart's M T W T F S S labels.
  const day = now.getDay(); // 0 = Sun
  const daysSinceMonday = (day + 6) % 7;
  const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysSinceMonday);
  const startOfPrevWeek = new Date(startOfWeek);
  startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

  const [thisWeek, lastWeek] = await Promise.all([
    Call.find({ user: req.user._id, createdAt: { $gte: startOfWeek } }).lean(),
    Call.find({ user: req.user._id, createdAt: { $gte: startOfPrevWeek, $lt: startOfWeek } }).lean(),
  ]);

  const totalSeconds = thisWeek.reduce((sum, call) => sum + (call.durationSeconds || 0), 0);
  const lastWeekSeconds = lastWeek.reduce((sum, call) => sum + (call.durationSeconds || 0), 0);
  const outgoing = thisWeek.filter((call) => call.direction === "outbound").length;
  const incoming = thisWeek.filter((call) => call.direction === "inbound").length;
  const missedCalls = thisWeek.filter((call) => call.direction === "inbound" && call.status !== "completed").length;
  const connectedCalls = thisWeek.filter((call) => call.status === "completed");
  const avgSeconds = connectedCalls.length
    ? Math.round(connectedCalls.reduce((sum, call) => sum + (call.durationSeconds || 0), 0) / connectedCalls.length)
    : 0;

  // Mon..Sun call counts for the week's bar chart.
  const dailyCounts = [0, 0, 0, 0, 0, 0, 0];
  thisWeek.forEach((call) => {
    const created = new Date(call.createdAt);
    const index = (created.getDay() + 6) % 7;
    dailyCounts[index] += 1;
  });
  const busiestDayIndex = dailyCounts.every((count) => count === 0)
    ? null
    : dailyCounts.indexOf(Math.max(...dailyCounts));

  return res.status(200).json({
    windowDays: 7,
    totalCalls: thisWeek.length,
    totalSeconds,
    outgoing,
    incoming,
    missedCalls,
    avgSeconds,
    dailyCounts,
    busiestDayIndex,
    // null when there's no prior week to compare against, rather than a
    // misleading 0%.
    changeFromLastWeekPercent:
      lastWeekSeconds > 0 ? Math.round(((totalSeconds - lastWeekSeconds) / lastWeekSeconds) * 100) : null,
  });
};
