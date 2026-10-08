# Caller-ID verification (spoken code + app entry)

## Flow

1. The signed-in user submits an E.164 number to `POST /api/v1/callerid/start`.
2. The backend creates a server-side, one-time session: a random 6-digit code (`crypto.randomInt`), a random session id (also the correlation id), a 5-minute expiry and an attempt counter. Only a keyed HMAC of the code (bound to user, session and number, key `JWT_SECRET`) is stored — never the code.
3. The backend asks Twilio to place a call (`calls.create`) from `TWILIO_CALLER_ID` whose TwiML **speaks** the code twice. The old keypad/DTMF IVR (`validationRequests`) is gone, so there is no entry loop.
4. The user types the code into the 9tel app, which sends `POST /api/v1/callerid/verify { code }`.
5. The backend validates it against the authenticated user's active session and flips the account to `verified` with a compare-and-set update, so a session can be consumed exactly once.

## Security model

- **Code secrecy.** The code exists only in the TwiML sent to Twilio and on the call; it is not returned by any endpoint, not displayed in the app, and not logged by the app, analytics or the backend. (Twilio retains call resources per its own retention settings — treat the Twilio account as trusted.)
- **Ownership.** All endpoints require auth (`protect`); sessions live on the authenticated user's record, so one user cannot submit against another's session. A number already verified on another account is refused (`caller_id_in_use`), also enforced by the unique index on `verifiedCallerId`.
- **Limits.** 5-minute expiry; max 5 guesses per session, counted atomically *before* comparison (parallel guesses cannot exceed it); the session is failed on exhaustion; 30-second server-side resend cooldown that cancel-and-restart cannot bypass; per-IP and per-user route rate limits on `start` (3/min/user), `verify` (10/min/user), `status`, `cancel`.
- **Replay/concurrency.** Completion filters on `status=pending`, session id, number and unexpired; of any number of concurrent or repeated submissions one succeeds, the rest get `409 no_active_verification`. A used code cannot be reused.
- **Provider honesty.** If Twilio rejects the call, the session is persisted as `failed` and a safe error is returned. Twilio's signed `POST /api/v1/callerid/call-status` callback can only mark the matching pending session `failed` when the call is `failed`/`busy`/`no-answer`/`canceled`; it never verifies anything.
- **Correlation.** Responses carry `correlationId` (and `X-Correlation-ID`); logs use the same id. It is not secret and reveals nothing about the code.
- **Outbound identity.** Spoken-code verification proves possession to 9tel but does **not** make the number provider-approved. Outbound calls therefore keep using the Twilio-owned `TWILIO_CALLER_ID` unless the number was approved by Twilio (legacy `twilio` method). Verification is never required to place calls. Verified numbers still unlock the introductory carrier-call reward.

Lifecycle: `unverified` → `pending` → `verified`, with `failed` and `expired` terminal attempt states. Error codes from `/verify`: `invalid_code_format` (400), `incorrect_code` (400, with `attemptsRemaining`), `verification_expired` (410), `too_many_attempts` (429), `no_active_verification` (409), `caller_id_in_use` (409).

## Production setup

Backend environment (for example Render → `ninetel-backend-api` → Environment):

1. `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` — server-side only.
2. `TWILIO_CALLER_ID` — an E.164 number owned by the Twilio account. **Now required for verification**: it is the `from` of the code call (and the outbound fallback identity).
3. `PUBLIC_BASE_URL` — public HTTPS origin, no trailing slash, exactly the externally visible host (used for Twilio signature validation). Twilio must reach `https://<origin>/api/v1/callerid/call-status?session=<id>`; no console registration is needed, the URL is supplied per call.
4. `JWT_SECRET` — also keys the code HMAC.
5. `NODE_ENV=production` (disables developer test mode).

Enable Twilio Voice geo-permissions for the countries whose numbers users verify. A missing setting returns `caller_id_configuration_error` with setting **names only**.

Deployment note: this release replaces `callerIdVerificationTokenHash` with new session fields and removes `POST /api/v1/callerid/callback`. Attempts pending at deploy time simply expire (5 minutes); no data migration is required. Deploy the backend before the app build.

## Local/test workflow

Run the backend with a non-production `NODE_ENV`, such as `development`, and set these values in the backend environment only:

```dotenv
CALLER_ID_DEV_TEST_MODE=true
CALLER_ID_DEV_TEST_NUMBERS=+15555550100
```

Replace the sample with a reserved/non-routable E.164 fixture used only in an isolated local/test database. Sign in to the app, open **Settings → Your Caller ID → Verify**, and submit that exact allowlisted number. The server associates the synthetic test state with the authenticated account; there is no client-supplied verification result. No provider call is made. The server records the `developer_test` method separately and does not store the fixture as a real `verifiedCallerId`; outbound calls continue to use the configured Twilio-owned `TWILIO_CALLER_ID`, never that synthetic number.

This mode is unsuitable for proving real ownership or testing live caller-ID presentation. For provider integration tests, omit both developer test settings and configure the real Twilio values above. Keep test accounts/database isolated from production.

## Local/test note

The developer test mode above never creates a session or places a call.
