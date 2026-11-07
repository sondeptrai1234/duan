const {
  withGradleProperties,
  withProjectBuildGradle,
  withAppBuildGradle,
  withAndroidManifest,
} = require("expo/config-plugins");

function setGradleProperty(properties, key, value) {
  const existingIndex = properties.findIndex(
    (item) => item.type === "property" && item.key === key
  );
  const prop = { type: "property", key, value: String(value) };
  if (existingIndex >= 0) {
    properties[existingIndex] = prop;
  } else {
    properties.push(prop);
  }
}

module.exports = function withAndroidFixes(config) {
  // 1. Configure gradle.properties for SDK 37 (Expo 58 standard) + targetSdk 34 (Android 14 stable)
  // and fast ARM-only builds for real Android devices
  config = withGradleProperties(config, (mod) => {
    const props = mod.modResults;
    setGradleProperty(props, "android.compileSdkVersion", "37");
    setGradleProperty(props, "android.targetSdkVersion", "34");
    setGradleProperty(props, "android.buildToolsVersion", "37.0.0");
    setGradleProperty(props, "android.minSdkVersion", "24");
    setGradleProperty(props, "reactNativeArchitectures", "armeabi-v7a,arm64-v8a");
    setGradleProperty(props, "expo.useLegacyPackaging", "true");
    setGradleProperty(props, "android.enableMinifyInReleaseBuilds", "false");
    return mod;
  });

  // 2. Ensure rootProject.ext defines matching SDK versions and bypass strict AAR metadata check
  config = withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language === "groovy") {
      const extBlock = `
ext {
    buildToolsVersion = "37.0.0"
    minSdkVersion = 24
    compileSdkVersion = 37
    targetSdkVersion = 34
}
`;
      if (!mod.modResults.contents.includes("compileSdkVersion = 37")) {
        mod.modResults.contents = mod.modResults.contents.replace(
          'apply plugin: "expo-root-project"',
          `${extBlock}\napply plugin: "expo-root-project"`
        );
      }
    }
    return mod;
  });

  // 3. Enable both v1 (JAR) and v2 (Full APK) signing
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language === "groovy") {
      if (!mod.modResults.contents.includes("v1SigningEnabled true")) {
        mod.modResults.contents = mod.modResults.contents.replace(
          "keyPassword 'android'",
          "keyPassword 'android'\n            v1SigningEnabled true\n            v2SigningEnabled true"
        );
      }
    }
    return mod;
  });

  // 4. Clean up AndroidManifest.xml (remove preview assetsPaths flag & allow cleartext HTTP traffic)
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app) {
      app.$["android:usesCleartextTraffic"] = "true";
      app.$["android:extractNativeLibs"] = "true";
      if (Array.isArray(app.activity)) {
        for (const activity of app.activity) {
          const configChanges = activity.$?.["android:configChanges"];
          if (typeof configChanges === "string" && configChanges.includes("assetsPaths")) {
            activity.$["android:configChanges"] = configChanges
              .split("|")
              .filter((flag) => flag !== "assetsPaths")
              .join("|");
          }
        }
      }
    }
    return mod;
  });

  return config;
};
