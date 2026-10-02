# Caller-ID verification

## Why SMS did not work

Twilio does not accept an SMS/Twilio Verify OTP as proof for an outgoing caller ID. Its Outgoing Caller ID resource requires Twilio to call the number and the person to enter the code read during that call. Twilio Verify can confirm phone ownership for authentication, but does not authorize the number as a caller ID. 9tel therefore uses Twilio's supported voice validation request and trusts only its signed callback.

The app never receives, displays, or logs the provider's validation code. The person answers the call and enters the spoken code on the phone keypad. Caller-ID state is persisted and changes to `verified` only for the current, unexpired attempt when Twilio returns a valid signed success callback.

## Production setup

Configure these values in the **backend** environment (for example Render → the `ninetel-backend-api` service → Environment):

1. `TWILIO_ACCOUNT_SID` — the Twilio account SID used by the backend.
2. `TWILIO_AUTH_TOKEN` — that account's Auth Token; keep it server-side.
3. `PUBLIC_BASE_URL` — the public HTTPS backend origin, with no trailing slash. It must exactly match the externally visible host used for Twilio signature validation.
4. `TWILIO_CALLER_ID` — an E.164 number owned by the Twilio account; required for outbound calls when a user has no provider-verified caller ID. It is not needed to initiate caller-ID verification itself.

Enable Twilio Voice calling permissions for the countries whose numbers users can verify. The backend submits Twilio's Outgoing Caller ID validation request; Twilio calls the submitted number and sends its result to the callback URL supplied with that request. No separate callback URL registration in the Twilio console is needed. `PUBLIC_BASE_URL` must resolve publicly over HTTPS so Twilio can reach:

`https://<your-backend-origin>/api/v1/callerid/callback?token=<per-attempt-token>`

The callback URL is generated per attempt and includes an unguessable correlation token. Do not put Twilio credentials or validation codes in the mobile app or client-visible configuration. A missing required setting returns `caller_id_configuration_error` with missing setting **names only**; provider failures return a separate safe code and actionable message.

Set `NODE_ENV=production` in production. The developer test mode is disabled there regardless of its environment values.

## Local/test workflow

Run the backend with a non-production `NODE_ENV`, such as `development`, and set these values in the backend environment only:

```dotenv
CALLER_ID_DEV_TEST_MODE=true
CALLER_ID_DEV_TEST_NUMBERS=+15555550100
```

Replace the sample with a reserved/non-routable E.164 fixture used only in an isolated local/test database. Sign in to the app, open **Settings → Your Caller ID → Verify**, and submit that exact allowlisted number. The server associates the synthetic test state with the authenticated account; there is no client-supplied verification result. No provider call is made. The server records the `developer_test` method separately and does not store the fixture as a real `verifiedCallerId`; outbound calls continue to use the configured Twilio-owned `TWILIO_CALLER_ID`, never that synthetic number.

This mode is unsuitable for proving real ownership or testing live caller-ID presentation. For provider integration tests, omit both developer test settings and configure the real Twilio values above. Keep test accounts/database isolated from production.

## Lifecycle and controls

The persisted lifecycle is `unverified` → `pending` → `verified`, with `failed` and `expired` terminal attempt states. A retry starts a new provider attempt; cancel invalidates its callback token, so a late callback cannot verify the number. Starting a new verification clears the previous active caller ID. Authenticated status/start/cancel endpoints are owner-scoped and rate-limited. Twilio callbacks require Twilio signature validation, a one-time per-attempt token, the exact pending number, and an unexpired attempt.

At call setup the backend uses a caller ID only when it is persisted as verified by Twilio (legacy verified records remain supported). Unverified, failed, expired, pending, and synthetic developer-test IDs use the Twilio-owned fallback number. Client state is never authoritative for outbound calls.
