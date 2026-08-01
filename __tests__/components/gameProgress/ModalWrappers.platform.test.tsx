/**
 * Regression guard for the game screen's two modals.
 *
 * Both used to wrap their <Modal> in a <SafeAreaView style={{flex:0}}>. A Modal
 * renders into its own root, so that wrapper gave the modal nothing — but it was
 * still a laid-out sibling of the screen's content, and
 * react-native-safe-area-context's SafeAreaView applies real inset padding on
 * Android (react-native's own is a bare View there, which is why the wrapper was
 * harmless until the import was corrected). The empty box consumed
 * top+bottom insets — 68dp on the test device — shrinking the game screen, which
 * clipped the match list and pushed the footer off-screen.
 *
 * The assertion is structural rather than visual: no SafeAreaView may appear
 * outside the Modal. Layout itself is not measurable under Jest.
 */
import React from "react";

import { actCreate } from "../../../test-utils/render";

import EndGameModal from "../../../components/gameProgress/EndGameModal";
import MatchQuickActionsModal from "../../../components/gameProgress/MatchQuickActionsModal";

jest.mock("react-native-safe-area-context", () => {
  const actual = jest.requireActual("react-native-safe-area-context");

  return {
    ...actual,
    // Any render of a SafeAreaView from within these components is the defect.
    SafeAreaView: () => {
      throw new Error(
        "A modal on the game screen rendered a SafeAreaView; it consumes screen insets as a layout sibling.",
      );
    },
  };
});

describe("game screen modals", () => {
  it("renders EndGameModal without a SafeAreaView wrapper", () => {
    expect(() =>
      actCreate(
        <EndGameModal isVisible={false} onCancel={jest.fn()} onConfirm={jest.fn()} />,
      ),
    ).not.toThrow();
  });

  it("renders MatchQuickActionsModal without a SafeAreaView wrapper", () => {
    expect(() =>
      actCreate(
        <MatchQuickActionsModal
          isVisible={false}
          onClose={jest.fn()}
          selectedMatchId={null}
          matches={[]}
          players={[]}
          commonMatchId={null}
          playerAssignments={{}}
          handleGoalIncrement={jest.fn()}
          handleGoalDecrement={jest.fn()}
          liveMatches={[]}
        />,
      ),
    ).not.toThrow();
  });
});
