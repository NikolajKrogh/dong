import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGameStore } from "../../store/gameStore";

describe("per-player additional match targets", () => {
  beforeEach(() => {
    useGameStore.getState().resetState();
    useGameStore.setState({ history: [] });
    useGameStore.getState().setPlayers([{ id: "a", name: "Alex", drinksTaken: 0 }, { id: "b", name: "Alex", drinksTaken: 0 }]);
  });
  it("keeps overrides by identity and preserves explicit zero across default changes", () => {
    useGameStore.getState().setPlayerMatchCount("a", 0);
    useGameStore.getState().setMatchesPerPlayer(3);
    expect(useGameStore.getState().playerMatchCounts).toEqual({ a: 0 });
    useGameStore.getState().setPlayerMatchCount("a", null);
    expect(useGameStore.getState().playerMatchCounts).toEqual({});
    expect(useGameStore.getState().matchesPerPlayer).toBe(3);
  });
  it.each([-1, 1.5, 101, NaN])("rejects invalid input %s without mutating counts", (count) => {
    expect(() => useGameStore.getState().setPlayerMatchCount("a", count)).toThrow();
    expect(() => useGameStore.getState().setMatchesPerPlayer(count)).toThrow();
    expect(useGameStore.getState().playerMatchCounts).toEqual({});
  });
  it("rejects an unknown player and prunes a removed player's override", () => {
    expect(() => useGameStore.getState().setPlayerMatchCount("unknown", 1)).toThrow();
    useGameStore.getState().setPlayerMatchCount("a", 1);
    useGameStore.getState().setPlayers((players) => players.filter(({ id }) => id !== "a"));
    expect(useGameStore.getState().playerMatchCounts).toEqual({});
  });
  it("persists targets and captures them with history without rewriting assignments", async () => {
    useGameStore.getState().setPlayerMatchCount("a", 0);
    useGameStore.getState().setPlayerAssignments({ a: ["common"], b: ["common", "extra"] });
    useGameStore.getState().saveGameToHistory();
    const saved = useGameStore.getState().history[0];
    expect(saved.playerMatchCounts).toEqual({ a: 0 });
    expect(saved.assignmentPolicyVersion).toBe(2);
    useGameStore.getState().setPlayerMatchCount("a", 2);
    expect(saved.playerMatchCounts).toEqual({ a: 0 });
    const persisted = JSON.parse((await AsyncStorage.getItem("dong-storage"))!);
    expect(persisted.state.playerMatchCounts).toEqual({ a: 2 });
    expect(saved.playerAssignments.a).toEqual(["common"]);
  });
  it("hydrates legacy active games with version1 and keeps their assignments", async () => {
    const assignments = { a: ["common", "extra"] };
    await AsyncStorage.setItem("dong-storage", JSON.stringify({ version: 0, state: { players: [{ id: "a", name: "Alex", drinksTaken: 0 }], playerAssignments: assignments, matchesPerPlayer: 150 } }));
    await useGameStore.persist.rehydrate();
    expect(useGameStore.getState().assignmentPolicyVersion).toBe(1);
    expect(useGameStore.getState().matchesPerPlayer).toBe(150);
    expect(useGameStore.getState().playerAssignments).toEqual(assignments);
    expect(useGameStore.getState().playerMatchCounts).toEqual({});
  });
  it("resets new-game targets and version without clearing history/preferences", () => {
    useGameStore.getState().setPlayerMatchCount("a", 0);
    useGameStore.getState().saveGameToHistory();
    useGameStore.getState().setTheme("dark");
    useGameStore.getState().resetState();
    expect(useGameStore.getState().playerMatchCounts).toEqual({});
    expect(useGameStore.getState().assignmentPolicyVersion).toBe(2);
    expect(useGameStore.getState().history).toHaveLength(1);
    expect(useGameStore.getState().theme).toBe("dark");
  });
});
