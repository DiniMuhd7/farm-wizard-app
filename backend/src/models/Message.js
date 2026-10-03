const mongoose = require("mongoose");

// A local, user-scoped mirror of Twilio messages. Twilio remains the delivery
// authority; keeping this mirror lets the app render a conversation without
// exposing the Twilio API or its credentials to the device.
const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sid: { type: String, required: true, unique: true },
  direction: { type: String, enum: ["inbound", "outbound"], required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  body: { type: String, default: "" },
  mediaUrls: { type: [String], default: [] },
  status: { type: String, default: "queued" },
}, { timestamps: true });

messageSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
