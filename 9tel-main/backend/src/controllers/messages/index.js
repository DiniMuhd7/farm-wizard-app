const { twilioRequestIsValid } = require("../../utils/twilioSignature");

const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_MEDIA = 10;

function twilioClient() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) throw new Error("Messaging is not configured.");
  return require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

function activeNumber(user) {
  return user?.phoneNumber && user.phoneNumberExpiresAt && new Date(user.phoneNumberExpiresAt).getTime() > Date.now()
    ? user.phoneNumber
    : null;
}

function mediaUrls(body) {
  const urls = Array.isArray(body?.mediaUrls) ? body.mediaUrls : [];
  if (urls.length > MAX_MEDIA || urls.some((url) => typeof url !== "string" || !/^https:\/\//i.test(url))) return null;
  return urls;
}

exports.listMessages = async (req, res) => {
  const withNumber = String(req.query?.with || "").trim();
  if (!E164.test(withNumber)) return res.status(400).json({ message: "Choose a valid recipient number." });
  try {
    const Message = require("../../models/Message");
    const messages = await Message.find({ user: req.user._id, $or: [{ from: withNumber }, { to: withNumber }] })
      .sort({ createdAt: 1 }).limit(200).lean();
    // Opening a conversation marks what the other person sent as read.
    await Message.updateMany(
      { user: req.user._id, direction: "inbound", from: withNumber, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.status(200).json({ messages });
  } catch (error) {
    console.error("Unable to list messages:", error.message);
    return res.status(500).json({ message: "Messages could not be loaded. Please try again." });
  }
};

// One row per person you have talked to: the latest message plus an unread count.
exports.listConversations = async (req, res) => {
  try {
    const Message = require("../../models/Message");
    const rows = await Message.aggregate([
      { $match: { user: req.user._id } },
      { $addFields: { peer: { $cond: [{ $eq: ["$direction", "outbound"] }, "$to", "$from"] } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$peer",
          last: { $first: "$$ROOT" },
          unread: {
            $sum: {
              $cond: [{ $and: [{ $eq: ["$direction", "inbound"] }, { $eq: [{ $ifNull: ["$readAt", null] }, null] }] }, 1, 0],
            },
          },
        },
      },
      { $sort: { "last.createdAt": -1 } },
      { $limit: 100 },
    ]);
    return res.status(200).json({
      conversations: rows.map((row) => ({ number: row._id, last: row.last, unread: row.unread })),
    });
  } catch (error) {
    console.error("Unable to list conversations:", error.message);
    return res.status(500).json({ message: "Conversations could not be loaded. Please try again." });
  }
};

exports.sendMessage = async (req, res) => {
  const to = String(req.body?.to || "").trim();
  const body = String(req.body?.body || "").trim();
  const attachments = mediaUrls(req.body);
  if (!E164.test(to)) return res.status(400).json({ message: "Enter a valid recipient number." });
  if ((!body && !attachments?.length) || body.length > 1600 || !attachments) return res.status(400).json({ message: "Enter a message or attach up to 10 HTTPS media files." });
  const from = activeNumber(req.user);
  if (!from) return res.status(403).json({ message: "Get an active 9tel number before sending messages." });

  try {
    const sent = await twilioClient().messages.create({ to, from, body, ...(attachments.length ? { mediaUrl: attachments } : {}) });
    const Message = require("../../models/Message");
    const message = await Message.create({ user: req.user._id, sid: sent.sid, direction: "outbound", from, to, body, mediaUrls: attachments, status: sent.status || "queued" });
    return res.status(201).json({ message });
  } catch (error) {
    console.error("Unable to send Twilio message:", error.message);
    return res.status(502).json({ message: "Message could not be sent. Please try again." });
  }
};

// Configure this endpoint as the Messaging webhook for every provisioned
// number. Twilio signs the request; the app never accepts inbound messages.
exports.incomingMessage = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const to = String(req.body?.To || "").trim();
  const from = String(req.body?.From || "").trim();
  if (!E164.test(to) || !E164.test(from)) return res.type("text/xml").send("<Response></Response>");
  const User = require("../../models/User");
  const owner = await User.findOne({ phoneNumber: to }).select("_id").lean();
  const { isBlockedBy } = require("../../utils/blocklist");
  if (owner && !(await isBlockedBy(owner._id, [from]))) {
    const count = Math.min(Number(req.body?.NumMedia) || 0, MAX_MEDIA);
    const urls = Array.from({ length: count }, (_, i) => req.body[`MediaUrl${i}`]).filter((url) => typeof url === "string");
    await require("../../models/Message").updateOne(
      { sid: String(req.body?.MessageSid || req.body?.SmsSid || "") },
      { $setOnInsert: { user: owner._id, sid: String(req.body?.MessageSid || req.body?.SmsSid), direction: "inbound", from, to, body: String(req.body?.Body || ""), mediaUrls: urls, status: "received" } },
      { upsert: true }
    );
  }
  return res.type("text/xml").send("<Response></Response>");
};
