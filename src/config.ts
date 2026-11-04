import { Platform } from "react-native";
/**
 * Set EXPO_PUBLIC_API_URL in the project-root .env file.
 * Web default: localhost. Physical Android/iOS: set the computer's LAN IPv4 address.
 * Android emulator commonly uses 10.0.2.2.
 */
const defaultUrl = Platform.OS === "web" ? "http://localhost:3000" : "http://192.168.1.5:3000";
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || defaultUrl).replace(/\/$/, "");
export const APP_NAME = "EcoSort";
