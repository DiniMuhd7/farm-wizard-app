# Android Play signing

Google Play rejects Android App Bundles when the upload key used by EAS does not match the app's registered upload certificate.

For this app, Play Console expects the Android upload certificate SHA-1 fingerprint to be:

```text
89:CF:6C:ED:29:AF:7A:3E:BF:59:05:1C:D5:EE:6A:07:3D:0A:48:CC
```

The rejected bundle was signed with:

```text
D8:EA:8E:EF:B2:68:1A:2F:A5:CD:C3:99:A0:3B:A6:F5:5F:90:C7:89
```

Before building a production bundle, update the EAS Android credentials for `com.grow.farmwizard` so the configured upload keystore has the expected SHA-1 fingerprint above:

```sh
eas credentials -p android
```

Choose the production build profile/application, remove or replace the incorrect Android Keystore, and upload the correct keystore registered in Play Console. Then build with:

```sh
eas build --platform android --profile production --clear-cache
```

The production EAS profile is configured to use remote credentials so production builds use the Play upload key stored in EAS rather than an accidental local debug or stale keystore.
