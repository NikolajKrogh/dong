import React from "react";
import TestRenderer from "react-test-renderer";

import { actCreate } from "../../test-utils/render";

const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 1,
  fontScale: 1,
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
let mockPreviousRoute: { name: string; params?: Record<string, string> } | undefined;
let mockParams: Record<string, string | string[]> = {};

const mockStoreState = {
  players: [{ id: "p1", name: "Alice" }],
  matches: [
    {
      id: "m1",
      homeTeam: "Arsenal",
      awayTeam: "Chelsea",
      homeGoals: 0,
      awayGoals: 0,
    },
  ],
  commonMatchId: "m1",
  playerAssignments: { p1: ["m1"] },
  matchesPerPlayer: 2,
  setPlayers: jest.fn(),
  setMatches: jest.fn(),
  setCommonMatchId: jest.fn(),
  setPlayerAssignments: jest.fn(),
  setMatchesPerPlayer: jest.fn(),
};

jest.mock("react-native", () => ({
  Platform: {
    OS: "web",
    select: (o: Record<string, unknown>) => o.web ?? o.default,
  },
  View: "View",
  Text: "Text",
  useWindowDimensions: () => mockUseWindowDimensions(),
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, setParams: mockReplace, back: mockBack, canGoBack: () => !!mockPreviousRoute }),
  useNavigation: () => ({ getState: () => ({ index: mockPreviousRoute ? 1 : 0, routes: mockPreviousRoute ? [mockPreviousRoute, { name: "setupGame" }] : [{ name: "setupGame" }] }) }),
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]),
  useNavigationContainerRef: () => ({isReady:()=>true,addListener:()=>()=>{}}),
}));

jest.mock("../../store/store", () => ({
  useGameStore: () => mockStoreState,
}));

jest.mock("../../styles/theme", () => ({
  useColors: () => ({ background: "#fff" }),
}));

jest.mock("../../styles/setupGameStyles", () => ({
  __esModule: true,
  default: () => ({
    safeArea: {},
  }),
}));

jest.mock("../../components/ui", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  return {
    ShellScreen: ({ children, ...props }: any) =>
      ReactLocal.createElement(
        ReactNativeLocal.View,
        { testID: "ShellScreen", ...props },
        children,
      ),
  };
});

jest.mock("../../components", () => {
  const ReactLocal = require("react");
  const ReactNativeLocal = require("react-native");

  const makeComponent = (testID: string) => (props: any) =>
    ReactLocal.createElement(ReactNativeLocal.View, { testID, ...props });

  return {
    SetupGamePlayerList: makeComponent("SetupGamePlayerList"),
    MatchList: makeComponent("MatchList"),
    AssignmentSection: makeComponent("AssignmentSection"),
    CommonMatchSelector: makeComponent("CommonMatchSelector"),
    SetupWizard: makeComponent("SetupWizard"),
  };
});

const renderSetupGameScreen = () => {
  const SetupGameScreen = require("../../app/setupGame").default;

  return actCreate(React.createElement(SetupGameScreen));
};

describe("SetupGameScreen responsive layout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 1,
      fontScale: 1,
    });
  });

  it("wires setup state into the route wizard", () => {
    const renderer = renderSetupGameScreen();
    const wizard = renderer.root.findByProps({ testID: "SetupWizard" });

    const byKey = Object.fromEntries(
      wizard.props.steps.map((s: { key: string }) => [s.key, s]),
    );

    // The solo flow's four steps, in order, all reachable with this state.
    expect(wizard.props.steps.map((s: { key: string }) => s.key)).toEqual([
      "players",
      "matches",
      "common",
      "assign",
    ]);
    expect(byKey.matches.canEnter).toBe(true);
    expect(byKey.common.canEnter).toBe(true);
    expect(byKey.assign.canEnter).toBe(true);
    expect(wizard.props.finalAction.disabled).toBe(false);

    expect(byKey.players.content.props.players).toEqual(mockStoreState.players);
    expect(byKey.matches.content.props.matches).toEqual(mockStoreState.matches);
    expect(byKey.common.content.props.selectedCommonMatch).toBe(
      mockStoreState.commonMatchId,
    );
    expect(byKey.assign.content.props.playerAssignments).toEqual(
      mockStoreState.playerAssignments,
    );
  });

  it("keeps the shared shell unconstrained on phone-sized viewports", () => {
    const renderer = renderSetupGameScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(false);
    expect(shell.props.contentMaxWidth).toBeUndefined();
  });

  it("centers the shared shell on desktop-wide viewports", () => {
    mockUseWindowDimensions.mockReturnValue({
      width: 1280,
      height: 900,
      scale: 1,
      fontScale: 1,
    });

    const renderer = renderSetupGameScreen();
    const shell = renderer.root.findByProps({ testID: "ShellScreen" });

    expect(shell.props.centerContent).toBe(true);
    expect(shell.props.contentMaxWidth).toBe(1120);
  });
});


describe('solo route restoration', () => {
 beforeEach(()=>{jest.clearAllMocks();mockParams={};mockPreviousRoute=undefined;});
 it('pops an owned preceding step on Back without pushing a forward entry', () => {
  mockParams={step:'common'};mockPreviousRoute={name:'setupGame',params:{step:'matches'}};
  const tree=renderSetupGameScreen();
  TestRenderer.act(()=>tree.root.findByProps({testID:'SetupWizard'}).props.onStepBack('matches'));
  expect(mockBack).toHaveBeenCalledTimes(1);expect(mockPush).not.toHaveBeenCalled();
  mockPreviousRoute=undefined;
  TestRenderer.act(()=>tree.root.findByProps({testID:'SetupWizard'}).props.onStepBack('matches'));
  expect(mockReplace).toHaveBeenLastCalledWith({step:'matches'});expect(mockBack).toHaveBeenCalledTimes(1);
  TestRenderer.act(()=>tree.unmount());
 });
 it('restores a valid requested key and pushes only changed step choices', () => {
  mockParams={step:'assign'};const tree=renderSetupGameScreen();
  expect(tree.root.findByProps({testID:'SetupWizard'}).props.activeStepKey).toBe('assign');
  TestRenderer.act(()=>tree.root.findByProps({testID:'SetupWizard'}).props.onStepChange('assign'));expect(mockPush).not.toHaveBeenCalled();
  TestRenderer.act(()=>tree.root.findByProps({testID:'SetupWizard'}).props.onStepChange('common'));expect(mockPush).toHaveBeenCalledWith({pathname:'/setupGame',params:{step:'common'}});
 });
 it('waits for hydration before resolving missing prerequisites', () => {
  const store=require('../../store/store').useGameStore;
  let hydrated=false;let finish!:()=>void;
  store.persist={hasHydrated:()=>hydrated,onFinishHydration:(callback:()=>void)=>{finish=callback;return ()=>{};}};
  const oldPlayers=mockStoreState.players;mockStoreState.players=[];mockParams={step:'assign'};
  try {
   const tree=renderSetupGameScreen();expect(tree.root.findAllByProps({testID:'SetupWizard'})).toHaveLength(0);expect(mockReplace).not.toHaveBeenCalled();
   TestRenderer.act(()=>{hydrated=true;finish();});
   expect(tree.root.findByProps({testID:'SetupWizard'}).props.activeStepKey).toBe('players');expect(mockReplace).toHaveBeenCalledWith({step:undefined});
  } finally {mockStoreState.players=oldPlayers;delete store.persist;}
 });
});
