const express = require("express");
const mongoose = require("mongoose");
const moment = require("moment");
const Earning = require("../../models/Earning");
const usdEarning = require("../../models/usdEarning");

function generateDateKeys(type, count) {
  const keys = [];
  const labels = [];
  const now = moment();

  for (let i = count - 1; i >= 0; i--) {
    if (type === "Daily") {
      const day = now.clone().subtract(i, "days");
      keys.push(day.format("YYYY-MM-DD"));
      labels.push(day.format("MMM D")); // e.g. "May 11"
    } else if (type === "Weekly") {
      const week = now.clone().subtract(i, "weeks");
      const key = week.isoWeek();
      keys.push(key);
      labels.push(`W${key}`);
    } else if (type === "Monthly") {
      const month = now.clone().subtract(i, "months");
      keys.push(month.format("YYYY-MM"));
      labels.push(month.format("MMM")); // e.g. "May"
    }
  }

  return { keys, labels };
}

function normalizeChartData(rawData, type, count) {
  const { keys, labels } = generateDateKeys(type, count);
  const dataMap = {};
  rawData.forEach((entry) => {
    dataMap[entry._id] = entry.total;
  });

  const values = keys.map((key) => dataMap[key] || 0);
  return { values, labels };
}

const getEarningData = async (req, res) => {
  const { type } = req.params;
  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }
  let groupFormat;
  const countMap = { Daily: 12, Weekly: 7, Monthly: 8 };
  const count = countMap[type];

  switch (type) {
    case "Daily":
      groupFormat = {
        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
      };
      break;
    case "Weekly":
      groupFormat = { $isoWeek: "$createdAt" };
      break;
    case "Monthly":
      groupFormat = {
        $dateToString: { format: "%Y-%m", date: "$createdAt" },
      };
      break;
    default:
      return res.status(400).json({ message: "Invalid chart type" });
  }

  try {
    const results = await Earning.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: groupFormat,
          total: { $sum: "$score" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const { values, labels } = normalizeChartData(results, type, count);
    res.json({ values, labels });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err });
  }
};

function formatDate(date, type) {
  if (type === "Daily") return date.toISOString().slice(0, 10); // YYYY-MM-DD
  if (type === "Weekly") {
    const week = Math.ceil(date.getDate() / 7);
    return `Week ${week} ${date.getMonth() + 1}/${date.getFullYear()}`;
  }
  if (type === "Monthly")
    return `${date.toLocaleString("default", {
      month: "short",
    })} ${date.getFullYear()}`;
}
const getUsdEarningData = async (req, res) => {
  const { type } = req.params;
  const userId = req.user._id;
  if (!userId) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  if (!["Daily", "Weekly", "Monthly"].includes(type)) {
    return res.status(400).json({ error: "Invalid chart type" });
  }

  try {
    const usdEarnings = await usdEarning.find({ userId });
    const earnings = await Earning.find({ userId });

    const grouped = {};

    for (const e of earnings) {
      const key = formatDate(new Date(e.createdAt), type);
      if (!grouped[key]) grouped[key] = 0;
      grouped[key] += e.score;
    }

    const labels = Object.keys(grouped).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    // const labels = ["1", "7", "14", "21", "28", "5", "13"];
    const data = labels.map((label) => grouped[label]);

    res.json({ labels, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch earnings" });
  }
};

module.exports = { getEarningData, getUsdEarningData };
