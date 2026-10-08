# Android installation builds

Use the `apk` (or `preview`) build profile when sharing a file that someone
will install directly on an Android device:

```bash
eas build --platform android --profile apk
```

This profile explicitly produces a single, signed `.apk`. Do **not** try to
install an `.aab` file directly; Android App Bundles must be uploaded to Play
Console (or converted to device-specific APKs with bundletool) before they can
be installed.

The production profile intentionally produces an App Bundle for Play Store
submission. Every direct-install release must increase Android's `versionCode`.
The app is currently configured with `versionCode` 24.

## Before building Twilio Voice

Install the dependencies and use an EAS/development build rather than Expo Go:

```bash
npm install
eas build --platform android --profile apk
```

Set the Twilio values in the backend deployment environment only. Never put
the Twilio Auth Token or API Key Secret in `app.json`, an EAS public variable,
or the mobile client.
