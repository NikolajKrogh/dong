import AsyncStorage from "@react-native-async-storage/async-storage";
import uuid from "react-native-uuid";

/**
 * AsyncStorage key used to persist the device/session ID.
 */
const DEVICE_ID_KEY = "deviceId";

/**
 * Get or generate a persistent device/session ID.
 * This ID is used to uniquely identify a player across app sessions.
 * If no ID exists, generates a new UUID and stores it in AsyncStorage.
 * Falls back to a timestamp-based ID if storage fails.
 * @returns {Promise<string>} The device/session ID
 */
export async function getDeviceId(): Promise<string> {
  try {
    let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = uuid.v4() as string;
      await AsyncStorage.setItem(DEVICE_ID_KEY, id);
      console.log("Generated new device ID:", id);
    }
    return id;
  } catch (error) {
    console.error("Error getting/setting device ID:", error);
    // Fallback to timestamp-based ID if AsyncStorage fails
    return `device-${Date.now()}`;
  }
}

/**
 * Clear the stored device ID from AsyncStorage.
 * Useful for testing or resetting the app identity.
 * @returns {Promise<void>}
 */
export async function clearDeviceId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
    console.log("Device ID cleared");
  } catch (error) {
    console.error("Error clearing device ID:", error);
  }
}
