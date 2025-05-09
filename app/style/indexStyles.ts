import {
  StyleSheet,
  Platform,
  StatusBar,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from "react-native";

// --- Color Palette ---
const colors = {
  primary: "#0275d8",
  primaryDark: "#025aa5", // For hover or darker shades
  secondary: "#6c757d",
  success: "#28a745",
  danger: "#dc3545",

  background: "#f5f5f5",
  surface: "#fff", // For cards, modals
  backgroundModalOverlay: "rgba(0, 0, 0, 0.5)",

  textPrimary: "#212529", // For darkest text, can also be used for shadows
  textSecondary: "#333",
  textMuted: "#6c757d", // Also used for subtitle, some info text
  textLight: "#fff", // Text on dark backgrounds
  textPlaceholder: "#999", // For footer or less important text
  textLink: "#0275d8", // Same as primary

  border: "#ddd", // A general border color if needed
  borderLight: "#e0e0e0",
  borderLighter: "#eee",
};

// --- Base Styles ---
const baseButton: ViewStyle = {
  borderRadius: 8,
  paddingVertical: 14,
  alignItems: "center",
  flexDirection: "row",
  justifyContent: "center",
};

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
  marginHorizontal: 16, // Common margin
  elevation: 2,
  shadowColor: colors.textPrimary, // Using textPrimary for shadow
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

const styles = StyleSheet.create({
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
    fontSize: 40, // Override base
    color: colors.primary,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  sessionContainer: {
    ...baseCard,
    // margin: 16, // Already in baseCard via marginHorizontal, adjust if vertical needed
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
    color: colors.textMuted, // Was #666
    marginLeft: 8,
  },
  continueButton: {
    ...baseButton,
    backgroundColor: colors.success,
  },
  startButton: {
    ...baseButton,
    backgroundColor: colors.success,
    paddingVertical: 16, // Override base
    marginHorizontal: 16,
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
    padding: 14, // Keep specific padding if different from base
  },
  historyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary,
    borderRadius: 12, // Softer radius
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
    color: colors.primary, // Or textLink
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
    borderRadius: 12, // Override base
    padding: 16, // Override base
    marginTop: 24,
    marginBottom: 16, // Specific margin
    shadowOpacity: 0.1, // Override base
    shadowRadius: 3, // Override base
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
    color: colors.primary, // Or textLink
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
    color: colors.textMuted, // Was #666
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: colors.textSecondary,
  },
  footer: {
    textAlign: "center",
    color: colors.textPlaceholder, // Was #999
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
    color: colors.textSecondary, // Added a default color
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  modalButton: {
    ...baseButton, // Apply base button style
    padding: 10, // Override base
    marginHorizontal: 5,
    minWidth: 120,
  },
  buttonConfirm: {
    // Specific modal button style
    backgroundColor: colors.danger, // This is for the 'confirm delete' case
  },
  buttonCancel: {
    // Specific modal button style
    backgroundColor: colors.secondary,
  },
  textStyle: {
    // For modal button text
    color: colors.textLight,
    fontWeight: "bold",
    textAlign: "center",
  },
  iconContainer: {
    marginRight: 8,
  },
  userPreferencesButton: {
    position: "absolute",
    bottom: 16,
    right: 16,
    padding: 12,
    borderRadius: 30, // Circular
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
    marginBottom: -1, // Fine-tuning position
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
  } as ImageStyle, // Assuming it's for Lottie or similar
});

export default styles;
