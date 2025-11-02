import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from "react-native";
import type { lightColors as Light, darkColors as Dark } from "./theme";
type Colors = typeof Light | typeof Dark;
// --- Color Palette ---

// --- Base Styles ---
const baseButtonCommon: ViewStyle = {
  borderRadius: 8,
  paddingVertical: 14,
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "center",
};
export default function createStyles(colors: Colors) {
  const baseButton = { ...baseButtonCommon } as ViewStyle;
  const baseButtonText: TextStyle = {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  };
  const baseCard: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 20,
    marginHorizontal: 16,
    elevation: 2,
    shadowColor: colors.textPrimary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  };
  const baseTitle: TextStyle = {
    fontSize: 20,
    fontWeight: "bold",
    color: colors.textSecondary,
  };
  const baseModalView: ViewStyle = {
    margin: 20,
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    shadowColor: colors.textPrimary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  };

  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerContainer: {
      alignItems: "center",
      paddingVertical: 12,
      backgroundColor: colors.background,
      marginBottom: 12,
    },
    title: {
      ...baseTitle,
      fontSize: 40,
      color: colors.primary,
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
    },
    sessionContainer: {
      ...baseCard,
      marginTop: 16,
      marginBottom: 16,
    },
    sessionTitle: {
      ...baseTitle,
      marginBottom: 12,
    },
    sessionInfoRow: {
      flexDirection: "row",
      marginBottom: 16,
      justifyContent: "space-around",
    },
    infoItem: {
      flexDirection: "row",
      alignItems: "center",
    },
    infoText: {
      fontSize: 16,
      color: colors.textMuted,
      marginLeft: 8,
    },
    continueButton: {
      ...baseButton,
      backgroundColor: colors.success,
    },
    startButton: {
      ...baseButton,
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      marginTop: 16,
    },
    createGameButton: {
      ...baseButton,
      backgroundColor: colors.primary,
      marginHorizontal: 16,
      marginTop: 16,
      paddingVertical: 18,
    },
    joinGameButton: {
      ...baseButton,
      backgroundColor: colors.success,
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 18,
    },
    buttonIcon: {
      marginRight: 10,
    },
    buttonText: {
      ...baseButtonText,
    },
    buttonRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      marginTop: 16,
      gap: 16,
    },
    setupButton: {
      ...baseButton,
      flex: 1,
      backgroundColor: colors.primary,
      padding: 14,
    },
    historyButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.primary,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 16,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    historyButtonContent: {
      flexDirection: "row",
      alignItems: "center",
      padding: 14,
    },
    historyButtonText: {
      color: colors.textLight,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 10,
    },
    historyButtonArrow: {
      paddingRight: 14,
    },
    subtleHistoryButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderRadius: 12,
      marginHorizontal: 16,
      marginTop: 16,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.borderLight,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    subtleHistoryButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: "600",
      marginLeft: 10,
    },
    scrollContainer: {
      flexGrow: 1,
      paddingBottom: 30,
    },
    smallButtonText: {
      color: colors.textLight,
      fontWeight: "600",
      fontSize: 16,
      marginLeft: 8,
    },
    statsContainer: {
      ...baseCard,
      borderRadius: 12,
      padding: 16,
      marginTop: 24,
      marginBottom: 16,
      shadowOpacity: 0.1,
      shadowRadius: 3,
    },
    statsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    viewMoreIndicator: {
      flexDirection: "row",
      alignItems: "center",
    },
    viewMoreText: {
      fontSize: 14,
      color: colors.primary,
      marginRight: 4,
    },
    statsTitle: {
      ...baseTitle,
      marginBottom: 0,
    },
    statsContent: {
      padding: 8,
    },
    statItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLighter,
    },
    statTextContainer: {
      marginLeft: 12,
    },
    statLabel: {
      fontSize: 14,
      color: colors.textMuted,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "bold",
      color: colors.textSecondary,
    },
    footer: {
      textAlign: "center",
      color: colors.textPlaceholder,
      fontSize: 12,
      position: "absolute",
      bottom: 16,
      alignSelf: "center",
    },
    cancelButton: {
      ...baseButton,
      backgroundColor: colors.danger,
      marginTop: 12,
    },
    centeredView: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.backgroundModalOverlay,
    },
    modalView: {
      ...baseModalView,
    },
    modalTitle: {
      ...baseTitle,
      marginBottom: 15,
      textAlign: "center",
    },
    modalText: {
      marginBottom: 15,
      textAlign: "center",
      color: colors.textSecondary,
    },
    modalButtons: {
      flexDirection: "row",
      justifyContent: "space-around",
      width: "100%",
    },
    modalButton: {
      ...baseButton,
      padding: 10,
      marginHorizontal: 5,
      minWidth: 120,
    },
    buttonConfirm: {
      backgroundColor: colors.danger,
    },
    buttonCancel: {
      backgroundColor: colors.secondary,
    },
    textStyle: {
      color: colors.textLight,
      fontWeight: "bold",
      textAlign: "center",
    },
    // Room Modal Styles
    roomModalContainer: {
      ...baseModalView,
      width: "90%",
      maxWidth: 400,
      paddingBottom: 20,
    },
    roomModalTitle: {
      ...baseTitle,
      fontSize: 24,
      marginBottom: 8,
      textAlign: "center",
    },
    roomModalSubtitle: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      marginBottom: 24,
    },
    roomInputLabel: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 8,
      marginTop: 12,
    },
    roomInput: {
      height: 50,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundLight,
      color: colors.textSecondary,
      fontSize: 16,
      marginBottom: 8,
    },
    roomCodeInput: {
      height: 50,
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 8,
      paddingHorizontal: 16,
      backgroundColor: colors.backgroundLight,
      color: colors.textSecondary,
      fontSize: 20,
      fontWeight: "bold",
      textAlign: "center",
      letterSpacing: 4,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    roomModalButtons: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 20,
      gap: 12,
    },
    roomModalButton: {
      ...baseButton,
      flex: 1,
      paddingVertical: 14,
    },
    roomModalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    roomModalButtonSecondary: {
      backgroundColor: colors.secondary,
    },
    roomModalButtonSuccess: {
      backgroundColor: colors.success,
    },
    roomCodeDisplay: {
      backgroundColor: colors.primaryLight,
      padding: 20,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.primary,
      alignItems: "center",
      marginVertical: 20,
    },
    roomCodeText: {
      fontSize: 36,
      fontWeight: "bold",
      color: colors.primary,
      letterSpacing: 6,
      marginBottom: 8,
    },
    roomCodeLabel: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: "uppercase",
      marginBottom: 4,
    },
    roomCodeHint: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: "center",
      marginTop: 8,
    },
    loadingContainer: {
      padding: 20,
      alignItems: "center",
    },
    loadingText: {
      marginTop: 12,
      fontSize: 14,
      color: colors.textMuted,
    },
    iconContainer: {
      marginRight: 8,
    },
    userPreferencesButton: {
      position: "absolute",
      bottom: 16,
      right: 16,
      padding: 12,
      borderRadius: 30,
      backgroundColor: colors.primary,
      shadowColor: colors.textPrimary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      zIndex: 10,
    },
    userPreferencesButtonHover: {
      backgroundColor: colors.primaryDark,
    },
    logo: {
      width: 512,
      height: 120,
      resizeMode: "contain",
      marginBottom: 8,
    } as ImageStyle,
    titleWithIcon: {
      flexDirection: "row",
      alignItems: "center",
    },
    titleChevron: {
      marginLeft: 6,
      marginBottom: -1,
    },
    splashContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.surface,
    },
    splashAnimation: {
      width: 400,
      height: 400,
    } as ViewStyle,
  });
}
