const crypto = require("crypto");
const { twilioRequestIsValid, escapedXml } = require("../../utils/twilioSignature");

const TOKEN_TTL_SECONDS = 60 * 60;
const E164 = /^\+[1-9]\d{6,14}$/;
const CLIENT_IDENTITY = /^client:[A-Za-z0-9_-]{1,121}$/;

const base64Url = (value) => Buffer.from(value).toString("base64url");

function requireVoiceConfiguration() {
  const required = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_API_KEY_SID",
    "TWILIO_API_KEY_SECRET",
    "TWILIO_TWIML_APP_SID",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Voice service is not configured: ${missing.join(", ")}`);
}

// A phone can only be rung by Twilio Voice through a push notification (FCM on
// Android, APNs VoIP on iOS). The Voice SDK registers the device for that push
// using the access token, and the token must therefore carry the SID of the
// Twilio Push Credential for that platform. Without it register() fails, the
// device is never registered, and every call to the user dies instantly with
// no ring and no missed-call record.
function pushCredentialSid(platform) {
  const p = String(platform || "").toLowerCase();
  if (p === "ios") return process.env.TWILIO_PUSH_CREDENTIAL_SID_IOS || null;
  if (p === "android") return process.env.TWILIO_PUSH_CREDENTIAL_SID_ANDROID || null;
  return process.env.TWILIO_PUSH_CREDENTIAL_SID || null;
}

function createVoiceAccessToken(identity, platform) {
  requireVoiceConfiguration();
  const pushSid = pushCredentialSid(platform);
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" }));
  const payload = base64Url(JSON.stringify({
    jti: `${process.env.TWILIO_API_KEY_SID}-${crypto.randomUUID()}`,
    iss: process.env.TWILIO_API_KEY_SID,
    sub: process.env.TWILIO_ACCOUNT_SID,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    grants: {
      identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: process.env.TWILIO_TWIML_APP_SID },
        ...(pushSid ? { push_credential_sid: pushSid } : {}),
      },
    },
  }));
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createHmac("sha256", process.env.TWILIO_API_KEY_SECRET).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

// Video uses the same Twilio API key and access-token signing mechanism as
// Voice, but a Video grant authorizes joining one named Room instead of a
// TwiML application. The room is supplied only after server-side validation.
function createVideoAccessToken(identity, room) {
  requireVoiceConfiguration();
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ typ: "JWT", alg: "HS256", cty: "twilio-fpa;v=1" }));
  const payload = base64Url(JSON.stringify({
    jti: `${process.env.TWILIO_API_KEY_SID}-${crypto.randomUUID()}`,
    iss: process.env.TWILIO_API_KEY_SID,
    sub: process.env.TWILIO_ACCOUNT_SID,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
    grants: { identity, video: { room } },
  }));
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${crypto.createHmac("sha256", process.env.TWILIO_API_KEY_SECRET).update(signingInput).digest("base64url")}`;
}

function isAllowedDestination(destination) {
  if (CLIENT_IDENTITY.test(destination)) return true;
  if (!E164.test(destination)) return false;
  const prefixes = (process.env.TWILIO_ALLOWED_DESTINATION_PREFIXES || "").split(",").map((value) => value.trim()).filter(Boolean);
  return prefixes.length > 0 && prefixes.some((prefix) => destination.startsWith(prefix));
}

exports.issueToken = (req, res) => {
  try {
    const identity = `user-${req.user._id.toString()}`;
    const platform = String(req.query?.platform || "");
    const pushConfigured = Boolean(pushCredentialSid(platform));
    if (!pushConfigured) {
      console.error(`Voice token issued WITHOUT a push credential (platform: ${platform || "unspecified"}). This device cannot receive calls — set TWILIO_PUSH_CREDENTIAL_SID_${platform.toUpperCase() || "ANDROID/IOS"}. See docs/INCOMING_CALLS.md.`);
    }
    return res.status(200).json({ token: createVoiceAccessToken(identity, platform), identity, expiresIn: TOKEN_TTL_SECONDS, pushConfigured });
  } catch (error) {
    console.error("Unable to issue Twilio Voice token", error.message);
    return res.status(503).json({ message: "Voice calling is not configured" });
  }
};

// Room names are generated server-side. This keeps arbitrary users from
// joining a guessed room and gives both participants the same stable room for
// an app-to-app video call.
exports.issueVideoToken = async (req, res) => {
  const destination = String(req.body?.to || "").trim();
  if (!E164.test(destination)) return res.status(400).json({ message: "Enter a valid 9tel number for a video call." });
  try {
    const User = require("../../models/User");
    const recipient = await User.findOne({ phoneNumber: destination, status: { $ne: "inactive" } }).select("_id").lean();
    if (!recipient) return res.status(404).json({ message: "Video calls are available only between active 9tel users." });
    const callerId = req.user._id.toString();
    const recipientId = recipient._id.toString();
    if (callerId === recipientId) return res.status(400).json({ message: "Choose another 9tel user for a video call." });
    const room = `9tel-${[callerId, recipientId].sort().join("-")}`;
    return res.status(200).json({ token: createVideoAccessToken(`user-${callerId}`, room), room, expiresIn: TOKEN_TTL_SECONDS });
  } catch (error) {
    console.error("Unable to issue Twilio Video token", error.message);
    return res.status(503).json({ message: "Video calling is not configured." });
  }
};

function resolveCallerIdentity(caller) {
  const verifiedIsAuthoritative =
    caller?.verifiedCallerId &&
    E164.test(caller.verifiedCallerId) &&
    caller.callerIdStatus === "verified" &&
    // Only a number the provider itself approved as an outbound caller ID may
    // be presented. A spoken-code (possession) verification proves ownership
    // to 9tel but does not make the number provider-approved, so presenting
    // it could be rejected or spoof; those accounts use the shared fallback.
    (caller.callerIdVerificationMethod === "twilio" || !caller.callerIdVerificationMethod);
  if (verifiedIsAuthoritative) return { callerId: caller.verifiedCallerId, callerIdStatus: "verified" };
  const fallback = process.env.TWILIO_CALLER_ID;
  if (!fallback || !E164.test(fallback)) return null;
  return { callerId: fallback, callerIdStatus: "unverified" };
}


// ---- Call forwarding -------------------------------------------------------
// The user's active forwarding rule, or null. Fails open (no forwarding) on a
// database error so a hiccup never breaks ordinary ringing.
async function forwardingFor(userId) {
  try {
    const rule = await require("../../models/CallForwarding").findOne({ user: userId, enabled: true }).lean();
    return rule && E164.test(rule.number || "") ? rule : null;
  } catch (error) {
    console.error("Unable to load call forwarding:", error.message);
    return null;
  }
}

// TwiML that dials the forwarding number, or null when the call must not be
// forwarded. Forwarded calls are real phone-network calls billed to the
// owner's Prepaid credits, so forwarding only happens when the balance covers
// at least one minute, and Twilio itself caps the call at what the balance can
// pay for (<Dial timeLimit>) so it can never overdraw.
async function forwardTwiML(userId, ownNumber, callerNumber, rule) {
  if (callerNumber === rule.number) return null; // never bounce a caller back to themselves
  try {
    const account = await require("../../models/User").findById(userId).select("creditsBalanceCents").lean();
    const balance = account?.creditsBalanceCents || 0;
    const rate = await require("../../utils/voiceRates").carrierRateCents(rule.number, ownNumber);
    if (!(rate > 0) || balance < rate) return null;
    const limit = Math.max(60, Math.floor(balance / rate) * 60);
    // By default the forwarded leg shows the user's own 9tel number (always
    // valid for Twilio). Set FORWARD_PASS_THROUGH_CALLER_ID=true to present the
    // original caller instead, if your Twilio account allows it.
    const callerIdAttr = process.env.FORWARD_PASS_THROUGH_CALLER_ID === "true" || !E164.test(ownNumber || "")
      ? ""
      : ` callerId="${escapedXml(ownNumber)}"`;
    const action = escapedXml(
      `${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/incoming/status?userId=${userId}&forwarded=1&rateCents=${rate}`
    );
    return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="30" timeLimit="${limit}"${callerIdAttr} action="${action}" method="POST"><Number>${escapedXml(rule.number)}</Number></Dial></Response>`;
  } catch (error) {
    console.error("Unable to build forwarding TwiML:", error.message);
    return null;
  }
}

exports.outgoingCallTwiML = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const destination = String(req.body?.To || "").trim();

  // Caller identity is resolved server-side only. A user's own number is used
  // as the outbound identity solely when Twilio's signed verification callback
  // persisted it (callerIdStatus "verified"). Unverified, pending, failed,
  // expired and developer-test numbers never become the From identity; those
  // callers use the provider-owned TWILIO_CALLER_ID. Calls are never blocked
  // merely because the caller ID is unverified.
  const from = String(req.body?.From || "");
  const callerMatch = from.match(/^client:user-([A-Za-z0-9]+)$/);
  let caller = null;
  if (callerMatch) {
    const User = require("../../models/User");
    caller = await User.findById(callerMatch[1])
      .select("verifiedCallerId callerIdStatus callerIdVerificationMethod phoneNumber phoneNumberExpiresAt isGuest")
      .lean();
  }
  if (caller?.phoneNumber && (!caller.phoneNumberExpiresAt || new Date(caller.phoneNumberExpiresAt).getTime() <= Date.now())) {
    return res.type("text/xml").send("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Say>Your 9tel number access has expired. Renew it to place calls.</Say></Response>");
  }
  const callerIdentity = resolveCallerIdentity(caller);
  if (!callerIdentity) {
    console.error("Outbound call refused: no verified caller ID and TWILIO_CALLER_ID is missing or not E.164");
    return res
      .status(503)
      .type("text/plain")
      .send("Voice caller ID is not configured: set TWILIO_CALLER_ID to a Twilio-owned or Twilio-verified E.164 number so unverified accounts can place calls.");
  }
  const callerId = callerIdentity.callerId;
  const baseUrl = `${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/outgoing/status`;
  const action = escapedXml(baseUrl);

  // If the dialed number happens to belong to another 9tel user, try
  // reaching their app directly first — free, instant, no PSTN leg — and
  // only fall back to actually dialing the number over the phone network if
  // they're not reachable that way (app closed, not registered, or just
  // doesn't pick up in time). A plain phone number with no 9tel account
  // behind it skips straight to the normal dial-the-number path below, same
  // as before. This lookup is intentionally allowed regardless of
  // TWILIO_ALLOWED_DESTINATION_PREFIXES — it's a known, already-provisioned
  // number belonging to this system, not an arbitrary external destination.
  if (E164.test(destination)) {
    const User = require("../../models/User");
    // A 9tel account is identified by either its provisioned 9tel number or
    // its own verified real number — the same two numbers
    // controllers/numbers' lookupNumber matches on, so what the app
    // previews is exactly what gets routed.
    const owner = await User.findOne({
      status: { $ne: "inactive" },
      $or: [{ phoneNumber: destination }, { verifiedCallerId: destination }],
    }).select("_id").lean();
    if (owner && String(owner._id) !== callerMatch?.[1]) {
      // The callee has blocked the caller's number: end the call without
      // ringing them (and without the PSTN fallback). The caller hears the
      // same message as any unreachable person, so a block isn't revealed.
      const { isBlockedBy } = require("../../utils/blocklist");
      if (await isBlockedBy(owner._id, [caller?.phoneNumber, caller?.verifiedCallerId])) {
        return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>The person you are calling is unavailable. Please try again later.</Say><Hangup/></Response>`);
      }
      const identity = escapedXml(`user-${owner._id.toString()}`);
      const fallbackAction0 = escapedXml(`${baseUrl}?fallbackTo=${encodeURIComponent(destination)}`);
      // "Always forward": don't ring their app. Redirecting to the fallback
      // handler dials their 9tel number over the phone network, which reaches
      // /incoming and is forwarded from there.
      const rule = await forwardingFor(owner._id);
      if (rule && rule.mode === "always") {
        return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Redirect method="POST">${fallbackAction0}</Redirect></Response>`);
      }
      // Short timeout: this is the "try the app" attempt, not the real
      // call — if it's going to connect at all, it'll ring and answer well
      // within this, and a genuinely offline/unregistered client fails
      // near-instantly anyway. Keeping this short bounds how long the
      // caller waits before the PSTN fallback kicks in.
      const fallbackAction = escapedXml(`${baseUrl}?fallbackTo=${encodeURIComponent(destination)}&calleeId=${owner._id.toString()}`);
      return res.type("text/xml").send(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}" timeout="12" action="${fallbackAction}" method="POST"><Client>${identity}</Client></Dial></Response>`
      );
    }
  }

  if (!isAllowedDestination(destination)) return res.status(400).type("text/xml").send("<Response><Say>That destination is not permitted.</Say></Response>");

  // Carrier (PSTN) leg. Enforced here, server-side, from the database — the
  // app's own checks are only a courtesy. Order of precedence:
  //   1. enough Prepaid credits for a minute -> normal billed call
  //   2. otherwise the user's one-time welcome minute, hard-capped by
  //      Twilio itself via <Dial timeLimit>, never by the client
  //   3. otherwise the call is refused
  // Calls to the caller's own numbers never qualify for the reward.
  let timeLimitAttr = "";
  let billing = "credits";
  let ratePerMinuteCents = 0;
  if (callerMatch && E164.test(destination)) {
    const { carrierRateCents } = require("../../utils/voiceRates");
    const User = require("../../models/User");
    const account = await User.findById(callerMatch[1]).select("creditsBalanceCents airbundleMinutes premiumUntil").lean();
    const airbundleActive = (account?.airbundleMinutes || 0) > 0 &&
      account?.premiumUntil && new Date(account.premiumUntil).getTime() > Date.now();
    ratePerMinuteCents = await carrierRateCents(destination, callerId);
    const hasCredits = (account?.creditsBalanceCents || 0) >= ratePerMinuteCents;
    if (airbundleActive) {
      billing = "airbundle";
      // Twilio enforces the remaining bundle duration; settlement below then
      // deducts its reported whole minutes from the same bundle.
      timeLimitAttr = ` timeLimit="${Math.max(60, Math.floor(account.airbundleMinutes) * 60)}"`;
    } else if (!hasCredits) {
      const ownNumber = destination === caller?.verifiedCallerId || destination === caller?.phoneNumber;
      let freeSeconds = 0;
      if (!ownNumber && !caller?.isGuest) {
        try {
          const { ensureWelcomeReward, reserveForCall } = require("../rewards");
          await ensureWelcomeReward(callerMatch[1]);
          freeSeconds = await reserveForCall(callerMatch[1], String(req.body?.CallSid || ""));
        } catch (error) {
          // Never surface this distinction to the caller (they always see
          // the same plain "not enough credit" message below) — but log it
          // loudly and distinctly from an ordinary "not eligible" outcome,
          // since this branch means the reward system itself is broken
          // (e.g. missing JWT_SECRET) rather than this account simply not
          // qualifying. See GET /api/v1/rewards/diagnostics for the
          // operator-facing, per-user version of this same distinction.
          console.error("Welcome reward configuration failure — reward could not be evaluated:", {
            userId: callerMatch[1],
            error: error.message,
          });
        }
      }
      if (!freeSeconds) {
        return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>You do not have enough credit to place this call. Please top up and try again.</Say></Response>`);
      }
      timeLimitAttr = ` timeLimit="${freeSeconds}"`;
    }
  }
  const billedAction = escapedXml(`${baseUrl}?billing=${billing}&rateCents=${billing === "credits" ? ratePerMinuteCents || 0 : 0}`);
  const noun = destination.startsWith("client:") ? `<Client>${escapedXml(destination.slice(7))}</Client>` : `<Number>${escapedXml(destination)}</Number>`;
  return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}"${timeLimitAttr} action="${billedAction}" method="POST">${noun}</Dial></Response>`);
};

// Twilio hits this whenever someone dials a 9tel number on the PSTN. `To` is
// the number they dialed (one of the numbers provisioned via
// POST /api/v1/numbers/provision); `From` is the caller. We look up which
// user owns that number and ring their app via the same Client identity the
// mobile app registers with (see controllers/voice issueToken, and
// services/voice.ts's Voice.Event.CallInvite listener on the client side).
//
// If the callee's app isn't registered and connected (closed/killed, or push
// isn't configured), Dial's `timeout` elapses with no answer and control
// passes to the `action` URL below with the dial's outcome — NOT to a fixed
// fallback TwiML block after </Dial>, which would also fire (and confusingly
// play an "unavailable" message) after every ordinary *successful* call too,
// since <Dial> falls through to whatever follows it once the call ends for
// any reason, answered or not.
exports.incomingCallTwiML = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const dialedNumber = String(req.body?.To || "").trim();
  if (!E164.test(dialedNumber)) {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not in service.</Say></Response>`);
  }

  const User = require("../../models/User");
  const owner = await User.findOne({ phoneNumber: dialedNumber }).select("_id").lean();
  if (!owner) {
    // A number Twilio still routes to us but no user currently holds —
    // e.g. released after account deletion but not yet deprovisioned on
    // Twilio's side. Fail safe rather than dial an empty/wrong identity.
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>This number is not currently assigned. Goodbye.</Say></Response>`);
  }

  // A blocked caller is rejected before the phone ever rings.
  const { isBlockedBy } = require("../../utils/blocklist");
  if (await isBlockedBy(owner._id, [String(req.body?.From || "").trim()])) {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject reason="busy"/></Response>`);
  }

  const callerNumber = String(req.body?.From || "").trim();
  const rule = await forwardingFor(owner._id);
  if (rule && rule.mode === "always") {
    const forwardedTwiml = await forwardTwiML(owner._id.toString(), dialedNumber, callerNumber, rule);
    if (forwardedTwiml) return res.type("text/xml").send(forwardedTwiml);
    // Not forwardable right now (e.g. no credit): ring the app as normal.
  }

  const identity = escapedXml(`user-${owner._id.toString()}`);
  const action = escapedXml(
    `${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/incoming/status?userId=${owner._id.toString()}`
  );
  return res.type("text/xml").send(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Dial timeout="25" answerOnBridge="true" action="${action}" method="POST"><Client>${identity}</Client></Dial></Response>`
  );
};

// Shared by both status callbacks below: only actually-failed-to-connect
// outcomes get a spoken message. A normal call that connected and was later
// hung up by either side also reaches an `action` URL (that's how <Dial>
// works), and must NOT play "unavailable" on the way out.
function respondToDialOutcome(res, dialCallStatus) {
  if (dialCallStatus === "completed") {
    return res.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?><Response></Response>`);
  }
  return res
    .type("text/xml")
    .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>The person you are calling is unavailable. Please try again later.</Say></Response>`);
}

function normalizedDialStatus(rawStatus) {
  const allowed = ["completed", "no-answer", "busy", "failed", "canceled"];
  return allowed.includes(rawStatus) ? rawStatus : "failed";
}

async function logCall({ userId, direction, counterparty, dialCallStatus, dialCallDuration, callSid }) {
  try {
    const Call = require("../../models/Call");
    await Call.create({
      user: userId,
      direction,
      counterparty,
      status: normalizedDialStatus(dialCallStatus),
      durationSeconds: Number(dialCallDuration) || 0,
      callSid,
    });
  } catch (error) {
    // Never let CDR logging break the live call flow — the person on the
    // call has already heard the outcome via TwiML by the time this runs.
    console.error("Unable to log call record:", error.message);
  }
}


// Records the app-to-app attempt in the CALLEE's history. Before this, only the
// caller ever got a record, so a call to a 9tel user that didn't ring left no
// trace — not even a missed call — on the receiving side.
async function logCalleeInbound(req, calleeId, dialCallStatus) {
  if (!/^[a-f0-9]{24}$/i.test(String(calleeId || ""))) return;
  try {
    let counterparty = "9tel user";
    const match = String(req.body?.From || "").match(/^client:user-([A-Za-z0-9]+)$/);
    if (match) {
      const caller = await require("../../models/User").findById(match[1]).select("phoneNumber verifiedCallerId").lean();
      counterparty = caller?.phoneNumber || caller?.verifiedCallerId || counterparty;
    }
    // Anything that didn't connect (unreachable app, no answer, caller hung up
    // first) is a missed call from the callee's point of view.
    const status = dialCallStatus === "completed" ? "completed" : dialCallStatus === "busy" ? "busy" : "no-answer";
    await logCall({
      userId: calleeId,
      direction: "inbound",
      counterparty,
      dialCallStatus: status,
      dialCallDuration: dialCallStatus === "completed" ? req.body?.DialCallDuration : 0,
      callSid: req.body?.DialCallSid,
    });
  } catch (error) {
    console.error("Unable to log callee call record:", error.message);
  }
}

// Called once the outbound Dial leg from /outgoing ends, however it ended.
// `From` on THIS request is the same client identity that placed the call
// (Twilio resends the original request's parameters here), e.g.
// "client:user-<id>" — that's how we know which user to attribute it to.
//
// A `fallbackTo` query param means this was the app-to-app attempt (see
// outgoingCallTwiML) and it didn't connect — fall back to a real PSTN call
// to the same number, exactly like an ordinary outbound call. That second
// leg's own action callback (no fallbackTo param on it) is what actually
// logs the call and speaks the final outcome — a call that had to fall
// back still ends up as exactly one entry in the caller's history, not two.
exports.outgoingDialStatus = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const dialCallStatus = req.body?.DialCallStatus;
  const fallbackTo = req.query?.fallbackTo ? String(req.query.fallbackTo) : null;

  const calleeId = req.query?.calleeId ? String(req.query.calleeId) : null;
  if (fallbackTo && calleeId) await logCalleeInbound(req, calleeId, dialCallStatus);

  if (fallbackTo && dialCallStatus !== "completed") {
    // No isAllowedDestination check here on purpose: fallbackTo only ever
    // gets set in outgoingCallTwiML after confirming it's an existing 9tel
    // user's own provisioned number, not arbitrary caller-supplied input —
    // the prefix allow-list exists to gate arbitrary external PSTN spend,
    // which doesn't apply to a number this system already owns.
    const callerId = process.env.TWILIO_CALLER_ID;
    const action = escapedXml(`${process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || ""}/api/v1/voice/outgoing/status`);
    return res.type("text/xml").send(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Dial callerId="${callerId}" action="${action}" method="POST"><Number>${escapedXml(fallbackTo)}</Number></Dial></Response>`
    );
  }

  const from = String(req.body?.From || "");
  const match = from.match(/^client:user-([A-Za-z0-9]+)$/);
  if (match) {
    await logCall({
      userId: match[1],
      direction: "outbound",
      counterparty: String(req.body?.To || "unknown"),
      dialCallStatus,
      dialCallDuration: req.body?.DialCallDuration,
      callSid: req.body?.DialCallSid,
    });

    // Prepaid billing. `fallbackTo` reaching this far (rather than
    // being intercepted above) means the FIRST leg — the app-to-app
    // attempt — connected: an Airbundle 9tel-to-9tel call, not a carrier
    // leg, so it must never be billed even though `To` is still the E.164
    // number that was originally dialed (Twilio echoes the parent call's
    // own params here, not the Dial leg's). Every other completed leg with
    // an E.164 `To` is a real PSTN leg that actually reached a carrier —
    // either the one direct-dial path, or the second (fallback) leg after
    // the 9tel app didn't pick up — and is billed against the caller's
    // credits balance using Twilio's own reported duration.
    const to = String(req.body?.To || "").trim();
    const appToAppSuccess = Boolean(fallbackTo) && dialCallStatus === "completed";
    if (appToAppSuccess) {
      const { debitForCompletedCall } = require("../credits");
      const { appToAppRateCents } = require("../../utils/voiceRates");
      await debitForCompletedCall(match[1], Number(req.body?.DialCallDuration) || 0, appToAppRateCents(), String(req.body?.DialCallSid || req.body?.CallSid || "") || undefined);
      return respondToDialOutcome(res, dialCallStatus);
    }
    if (E164.test(to)) {
      const billedWithAirbundle = req.query?.billing === "airbundle";
      if (dialCallStatus === "completed" && billedWithAirbundle) {
        const duration = Number(req.body?.DialCallDuration) || 0;
        const minutes = Math.max(1, Math.ceil(duration / 60));
        // Claim the provider call id before decrementing, so a webhook
        // redelivery cannot consume the same bundle minutes twice. The
        // compare-and-set also keeps a late callback from taking the balance
        // below zero after Twilio's time limit.
        const callSid = String(req.body?.DialCallSid || req.body?.CallSid || "");
        if (callSid) {
          try {
            await require("../../models/BilledCall").create({ callSid, user: match[1], costCents: 0 });
          } catch (error) {
            if (error?.code === 11000) return respondToDialOutcome(res, dialCallStatus);
            throw error;
          }
        }
        const debited = await User.findOneAndUpdate(
          { _id: match[1], airbundleMinutes: { $gte: minutes } },
          { $inc: { airbundleMinutes: -minutes } },
        );
        if (!debited && callSid) await require("../../models/BilledCall").deleteOne({ callSid }).catch(() => {});
        return respondToDialOutcome(res, dialCallStatus);
      }
      // Settle the welcome-reward reservation (if this call held one)
      // before billing: a redeemed free minute is never also debited, and
      // a call that never connected hands the reward back.
      let rewardOutcome = null;
      try {
        const duration = Number(req.body?.DialCallDuration) || 0;
        rewardOutcome = await require("../rewards").settleForCall(match[1], String(req.body?.CallSid || ""), {
          connected: dialCallStatus === "completed" && duration > 0,
          durationSeconds: duration,
        });
      } catch (error) {
        console.error("Unable to settle welcome reward:", error.message);
      }
      // A redeemed free minute (or a redelivered event for one) is never
      // also debited; Twilio's timeLimit already capped it at 60 seconds.
      if (dialCallStatus === "completed" && rewardOutcome !== "redeemed" && rewardOutcome !== "replayed") {
        const { debitForCompletedCall, RATE_PER_MINUTE_CENTS } = require("../credits");
        const requestedRateCents = Number(req.query?.rateCents);
        const rateCents = Number.isSafeInteger(requestedRateCents) && requestedRateCents > 0 ? requestedRateCents : RATE_PER_MINUTE_CENTS;
        await debitForCompletedCall(match[1], Number(req.body?.DialCallDuration) || 0, rateCents, String(req.body?.DialCallSid || req.body?.CallSid || "") || undefined);
      }
    }
  }
  return respondToDialOutcome(res, dialCallStatus);
};

// Called once the inbound Dial leg from /incoming ends. The owning user's id
// travels through as a query param on the `action` URL rather than a second
// DB lookup by number — see incomingCallTwiML above.
exports.incomingDialStatus = async (req, res) => {
  if (!twilioRequestIsValid(req)) return res.status(403).type("text/plain").send("Invalid Twilio signature");
  const userId = String(req.query?.userId || "");
  const dialStatus = req.body?.DialCallStatus;

  // The forwarded leg just ended: log it as this user's inbound call and bill
  // the forwarded minutes to their Prepaid credits.
  if (userId && req.query?.forwarded === "1") {
    await logCall({
      userId,
      direction: "inbound",
      counterparty: String(req.body?.From || "unknown"),
      dialCallStatus: dialStatus,
      dialCallDuration: req.body?.DialCallDuration,
      callSid: req.body?.DialCallSid,
    });
    if (dialStatus === "completed") {
      const { debitForCompletedCall, RATE_PER_MINUTE_CENTS } = require("../credits");
      const requestedRate = Number(req.query?.rateCents);
      const rateCents = Number.isSafeInteger(requestedRate) && requestedRate > 0 ? requestedRate : RATE_PER_MINUTE_CENTS;
      await debitForCompletedCall(userId, Number(req.body?.DialCallDuration) || 0, rateCents, String(req.body?.DialCallSid || req.body?.CallSid || "") || undefined);
    }
    return respondToDialOutcome(res, dialStatus);
  }

  // The app didn't pick up (no answer / busy / unreachable): forward instead,
  // if the user has a rule. A caller who hung up ("canceled") is not forwarded.
  // The forwarded leg's own callback records the call, so it's logged once.
  if (userId && ["no-answer", "busy", "failed"].includes(dialStatus)) {
    const rule = await forwardingFor(userId);
    if (rule) {
      const forwardedTwiml = await forwardTwiML(userId, String(req.body?.To || "").trim(), String(req.body?.From || "").trim(), rule);
      if (forwardedTwiml) return res.type("text/xml").send(forwardedTwiml);
    }
  }

  // A call arriving from the shared TWILIO_CALLER_ID is our own app-to-app
  // fallback leg; the attempt was already recorded (with the real caller) when
  // the app leg ended, so don't add a second, anonymous missed call.
  const fromInternalFallback = Boolean(process.env.TWILIO_CALLER_ID) && String(req.body?.From || "").trim() === process.env.TWILIO_CALLER_ID;
  if (userId && !(fromInternalFallback && dialStatus !== "completed")) {
    await logCall({
      userId,
      direction: "inbound",
      counterparty: String(req.body?.From || "unknown"),
      dialCallStatus: req.body?.DialCallStatus,
      dialCallDuration: req.body?.DialCallDuration,
      callSid: req.body?.DialCallSid,
    });
  }
  return respondToDialOutcome(res, req.body?.DialCallStatus);
};

exports._private = { createVoiceAccessToken, isAllowedDestination, resolveCallerIdentity };
