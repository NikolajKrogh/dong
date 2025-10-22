/**
 * Room Test Screen
 *
 * Test screen for Gun.js room functionality
 * Add this to your app navigation to test room creation/joining
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { CreateRoomComponent } from "../components/room/CreateRoomComponent";
import { JoinRoomComponent } from "../components/room/JoinRoomComponent";
import { RoomDisplayComponent } from "../components/room/RoomDisplayComponent";
import { useGameStore } from "../store/store";

type ViewMode = "menu" | "create" | "join" | "room";

export default function RoomTestScreen() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("menu");
  const { currentRoom, _hasHydrated, roomConnectionStatus } = useGameStore();

  // If already in a room, show room display
  if (currentRoom && viewMode === "menu") {
    setViewMode("room");
  }

  // Hydration/online status indicator
  const getHydrationStatus = () => {
    if (_hasHydrated) return "✅ Hydrated";
    return "⏳ Hydrating...";
  };
  const getOnlineStatus = () => {
    switch (roomConnectionStatus) {
      case "connected":
        return "🟢 Online";
      case "connecting":
        return "🟡 Connecting";
      default:
        return "⚪ Offline";
    }
  };

  const renderContent = () => {
    switch (viewMode) {
      case "create":
        return (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
              <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>
            <CreateRoomComponent
              onRoomCreated={() => setViewMode("room")}
              onCancel={() => setViewMode("menu")}
            />
          </>
        );

      case "join":
        return (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
              <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>
            <JoinRoomComponent
              onRoomJoined={() => setViewMode("room")}
              onCancel={() => setViewMode("menu")}
            />
          </>
        );

      case "room":
        return (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
              <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>
            <RoomDisplayComponent onLeaveRoom={() => setViewMode("menu")} />
          </>
        );

      default:
        return (
          <View style={styles.menuContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
              <Text style={styles.backButtonText}>Back to Home</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Gun.js Room Test</Text>
            <Text style={styles.subtitle}>
              Test multiplayer room functionality
            </Text>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.createButton]}
                onPress={() => setViewMode("create")}
              >
                <Text style={styles.buttonText}>🎮 Create Room</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.joinButton]}
                onPress={() => setViewMode("join")}
              >
                <Text style={styles.buttonText}>🚪 Join Room</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>How to Test:</Text>
              <Text style={styles.infoText}>
                1. Create a room on one device
              </Text>
              <Text style={styles.infoText}>2. Share the room code</Text>
              <Text style={styles.infoText}>3. Join from another device</Text>
              <Text style={styles.infoText}>
                4. Watch players sync in real-time!
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      {/* Hydration/Online Status Indicator */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
          marginTop: 8,
        }}
      >
        <Text style={{ fontSize: 14 }}>{getHydrationStatus()}</Text>
        <Text style={{ fontSize: 14 }}>{getOnlineStatus()}</Text>
      </View>
      <View style={styles.backButtonContainer}>
        <TouchableOpacity
          style={styles.backButtonFixed}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={28} color="#FFFFFF" />
          <Text style={styles.backButtonTextFixed}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.contentContainer}
      >
        {renderContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContainer: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  menuContainer: {
    alignItems: "center",
  },
  backButtonContainer: {
    backgroundColor: "#2196F3",
    padding: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#1976D2",
  },
  backButtonFixed: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonTextFixed: {
    fontSize: 18,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    padding: 12,
    marginBottom: 20,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 8,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    gap: 16,
    marginBottom: 40,
  },
  button: {
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButton: {
    backgroundColor: "#2196F3",
  },
  joinButton: {
    backgroundColor: "#4CAF50",
  },
  buttonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  infoBox: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    width: "100%",
    borderLeftWidth: 4,
    borderLeftColor: "#2196F3",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
    color: "#333",
  },
  infoText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
    paddingLeft: 8,
  },
});
