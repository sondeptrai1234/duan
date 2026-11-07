import { Platform } from "react-native";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";

/**
 * Automatically resolves the computer's LAN IP address from Metro bundler host,
 * so physical devices connect seamlessly without manual IP editing.
 */
const getHostIp = () => {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") return ip;
  }
  return "10.235.74.79";
};

export const DEFAULT_API_URL = (
  process.env.EXPO_PUBLIC_API_URL ||
  (Platform.OS === "web" ? "http://localhost:3000" : `http://${getHostIp()}:3000`)
).replace(/\/$/, "");

export const APP_NAME = "Nhom4";

let _activeApiUrl = DEFAULT_API_URL;
let _activeRaspiUrl = "http://192.168.4.1:8000";
let _isConfigLoaded = false;

const CONFIG_FILE = `${FileSystem.documentDirectory || ""}app_network_config.json`;

export function getApiUrl(): string {
  return _activeApiUrl;
}

export function getRaspiUrl(): string {
  return _activeRaspiUrl;
}

export async function loadSavedNetworkConfig(): Promise<{ apiUrl: string; raspiUrl: string }> {
  if (_isConfigLoaded) return { apiUrl: _activeApiUrl, raspiUrl: _activeRaspiUrl };
  try {
    if (FileSystem.documentDirectory) {
      const info = await FileSystem.getInfoAsync(CONFIG_FILE);
      if (info.exists) {
        const text = await FileSystem.readAsStringAsync(CONFIG_FILE);
        const parsed = JSON.parse(text);
        if (parsed.apiUrl && typeof parsed.apiUrl === "string") {
          _activeApiUrl = parsed.apiUrl.trim().replace(/\/$/, "");
          API_URL = _activeApiUrl;
        }
        if (parsed.raspiUrl && typeof parsed.raspiUrl === "string") {
          _activeRaspiUrl = parsed.raspiUrl.trim().replace(/\/$/, "");
        }
      }
    }
  } catch (err) {
    console.warn("Could not load network config:", err);
  } finally {
    _isConfigLoaded = true;
  }
  return { apiUrl: _activeApiUrl, raspiUrl: _activeRaspiUrl };
}

export async function saveNetworkConfig(apiUrl: string, raspiUrl?: string): Promise<{ apiUrl: string; raspiUrl: string }> {
  const cleanApi = apiUrl.trim().replace(/\/$/, "");
  const cleanRaspi = (raspiUrl || _activeRaspiUrl).trim().replace(/\/$/, "");
  _activeApiUrl = cleanApi;
  _activeRaspiUrl = cleanRaspi;
  API_URL = cleanApi;
  try {
    if (FileSystem.documentDirectory) {
      await FileSystem.writeAsStringAsync(
        CONFIG_FILE,
        JSON.stringify({ apiUrl: cleanApi, raspiUrl: cleanRaspi, updatedAt: new Date().toISOString() })
      );
    }
  } catch (err) {
    console.warn("Could not write network config:", err);
  }
  return { apiUrl: _activeApiUrl, raspiUrl: _activeRaspiUrl };
}

export async function resetNetworkConfig(): Promise<string> {
  _activeApiUrl = DEFAULT_API_URL;
  _activeRaspiUrl = "http://192.168.4.1:8000";
  API_URL = DEFAULT_API_URL;
  try {
    if (FileSystem.documentDirectory) {
      await FileSystem.deleteAsync(CONFIG_FILE, { idempotent: true });
    }
  } catch (err) {
    console.warn("Could not delete network config file:", err);
  }
  return _activeApiUrl;
}

// Export mutable API_URL for backward compatibility
export let API_URL = DEFAULT_API_URL;
