import React from "react";
import TestRenderer from "react-test-renderer";
import { actCreate } from "../../../test-utils/render";

const mockUseLegacyHistoryImport = jest.fn();

jest.mock("react-native", () => {
  const ReactNative = jest.requireActual("react-native");
  const React = jest.requireActual("react");

  return new Proxy(ReactNative, {
    get(target, prop, receiver) {
      if (prop === "Modal") {
        const MockModal = ({ visible, children }: any) => {
          if (!visible) {
            return null;
          }

          return React.createElement(ReactNative.View, null, children);
        };

        MockModal.displayName = "MockModal";

        return MockModal;
      }

      if (prop === "FlatList") {
        const MockFlatList = ({ data, renderItem, keyExtractor }: any) =>
          React.createElement(
            ReactNative.View,
            null,
            data.map((item: any, index: number) =>
              React.createElement(
                React.Fragment,
                {
                  key: keyExtractor ? keyExtractor(item, index) : `${index}`,
                },
                renderItem({ item, index }),
              ),
            ),
          );

        MockFlatList.displayName = "MockFlatList";

        return MockFlatList;
      }

      return Reflect.get(target, prop, receiver);
    },
  });
});

jest.mock("../../../app/style/theme", () => ({
  useColors: () => ({
    primary: "#007AFF",
    secondary: "#6C757D",
    success: "#34C759",
    warning: "#FF9500",
    danger: "#FF3B30",
    textPrimary: "#111111",
    textSecondary: "#555555",
    textLight: "#FFFFFF",
    textMuted: "#888888",
    surface: "#FFFFFF",
    background: "#F5F5F5",
    backgroundSubtle: "#EFEFEF",
    borderSubtle: "#DDDDDD",
  }),
}));

jest.mock("../../../app/style/userPreferencesStyles", () => ({
  createUserPreferencesStyles: () => ({
    legacyHistoryImportStyles: {
      description: {},
      summaryRow: {},
      summaryLabel: {},
      summaryValue: {},
      statusPanel: {},
      statusText: {},
      statusTextSuccess: {},
      statusTextError: {},
      warningText: {},
      resultSummaryRow: {},
      resultSummaryLabel: {},
      resultSummaryValue: {},
      buttonContainer: {},
      modalSafeArea: {},
      modalHeader: {},
      modalHeaderTitle: {},
      modalCloseButton: {},
      modalContent: {},
      modalDescription: {},
      claimantOptionRow: {},
      claimantOptionRowDisabled: {},
      claimantOptionContent: {},
      claimantOptionName: {},
      claimantOptionMeta: {},
      claimantOptionWarning: {},
      modalEmptyState: {},
      modalEmptyTitle: {},
      modalEmptyMessage: {},
    },
  }),
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: () => null,
}));

jest.mock("../../../hooks/useLegacyHistoryImport", () => ({
  useLegacyHistoryImport: () => mockUseLegacyHistoryImport(),
}));

jest.mock("../../../components/ui", () => ({
  ShellSection: ({ children, title, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");

    return R.createElement(
      RN.View,
      { testID: "ShellSection", ...props },
      title ? R.createElement(RN.Text, null, title) : null,
      children,
    );
  },
  ShellCard: ({ children, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");

    return R.createElement(
      RN.View,
      { testID: "ShellCard", ...props },
      children,
    );
  },
  ShellActionButton: ({ label, onPress, disabled, testID, ...props }: any) => {
    const RN = require("react-native");
    const R = require("react");

    return R.createElement(
      RN.TouchableOpacity,
      { onPress, disabled, testID, ...props },
      label ? R.createElement(RN.Text, null, label) : null,
    );
  },
}));

describe("LegacyHistoryImport Settings UI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the empty-history state and keeps the action disabled", () => {
    mockUseLegacyHistoryImport.mockReturnValue({
      claimantOptions: [],
      historySessionCount: 0,
      hasLocalHistory: false,
      isConfigured: true,
      isAuthenticated: true,
      authChecked: true,
      isImporting: false,
      importPhase: "ready",
      canStartImport: false,
      canRetryImport: false,
      availabilityReason: "No local history saved on this device yet.",
      importError: null,
      importResult: null,
      importHistory: jest.fn(),
    });

    const LegacyHistoryImportSection =
      require("../../../components/preferences/LegacyHistoryImportSection").default;

    const renderer = actCreate(
      React.createElement(LegacyHistoryImportSection),
    );

    const { Text } = require("react-native");
    const textContents = renderer.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children);
    const action = renderer.root.findByProps({
      testID: "LegacyHistoryImportButton",
    });

    expect(textContents).toContain("History Import");
    expect(textContents).toContain(
      "No local history saved on this device yet.",
    );
    expect(action.props.disabled).toBe(true);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("renders the in-progress state", () => {
    mockUseLegacyHistoryImport.mockReturnValue({
      claimantOptions: [
        {
          id: "alex-session-a",
          name: "Alex Example",
          normalizedName: "alex example",
          sessionIds: ["session-a"],
          sessionCount: 1,
          sourceParticipantIds: ["alex-session-a"],
          sessionParticipantIds: { "session-a": ["alex-session-a"] },
          ambiguousSessionIds: [],
        },
      ],
      historySessionCount: 1,
      hasLocalHistory: true,
      isConfigured: true,
      isAuthenticated: true,
      authChecked: true,
      isImporting: true,
      importPhase: "importing",
      canStartImport: false,
      canRetryImport: false,
      availabilityReason: null,
      importError: null,
      importResult: null,
      importHistory: jest.fn(),
    });

    const LegacyHistoryImportSection =
      require("../../../components/preferences/LegacyHistoryImportSection").default;

    const renderer = actCreate(
      React.createElement(LegacyHistoryImportSection),
    );

    const { Text } = require("react-native");
    const textContents = renderer.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children);
    const action = renderer.root.findByProps({
      testID: "LegacyHistoryImportButton",
    });

    expect(textContents).toContain("Importing...");
    expect(action.props.disabled).toBe(true);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("starts the import after the user selects a claimant", async () => {
    const importHistory = jest.fn().mockResolvedValue(null);
    const claimant = {
      id: "alex-session-a",
      name: "Alex Example",
      normalizedName: "alex example",
      sessionIds: ["session-a", "session-b"],
      sessionCount: 2,
      sourceParticipantIds: ["alex-session-a", "alex-session-b"],
      sessionParticipantIds: {
        "session-a": ["alex-session-a"],
        "session-b": ["alex-session-b"],
      },
      ambiguousSessionIds: [],
    };

    mockUseLegacyHistoryImport.mockReturnValue({
      claimantOptions: [claimant],
      historySessionCount: 2,
      hasLocalHistory: true,
      isConfigured: true,
      isAuthenticated: true,
      authChecked: true,
      isImporting: false,
      importPhase: "ready",
      canStartImport: true,
      canRetryImport: false,
      availabilityReason: null,
      importError: null,
      importResult: null,
      importHistory,
    });

    const LegacyHistoryImportSection =
      require("../../../components/preferences/LegacyHistoryImportSection").default;

    const renderer = actCreate(
      React.createElement(LegacyHistoryImportSection),
    );

    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({ testID: "LegacyHistoryImportButton" })
        .props.onPress();
    });

    await TestRenderer.act(async () => {
      renderer.root
        .findByProps({ testID: "LegacyHistoryClaimantOption-alex-session-a" })
        .props.onPress();
    });

    expect(importHistory).toHaveBeenCalledWith(claimant);

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("renders the completed state and disables the action", () => {
    mockUseLegacyHistoryImport.mockReturnValue({
      claimantOptions: [
        {
          id: "alex-session-a",
          name: "Alex Example",
          normalizedName: "alex example",
          sessionIds: ["session-a"],
          sessionCount: 1,
          sourceParticipantIds: ["alex-session-a"],
          sessionParticipantIds: { "session-a": ["alex-session-a"] },
          ambiguousSessionIds: [],
        },
      ],
      historySessionCount: 1,
      hasLocalHistory: true,
      isConfigured: true,
      isAuthenticated: true,
      authChecked: true,
      isImporting: false,
      importPhase: "completed",
      canStartImport: false,
      canRetryImport: false,
      availabilityReason: null,
      importError: null,
      importResult: {
        importState: "completed",
        summary: {
          importedCount: 1,
          skippedCount: 0,
          failedCount: 0,
        },
        sessions: [],
      },
      importHistory: jest.fn(),
    });

    const LegacyHistoryImportSection =
      require("../../../components/preferences/LegacyHistoryImportSection").default;

    const renderer = actCreate(
      React.createElement(LegacyHistoryImportSection),
    );

    const { Text } = require("react-native");
    const textContents = renderer.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children);
    const action = renderer.root.findByProps({
      testID: "LegacyHistoryImportButton",
    });

    expect(textContents).toContain(
      "Import completed successfully. Imported 1, skipped 0, failed 0.",
    );
    expect(textContents).toContain("Imported");
    expect(action.props.disabled).toBe(true);
    expect(action.props.label).toBe("Import Complete");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("renders the retry state after a failed import", () => {
    mockUseLegacyHistoryImport.mockReturnValue({
      claimantOptions: [
        {
          id: "alex-session-a",
          name: "Alex Example",
          normalizedName: "alex example",
          sessionIds: ["session-a"],
          sessionCount: 1,
          sourceParticipantIds: ["alex-session-a"],
          sessionParticipantIds: { "session-a": ["alex-session-a"] },
          ambiguousSessionIds: [],
        },
      ],
      historySessionCount: 1,
      hasLocalHistory: true,
      isConfigured: true,
      isAuthenticated: true,
      authChecked: true,
      isImporting: false,
      importPhase: "failed",
      canStartImport: true,
      canRetryImport: true,
      availabilityReason: null,
      importError: null,
      importResult: {
        importState: "failed",
        summary: {
          importedCount: 0,
          skippedCount: 0,
          failedCount: 1,
        },
        sessions: [],
      },
      importHistory: jest.fn(),
    });

    const LegacyHistoryImportSection =
      require("../../../components/preferences/LegacyHistoryImportSection").default;

    const renderer = actCreate(
      React.createElement(LegacyHistoryImportSection),
    );

    const { Text } = require("react-native");
    const textContents = renderer.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children);
    const action = renderer.root.findByProps({
      testID: "LegacyHistoryImportButton",
    });

    expect(textContents).toContain(
      "Import finished with failures. Imported 0, skipped 0, failed 1. Retry the claimant selection to try again.",
    );
    expect(action.props.disabled).toBe(false);
    expect(action.props.label).toBe("Retry Import");

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("shows ambiguous claimant guardrails in the claimant modal", () => {
    const LegacyHistoryImportClaimantModal =
      require("../../../components/preferences/LegacyHistoryImportClaimantModal").default;

    const renderer = actCreate(
      React.createElement(LegacyHistoryImportClaimantModal, {
        visible: true,
        isImporting: false,
        onClose: jest.fn(),
        onSelectClaimant: jest.fn(),
        claimantOptions: [
          {
            id: "chris-session-a",
            name: "Chris",
            normalizedName: "chris",
            sessionIds: ["session-a"],
            sessionCount: 1,
            sourceParticipantIds: ["chris-session-a", "chris-session-b"],
            sessionParticipantIds: {
              "session-a": ["chris-session-a", "chris-session-b"],
            },
            ambiguousSessionIds: ["session-a"],
          },
        ],
      }),
    );

    const option = renderer.root.findByProps({
      testID: "LegacyHistoryClaimantOption-chris-session-a",
    });
    const { Text } = require("react-native");
    const textContents = renderer.root
      .findAllByType(Text)
      .flatMap((node: any) => node.props.children);

    expect(option.props.disabled).toBe(true);
    expect(textContents).toContain(
      "Unavailable: duplicate name in 1 saved session.",
    );

    TestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
