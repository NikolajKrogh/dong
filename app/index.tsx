import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useGameStore } from "./store";
import { Ionicons } from "@expo/vector-icons";
import styles from "./style/indexStyles";
import { StatusBar } from "expo-status-bar";

interface Player {
  name: string;
  drinksTaken?: number;
}

interface Game {
  players: Player[];
}

const HomeScreen = () => {
  const router = useRouter();
  const { players, matches, history, resetState } = useGameStore();
  const [isConfirmModalVisible, setIsConfirmModalVisible] = useState(false);

  const hasGameInProgress = players.length > 0 && matches.length > 0;

  const handleCancelGame = () => {
    resetState();
    setIsConfirmModalVisible(false);
  };

  // Helper functions to calculate stats
  const getTotalDrinks = (gameHistory: Game[]) => {
    return gameHistory.reduce(
      (sum, game) =>
        sum +
        game.players.reduce(
          (gameSum: number, player: Player) => gameSum + (player.drinksTaken || 0),
          0
        ),
      0
    );
  };

  const getTopDrinker = (gameHistory: Game[]) => {
    const playerDrinks = new Map<string, number>();

    gameHistory.forEach((game) => {
      game.players.forEach((player) => {
        const current = playerDrinks.get(player.name) || 0;
        playerDrinks.set(player.name, current + (player.drinksTaken || 0));
      });
    });

    let topPlayer = "";
    let maxDrinks = 0;

    playerDrinks.forEach((drinks, name) => {
      if (drinks > maxDrinks) {
        maxDrinks = drinks;
        topPlayer = name;
      }
    });
    return topPlayer ? `${topPlayer} (${maxDrinks.toFixed(1)})` : "None";
  };

  return (
    <>
      <StatusBar
        style="dark"
        backgroundColor={styles.safeArea.backgroundColor}
      />
      <View style={[styles.safeArea, { paddingTop: 22 }]}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>DONG</Text>
          <Text style={styles.subtitle}>Drink ON Goal</Text>
        </View>

        {hasGameInProgress ? (
          <View style={styles.sessionContainer}>
            <Text style={styles.sessionTitle}>Current Game in Progress</Text>
            <View style={styles.sessionInfoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="people" size={22} color="#0275d8" />
                <Text style={styles.infoText}>{players.length} Players</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="football" size={22} color="#0275d8" />
                <Text style={styles.infoText}>{matches.length} Matches</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => router.push("/gameProgress")}
            >
              <Ionicons name="play" size={22} color="#fff" />
              <Text style={styles.buttonText}>Continue Game</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setIsConfirmModalVisible(true)}
            >
              <Ionicons name="close-circle-outline" size={22} color="#fff" />
              <Text style={styles.buttonText}>Cancel Game</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => router.push("/setupGame")}
          >
            <Ionicons name="add-circle" size={22} color="#fff" />
            <Text style={styles.buttonText}>Start New Game</Text>
          </TouchableOpacity>
        )}

        {/*
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.setupButton}
            onPress={() => router.push("/setupGame")}
          >
            <Ionicons name="settings-outline" size={20} color="#fff" />
            <Text style={styles.smallButtonText}>Setup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => router.push("/history")}
          >
            <Ionicons name="time-outline" size={20} color="#fff" />
            <Text style={styles.smallButtonText}>History</Text>
          </TouchableOpacity>
        </View>
        */}

        {history.length > 0 && (
          <View style={styles.statsContainer}>
            <Text style={styles.statsTitle}>Game Stats</Text>
            <View style={styles.statsContent}>
              {/* Total games played */}
              <View style={styles.statItem}>
                <View style={styles.iconContainer}>
                  <Ionicons name="calendar" size={20} color="#0275d8" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statLabel}>Games Played</Text>
                  <Text style={styles.statValue}>{history.length}</Text>
                </View>
              </View>

              {/* Top drinker */}
              {history.length > 0 && (
                <View style={styles.statItem}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="trophy" size={20} color="#0275d8" />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statLabel}>Top Drinker</Text>
                    <Text style={styles.statValue}>{getTopDrinker(history)}</Text>
                  </View>
                </View>
              )}

              {/* Total drinks consumed */}
              <View style={styles.statItem}>
                <View style={styles.iconContainer}>
                  <Ionicons name="beer" size={20} color="#0275d8" />
                </View>
                <View style={styles.statTextContainer}>
                  <Text style={styles.statLabel}>Total Drinks</Text>
                  <Text style={styles.statValue}>{getTotalDrinks(history).toFixed(1)}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.footer}>The perfect drinking game for football fans</Text>

        <Modal
          animationType="fade"
          transparent={true}
          visible={isConfirmModalVisible}
          onRequestClose={() => setIsConfirmModalVisible(false)}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Cancel Game</Text>
              <Text style={styles.modalText}>
                Are you sure you want to cancel the current game? This action cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonCancel]}
                  onPress={() => setIsConfirmModalVisible(false)}
                >
                  <Text style={styles.textStyle}>No, Keep Game</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonConfirm]}
                  onPress={handleCancelGame}
                >
                  <Text style={styles.textStyle}>Yes, Cancel Game</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
};

export default HomeScreen;