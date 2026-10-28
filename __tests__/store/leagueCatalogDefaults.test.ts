import { applySyncedPreferenceState, hydrateSyncedPreferenceState, useGameStore } from "../../store/gameStore";
import { LEAGUE_ENDPOINTS, DEFAULT_SELECTED_LEAGUES } from "../../constants/leagues";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("bundled league defaults", () => {
  beforeEach(() => useGameStore.setState(hydrateSyncedPreferenceState(undefined)));

  it("makes the existing defaults available immediately without a catalog read", () => {
    expect(useGameStore.getState().configuredLeagues.map(item => item.code)).toEqual([
      "eng.1", "eng.2", "ger.1", "esp.1", "ita.1", "fra.1", "den.1",
    ]);
    expect(useGameStore.getState().defaultSelectedLeagues.map(item => item.code)).toEqual(["eng.1", "eng.2"]);
  });

  it("preserves intentionally empty preferences from persisted installations", async () => {
    await AsyncStorage.setItem("dong-storage", JSON.stringify({ state: { configuredLeagues: [], defaultSelectedLeagues: [] }, version: 0 }));
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().configuredLeagues).toEqual([]);
    expect(useGameStore.getState().defaultSelectedLeagues).toEqual([]);
  });

  it("resets only league preferences to the bundled defaults", () => {
    useGameStore.getState().setConfiguredLeagues([]);
    useGameStore.getState().setDefaultSelectedLeagues([]);
    useGameStore.getState().setTheme("dark");
    useGameStore.getState().resetLeaguesToDefaults();
    expect(useGameStore.getState().configuredLeagues).toEqual(LEAGUE_ENDPOINTS);
    expect(useGameStore.getState().defaultSelectedLeagues).toEqual(DEFAULT_SELECTED_LEAGUES);
    expect(useGameStore.getState().theme).toBe("dark");
  });

  it("restores account selections without replacing them with defaults", () => {
    applySyncedPreferenceState({ configuredLeagues: [{ code: "custom.1", name: "Saved league" }], defaultSelectedLeagues: [] });
    expect(useGameStore.getState().configuredLeagues).toEqual([{ code: "custom.1", name: "Saved league" }]);
    expect(useGameStore.getState().defaultSelectedLeagues).toEqual([]);
  });
});
