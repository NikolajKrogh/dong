import React from "react";
import TestRenderer from "react-test-renderer";
import SelectDefaultLeaguesModal from "../../../features/preferences/SelectDefaultLeaguesModal";
import { actCreate } from "../../../test-utils/render";

jest.mock("../../../platform/navigation/taskNavigation", () => ({
  TaskOverlay: ({ open, onClose, children }: any) => children({
    open, dismiss: onClose, runAfterDismiss: (action: () => void) => { onClose(); action(); },
  }),
}));
jest.mock("../../../features/football-matches/useLeagueLogo", () => ({ useLeagueLogo: () => ({ logoSource: null, isLoading: false }) }));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));

it("uses one scoped dismissal for header and system close without saving on cancel", () => {
  const onClose = jest.fn();
  const onSave = jest.fn();
  const renderer = actCreate(<SelectDefaultLeaguesModal visible onClose={onClose}
    onSave={onSave} configuredLeagues={[]} currentDefaultLeagues={[]} />);
  TestRenderer.act(() => renderer.root.findByProps({ accessibilityLabel: "Close default leagues" }).props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
  TestRenderer.act(() => renderer.unmount());
});
