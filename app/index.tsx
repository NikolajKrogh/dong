import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  ScrollView,
  Animated,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import createStyles from "./style/indexStyles";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import LottieView from "lottie-react-native";
import OnboardingScreen from "../components/OnboardingScreen";
import { useColors } from "./style/theme";
import useHomeScreenLogic from "../hooks/useHomeScreenLogic";

/**
 * HomeScreen component.
 * @description Main landing screen: shows logo, game-in-progress actions,
 * aggregate stats, onboarding on first launch,
 * and splash animation (once per session).
 * @returns {React.ReactElement} Home screen UI.
 */
const HomeScreen = () => {
  const colors = useColors();
  const styles = createStyles(colors);
  const splashAnimation = React.useRef<LottieView>(null);
  const {
    isSplashVisible,
    fadeAnim,
    isFirstLaunch,
    hasGameInProgress,
    playersCount,
    matchesCount,
    historyCount,
    topDrinkerInfo,
    totalDrinks,
    isConfirmModalVisible,
    openConfirmModal,
    closeConfirmModal,
    handleCancelGame,
    isJoinModalVisible,
    openJoinModal,
    closeJoinModal,
    isCreateModalVisible,
    closeCreateModal,
    isCreatingRoom,
    playerNameInput,
    onPlayerNameChange,
    roomCodeInput,
    onRoomCodeChange,
    handleCreateGameButtonPress,
    handleCreateGame,
    handleJoinGame,
    navigateToGameProgress,
    navigateToHistory,
    navigateToUserPreferences,
    handleFirstLaunchComplete,
  } = useHomeScreenLogic();

  if (isSplashVisible) {
    return (
      <Animated.View style={[styles.splashContainer, { opacity: fadeAnim }]}>
        <LottieView
          ref={splashAnimation}
          source={require("../assets/lottie/dong_logo_animation.json")}
          autoPlay
          loop={false}
          style={styles.splashAnimation}
        />
      </Animated.View>
    );
  }

  if (isFirstLaunch) {
    return <OnboardingScreen onFinish={handleFirstLaunchComplete} />;
  }

  return (
    <>
      <StatusBar
        style={colors.background === colors.background ? "dark" : "light"}
        backgroundColor={styles.safeArea.backgroundColor as string}
      />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContainer}>
            <Image
              source={require("../assets/icons/logo_png/dong_logo.png")}
              style={styles.logo}
            />
          </View>

          {hasGameInProgress ? (
            <View style={styles.sessionContainer}>
              <Text style={styles.sessionTitle}>Current Game in Progress</Text>
              <View style={styles.sessionInfoRow}>
                <View style={styles.infoItem}>
                  <Ionicons name="people" size={22} color={colors.primary} />
                  <Text style={styles.infoText}>{playersCount} Players</Text>
                </View>
                <View style={styles.infoItem}>
                  <Ionicons name="football" size={22} color={colors.primary} />
                  <Text style={styles.infoText}>{matchesCount} Matches</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.continueButton}
                onPress={navigateToGameProgress}
              >
                <Ionicons name="play" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Continue Game</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={openConfirmModal}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={22}
                  color={colors.white}
                />
                <Text style={styles.buttonText}>Cancel Game</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.createGameButton}
                onPress={handleCreateGameButtonPress}
                disabled={isCreatingRoom}
              >
                {isCreatingRoom ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons
                      name="add-circle"
                      size={22}
                      color={colors.white}
                    />
                    <Text style={styles.buttonText}>Create New Game</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.joinGameButton}
                onPress={openJoinModal}
                disabled={isCreatingRoom}
              >
                <Ionicons name="enter-outline" size={22} color={colors.white} />
                <Text style={styles.buttonText}>Join Game</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Stats Container */}
          {historyCount > 0 && (
            <TouchableOpacity
              style={styles.statsContainer}
              onPress={navigateToHistory}
              activeOpacity={0.9}
            >
              <View style={styles.statsHeader}>
                <View style={styles.titleWithIcon}>
                  <Text style={styles.statsTitle}>Game Stats</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.primary}
                    style={styles.titleChevron}
                  />
                </View>
              </View>

              <View style={styles.statsContent}>
                {/* Games Played */}
                <View style={styles.statItem}>
                  <View style={styles.iconContainer}>
                    <Ionicons
                      name="calendar"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statLabel}>Games Played</Text>
                    <Text style={styles.statValue}>{historyCount}</Text>
                  </View>
                </View>

                {/* Top Drinker */}
                {topDrinkerInfo && (
                  <View style={styles.statItem}>
                    <View style={styles.iconContainer}>
                      <Ionicons
                        name="trophy"
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <View style={styles.statTextContainer}>
                      <Text style={styles.statLabel}>Top Drinker</Text>
                      <Text style={styles.statValue}>{`${
                        topDrinkerInfo.name
                      } (${topDrinkerInfo.drinks.toFixed(1)})`}</Text>
                    </View>
                  </View>
                )}

                {/* Total Drinks */}
                <View style={styles.statItem}>
                  <View style={styles.iconContainer}>
                    <Ionicons name="beer" size={20} color={colors.primary} />
                  </View>
                  <View style={styles.statTextContainer}>
                    <Text style={styles.statLabel}>Total Drinks</Text>
                    <Text style={styles.statValue}>
                      {totalDrinks.toFixed(1)}
                    </Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.userPreferencesButton}
            onPress={navigateToUserPreferences}
          >
            <Ionicons
              name="person-circle-outline"
              size={28}
              color={colors.white}
            />
          </TouchableOpacity>
        </ScrollView>

        <Modal
          animationType="fade"
          transparent={true}
          visible={isConfirmModalVisible}
          onRequestClose={closeConfirmModal}
        >
          <View style={styles.centeredView}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Cancel Game</Text>
              <Text style={styles.modalText}>
                Are you sure you want to cancel the current game? This action
                cannot be undone.
              </Text>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.buttonCancel]}
                  onPress={closeConfirmModal}
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

        {/* Join Room Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isJoinModalVisible}
          onRequestClose={() => {
            closeJoinModal();
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.roomModalContainer}>
              <Text style={styles.roomModalTitle}>Join Game</Text>
              <Text style={styles.roomModalSubtitle}>
                Enter the room code to join your friends
              </Text>

              <Text style={styles.roomInputLabel}>Your Name</Text>
              <TextInput
                style={styles.roomInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textPlaceholder}
                value={playerNameInput}
                onChangeText={onPlayerNameChange}
                editable={!isCreatingRoom}
                autoCapitalize="words"
              />

              <Text style={styles.roomInputLabel}>Room Code</Text>
              <TextInput
                style={styles.roomCodeInput}
                placeholder="ABC123"
                placeholderTextColor={colors.textPlaceholder}
                value={roomCodeInput}
                onChangeText={onRoomCodeChange}
                editable={!isCreatingRoom}
                maxLength={6}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              {isCreatingRoom ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Joining room...</Text>
                </View>
              ) : (
                <View style={styles.roomModalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonSecondary,
                    ]}
                    onPress={closeJoinModal}
                  >
                    <Text style={styles.textStyle}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonSuccess,
                    ]}
                    onPress={handleJoinGame}
                  >
                    <Ionicons
                      name="enter-outline"
                      size={20}
                      color={colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.textStyle}>Join</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* Create Room Modal */}
        <Modal
          animationType="fade"
          transparent={true}
          visible={isCreateModalVisible}
          onRequestClose={() => {
            closeCreateModal();
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.roomModalContainer}>
              <Text style={styles.roomModalTitle}>Create New Game</Text>
              <Text style={styles.roomModalSubtitle}>
                Enter your name to start a new game
              </Text>

              <Text style={styles.roomInputLabel}>Your Name</Text>
              <TextInput
                style={styles.roomInput}
                placeholder="Enter your name"
                placeholderTextColor={colors.textPlaceholder}
                value={playerNameInput}
                onChangeText={onPlayerNameChange}
                editable={!isCreatingRoom}
                autoCapitalize="words"
                autoFocus={true}
              />

              {isCreatingRoom ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>Creating room...</Text>
                </View>
              ) : (
                <View style={styles.roomModalButtons}>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonSecondary,
                    ]}
                    onPress={closeCreateModal}
                  >
                    <Text style={styles.textStyle}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.roomModalButton,
                      styles.roomModalButtonPrimary,
                    ]}
                    onPress={handleCreateGame}
                  >
                    <Ionicons
                      name="add-circle"
                      size={20}
                      color={colors.white}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.textStyle}>Create</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </>
  );
};

export default HomeScreen;
