const fs = require("node:fs");
const path = require("node:path");
const staticExpo = require("./app.json").expo;

// Load only the native map key from an optional project-root .env file.
// Gemini keys belong only in server/.env and are never exposed to Expo.
const rootEnvPath = path.join(__dirname, ".env");
if (fs.existsSync(rootEnvPath)) {
  for (const line of fs.readFileSync(rootEnvPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*GOOGLE_MAPS_API_KEY\s*=\s*(.*?)\s*$/);
    if (match && !process.env.GOOGLE_MAPS_API_KEY) {
      process.env.GOOGLE_MAPS_API_KEY = match[1].replace(/^['"]|['"]$/g, "");
    }
  }
}

module.exports = ({ config }) => {
  const current = config || staticExpo;
  const mapKey = process.env.GOOGLE_MAPS_API_KEY || "";
  const plugins = (current.plugins || staticExpo.plugins || []).filter((entry) =>
    entry !== "react-native-maps" && !(Array.isArray(entry) && entry[0] === "react-native-maps")
  );
  plugins.push(["react-native-maps", mapKey ? { androidGoogleMapsApiKey: mapKey } : {}]);
  return {
    ...staticExpo,
    ...current,
    plugins,
    android: {
      ...(staticExpo.android || {}),
      ...(current.android || {}),
      package: (current.android && current.android.package) || "com.nhom4.smartwaste",
    },
  };
};
