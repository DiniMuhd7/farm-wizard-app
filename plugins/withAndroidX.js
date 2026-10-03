const { withGradleProperties } = require("@expo/config-plugins");

// react-native-twilio-video-webrtc still declares Android support-library
// artifacts. Jetifier translates those artifacts to AndroidX during Gradle
// resolution; without it, support-compat and androidx.core define the same
// android.support.v4 classes and Android's duplicate-class task fails.
module.exports = function withAndroidX(config) {
  return withGradleProperties(config, (configWithProperties) => {
    const properties = configWithProperties.modResults;
    for (const [key, value] of [["android.useAndroidX", "true"], ["android.enableJetifier", "true"]]) {
      const existing = properties.find((property) => property.type === "property" && property.key === key);
      if (existing) existing.value = value;
      else properties.push({ type: "property", key, value });
    }
    return configWithProperties;
  });
};
