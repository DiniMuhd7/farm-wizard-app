const axios = require("axios");
const crypto = require("crypto");

// Provisions one eSIM profile with the configured provider and returns what the
// phone needs to install it:
//   { iccid, smdpAddress, matchingId, activationCode, qrUrl?, providerOrderId }
//
// ESIM_PROVIDER=airalo  -> Airalo Partner API (needs AIRALO_CLIENT_ID/SECRET and
//                          ESIM_PACKAGE_MAP). Written from Airalo's public
//                          docs and NOT yet exercised against their sandbox —
//                          test with AIRALO_API_BASE=https://sandbox-partners-api.airalo.com
//                          before going live.
// ESIM_PROVIDER=mock    -> development only. Produces profiles that look right
//                          but cannot be installed; refused in production unless
//                          ESIM_ALLOW_MOCK=true, so nobody pays for a fake eSIM.

function packageIdFor(planId) {
  let map = {};
  try { map = JSON.parse(process.env.ESIM_PACKAGE_MAP || "{}"); } catch { /* handled below */ }
  const id = map[planId];
  if (!id) throw new Error(`No provider package is mapped for eSIM plan "${planId}" (ESIM_PACKAGE_MAP).`);
  return id;
}

async function airalo(plan, orderRef) {
  const base = (process.env.AIRALO_API_BASE || "https://partners-api.airalo.com").replace(/\/$/, "");
  if (!process.env.AIRALO_CLIENT_ID || !process.env.AIRALO_CLIENT_SECRET) {
    throw new Error("Airalo credentials are not configured.");
  }
  const packageId = packageIdFor(plan.id);
  const tokenResponse = await axios.post(
    `${base}/v2/token`,
    new URLSearchParams({
      client_id: process.env.AIRALO_CLIENT_ID,
      client_secret: process.env.AIRALO_CLIENT_SECRET,
      grant_type: "client_credentials",
    }).toString(),
    { timeout: 20000, headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" } }
  );
  const accessToken = tokenResponse.data?.data?.access_token;
  if (!accessToken) throw new Error("Airalo did not return an access token.");

  const orderResponse = await axios.post(
    `${base}/v2/orders`,
    { quantity: 1, package_id: packageId, type: "sim", description: `9tel ${orderRef}` },
    { timeout: 30000, headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" } }
  );
  const data = orderResponse.data?.data;
  const sim = data?.sims?.[0];
  if (!sim?.iccid) throw new Error("Airalo did not return an eSIM profile.");
  const smdpAddress = sim.lpa || null;
  const matchingId = sim.matching_id || null;
  const activationCode = typeof sim.qrcode === "string" && sim.qrcode.startsWith("LPA:")
    ? sim.qrcode
    : `LPA:1$${smdpAddress}$${matchingId}`;
  return {
    iccid: String(sim.iccid),
    smdpAddress,
    matchingId,
    activationCode,
    qrUrl: sim.qrcode_url || null,
    providerOrderId: String(data.id ?? ""),
  };
}

async function mock() {
  if (process.env.NODE_ENV === "production" && process.env.ESIM_ALLOW_MOCK !== "true") {
    throw new Error("eSIM provider is not configured.");
  }
  const matchingId = crypto.randomBytes(8).toString("hex").toUpperCase();
  const smdpAddress = "smdp.mock.9tel.invalid";
  return {
    iccid: `8901${Array.from({ length: 15 }, () => crypto.randomInt(0, 10)).join("")}`,
    smdpAddress,
    matchingId,
    activationCode: `LPA:1$${smdpAddress}$${matchingId}`,
    qrUrl: null,
    providerOrderId: `mock-${crypto.randomUUID()}`,
  };
}

exports.provisionEsim = async (plan, orderRef) => {
  const provider = (process.env.ESIM_PROVIDER || "mock").toLowerCase();
  if (provider === "airalo") return { provider, ...(await airalo(plan, orderRef)) };
  if (provider === "mock") return { provider, ...(await mock()) };
  throw new Error(`Unknown ESIM_PROVIDER "${provider}".`);
};
