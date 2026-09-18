const mongoose = require("mongoose");

// One row per completed Dial leg (see controllers/voice's dialStatus
// handlers), written from Twilio's own DialCallStatus callback rather than
// tracked client-side — the mobile app can be closed or crash mid-call and
// this still gets recorded correctly.
const callSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    direction: { type: String, enum: ["inbound", "outbound"], required: true },
    counterparty: { type: String, required: true }, // the other party's number or client identity
    status: {
      type: String,
      enum: ["completed", "no-answer", "busy", "failed", "canceled"],
      required: true,
    },
    durationSeconds: { type: Number, default: 0 },
    callSid: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Call", callSchema);
