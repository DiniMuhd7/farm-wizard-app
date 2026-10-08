# Making 9tel phones ring (incoming calls)

A phone can only be rung by Twilio Voice through a **push notification** —
Firebase Cloud Messaging on Android, Apple VoIP push on iOS. The app registers
the phone for that push using its access token, and the token must carry the
SID of a **Twilio Push Credential** for the platform. If it doesn't, registration
fails, Twilio has nowhere to deliver the call, and the callee sees nothing.

## One-time setup

### Android (FCM)
1. Firebase Console → Project settings → Service accounts → **Generate new
   private key** (FCM v1). The project is the one `google-services.json` belongs to.
2. Twilio Console → Voice → Manage → **Push credentials** → Create new
   credential → type **FCM**, upload that service-account JSON.
3. Copy the credential SID (`CR…`) into the backend env as
   `TWILIO_PUSH_CREDENTIAL_SID_ANDROID`.

### iOS (APNs VoIP)
1. Apple Developer → Keys (or Certificates) → create an **APNs** key/cert and
   a **VoIP Services** certificate for the app's bundle id.
2. Twilio Console → Push credentials → type **APN**, upload it. Tick *Sandbox*
   for development builds, leave unticked for TestFlight/App Store builds.
3. Put the SID in `TWILIO_PUSH_CREDENTIAL_SID_IOS`.

Redeploy the backend after setting the variables. Each phone re-registers the
next time the app is opened (it also re-registers whenever the app returns to
the foreground).

## Checking it works
- `GET /api/v1/voice/token?platform=android` (or `ios`) returns
  `"pushConfigured": true`. If it is `false`, or the server log prints
  *"Voice token issued WITHOUT a push credential"*, the variable is missing.
- Call the account from another 9tel account. It should ring, and a missed
  call appears under Recents if it isn't answered.

## Known risk — Android with expo-notifications
Android delivers a push to a single `FirebaseMessagingService`. This app also
ships `expo-notifications` and `@react-native-firebase/app`, which declare
their own. If, after the credential is configured, calls ring while the app is
open but not when it is closed, the Twilio invite is being swallowed by the
other service and the app needs a small config plugin that forwards Twilio's
messages to the Voice SDK. Test this on a real device with the app swiped away.
