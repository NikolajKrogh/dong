import { useGameStore } from "../../store/store";

describe("active game context persistence boundary", () => {
  afterEach(() => {
    useGameStore.getState().clearActiveGameContext();
  });

  it("stores registered multiplayer identity and sequence fence", () => {
    useGameStore.getState().setActiveGameContext({
      mode: "multiplayer",
      sessionId: "session-1",
      participantId: "participant-1",
      accessKind: "registered",
      lastAppliedSequence: 12,
    });

    expect(useGameStore.getState().activeGameContext).toEqual({
      mode: "multiplayer",
      sessionId: "session-1",
      participantId: "participant-1",
      accessKind: "registered",
      lastAppliedSequence: 12,
    });
  });

  it("clears room identity without touching gameplay preferences", () => {
    useGameStore.getState().setTheme("dark");
    useGameStore.getState().setActiveGameContext({
      mode: "multiplayer",
      sessionId: "session-1",
      accessKind: "guest",
    });
    useGameStore.getState().clearActiveGameContext();

    expect(useGameStore.getState().activeGameContext).toEqual({
      mode: "solo",
      sessionId: null,
      participantId: null,
      accessKind: null,
      lastAppliedSequence: 0,
    });
    expect(useGameStore.getState().theme).toBe("dark");
  });
});

