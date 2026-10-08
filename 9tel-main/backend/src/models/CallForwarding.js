const mongoose = require("mongoose");

// One forwarding rule per user for calls to their 9tel number.
//   mode "always"    -> never ring the app, send straight to `number`
//   mode "no_answer" -> ring the app first; forward if it isn't answered,
//                       is busy, or the app can't be reached
const callForwardingSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    enabled: { type: Boolean, default: false },
    mode: { type: String, enum: ["always", "no_answer"], default: "no_answer" },
    number: { type: String, default: null }, // E.164
  },
  { timestamps: true }
);

module.exports = mongoose.model("CallForwarding", callForwardingSchema);
