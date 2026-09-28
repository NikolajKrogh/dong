import {
  calculateLifetimePlayerStats,
  findPlayerByIdentityKey,
  formatHistoryDate,
  formatModalDate,
  getPlayerHeadToHeadStats,
  getPlayerIdentityKey,
} from "../../components/history/historyUtils";
import type { GameSession, Player } from "../../components/history/historyTypes";

const buildSession = (
  id: string,
  date: string,
  players: Player[],
): GameSession => ({
  id,
  date,
  players,
  matches: [],
  commonMatchId: null,
  playerAssignments: {},
  matchesPerPlayer: 0,
});

test("unknown completion dates are explicit", () => {
  expect(formatHistoryDate("")).toBe("Completion date unknown");
  expect(formatModalDate("")).toBe("Completion date unknown");
});

test("registered cloud players aggregate by account and use their latest known name", () => {
  const older = buildSession("cloud-1", "2026-01-01T00:00:00.000Z", [
    { id: "participant-1", accountId: "account-1", membershipType: "registered", name: "Old name", drinksTaken: 2 },
  ]);
  const newer = buildSession("cloud-2", "2026-05-01T00:00:00.000Z", [
    { id: "participant-2", accountId: "account-1", membershipType: "registered", name: "Current name", drinksTaken: 4 },
  ]);

  const forward = calculateLifetimePlayerStats([older, newer]);
  const backward = calculateLifetimePlayerStats([newer, older]);

  expect(forward).toEqual(backward);
  expect(forward).toHaveLength(1);
  expect(forward[0]).toMatchObject({
    identityKey: JSON.stringify(["account", "account-1"]),
    name: "Current name",
    totalDrinks: 6,
    gamesPlayed: 2,
  });
});

test("same-named guests from different sessions stay separate and get context labels", () => {
  const history = [
    buildSession("session-a", "2026-04-24T19:00:00.000Z", [
      { id: "guest-a", membershipType: "guest", name: "Alex", drinksTaken: 2 },
    ]),
    buildSession("session-b", "2026-04-25T19:00:00.000Z", [
      { id: "guest-b", membershipType: "guest", name: "Alex", drinksTaken: 3 },
    ]),
  ];

  const stats = calculateLifetimePlayerStats(history);
  expect(stats).toHaveLength(2);
  expect(stats.map(({ totalDrinks }) => totalDrinks)).toEqual([3, 2]);
  expect(stats.every(({ contextLabel }) => contextLabel?.startsWith("Guest · "))).toBe(true);
  expect(stats[0].identityKey).not.toBe(stats[1].identityKey);
});

test("missing participant ids fall back to a session and participant position", () => {
  const player = { id: "", name: "Local" };
  expect(getPlayerIdentityKey(player, "game-a", 0)).toBe(
    JSON.stringify(["session", "game-a", "position", 0]),
  );
  expect(getPlayerIdentityKey(player, "game-a", 1)).not.toBe(
    getPlayerIdentityKey(player, "game-a", 0),
  );
});

test("identity resolver finds the player without relying on display name", () => {
  const game = buildSession("session-a", "", [
    { id: "one", name: "Alex", drinksTaken: 1 },
    { id: "two", name: "Alex", drinksTaken: 4 },
  ]);
  const key = getPlayerIdentityKey(game.players[1], game.id, 1);

  expect(findPlayerByIdentityKey(game, key)).toBe(game.players[1]);
});

test("combined-history comparisons count tied top drinkers by identity", () => {
  const game = buildSession("cloud", "", [
    { id: "a", name: "Alice", drinksTaken: 2 },
    { id: "b", name: "Bob", drinksTaken: 2 },
  ]);
  const [alice, bob] = calculateLifetimePlayerStats([game]);
  const result = getPlayerHeadToHeadStats([game], alice, bob);

  expect(result.player1TopDrinkerCount).toBe(1);
  expect(result.player2TopDrinkerCount).toBe(1);
});

test("head-to-head keeps same-named session participants separate", () => {
  const first = buildSession("session-a", "2026-04-24T19:00:00.000Z", [
    { id: "guest-a", name: "Alex", drinksTaken: 4 },
  ]);
  const second = buildSession("session-b", "2026-04-25T19:00:00.000Z", [
    { id: "guest-b", name: "Alex", drinksTaken: 7 },
  ]);
  const [player1, player2] = calculateLifetimePlayerStats([first, second]);

  const result = getPlayerHeadToHeadStats([first, second], player1, player2);
  expect(result.player1.totalDrinks).toBe(7);
  expect(result.player2.totalDrinks).toBe(4);
  expect(result.gamesPlayedTogether).toBe(0);
  expect(result.player1MaxInAGame).toBe(7);
  expect(result.player2MaxInAGame).toBe(4);
});
