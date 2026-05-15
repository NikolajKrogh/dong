import { test as base } from "@playwright/test";

export const test = base.extend<{ appUrl: string }>({
  appUrl: ["http://localhost:8081", { option: true }],
});

export interface GuestRoomFixtureParticipant {
  id: string;
  displayName: string;
  membershipType: "registered" | "guest";
  sessionRole: "owner" | "member";
  currentDrinkTotal: number;
}

export interface GuestRoomFixtureMatch {
  id: string;
  sourceProvider: string;
  sourceMatchId: string | null;
  homeTeamName: string;
  awayTeamName: string;
  kickoffAt: string | null;
  homeScore: number;
  awayScore: number;
}

export interface GuestRoomFixtureAssignment {
  participantId: string;
  matchId: string;
}

export interface GuestRoomHostFixture {
  sessionId: string;
  joinCode: string;
  state: "joinable" | "in_play" | "completed";
  commonMatchId: string | null;
  defaultGuestName: string;
  participants: GuestRoomFixtureParticipant[];
  matches: GuestRoomFixtureMatch[];
  assignments: GuestRoomFixtureAssignment[];
}

export const createGuestRoomHostFixture = (
  overrides: Partial<GuestRoomHostFixture> = {},
): GuestRoomHostFixture => {
  const defaultParticipants: GuestRoomFixtureParticipant[] = [
    {
      id: "owner-participant-1",
      displayName: "Host Owner",
      membershipType: "registered",
      sessionRole: "owner",
      currentDrinkTotal: 0,
    },
    {
      id: "member-participant-1",
      displayName: "Registered Player",
      membershipType: "registered",
      sessionRole: "member",
      currentDrinkTotal: 1,
    },
  ];

  const defaultMatches: GuestRoomFixtureMatch[] = [
    {
      id: "match-1",
      sourceProvider: "espn",
      sourceMatchId: "espn-match-1",
      homeTeamName: "Arsenal",
      awayTeamName: "Chelsea",
      kickoffAt: "2026-05-15T18:00:00.000Z",
      homeScore: 1,
      awayScore: 0,
    },
  ];

  const defaultAssignments: GuestRoomFixtureAssignment[] = [
    {
      participantId: "owner-participant-1",
      matchId: "match-1",
    },
    {
      participantId: "member-participant-1",
      matchId: "match-1",
    },
  ];

  return {
    sessionId: overrides.sessionId ?? "guest-room-session-1",
    joinCode: overrides.joinCode ?? "ROOM42",
    state: overrides.state ?? "joinable",
    commonMatchId: overrides.commonMatchId ?? "match-1",
    defaultGuestName: overrides.defaultGuestName ?? "Guest Player",
    participants: overrides.participants ?? defaultParticipants,
    matches: overrides.matches ?? defaultMatches,
    assignments: overrides.assignments ?? defaultAssignments,
  };
};
