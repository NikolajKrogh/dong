import { FOOTBALL_MATCH_PROVIDER } from '../../../../types/footballMatch.ts';
import type {
  MatchLifecycle,
  MatchSide,
  SavedMatch,
  SavedMatchGoal,
  SavedRosterEntry,
  SavedTeamStatistics,
} from '../../../../types/footballMatch.ts';

interface NormalizedGoalParticipant {
  sourceAthleteId: string | null;
  athleteName: string | null;
  role: 'scorer' | 'assist' | 'involved' | 'unknown';
}
interface NormalizedProviderGoal extends SavedMatchGoal {
  participants?: NormalizedGoalParticipant[];
}

type NormalizedProviderMatch = Omit<
  SavedMatch,
  'catalogMatchId' | 'observationVersion' | 'freshness' | 'goals'
> & {
  goals: NormalizedProviderGoal[] | null;
};

export interface NormalizedScoreboard {
  matches: NormalizedProviderMatch[];
  isPartial: boolean;
}

function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown, max = 160): string | null {
  if (typeof value !== 'string' || value.trim().length === 0 || value.length > max) return null;
  return value.trim();
}

function boolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function number(value: unknown, max = 100_000): number | null {
  const raw = typeof value === 'object' ? object(value).value : value;
  let parsed = Number.NaN;
  if (typeof raw === 'number') parsed = raw;
  else if (typeof raw === 'string' && /^\d+(?:\.\d+)?%?$/.test(raw)) {
    parsed = Number(raw.replace('%', ''));
  }
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) return null;
  return parsed;
}

function integer(value: unknown, max = 999): number | null {
  const parsed = number(value, max);
  if (parsed === null || !Number.isInteger(parsed)) return null;
  return parsed;
}

function instant(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hasOffsetTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  if (!hasOffsetTimestamp || !Number.isFinite(Date.parse(value))) return null;

  const datePart = value.slice(0, 10);
  const calendar = new Date(`${datePart}T00:00:00Z`);
  if (calendar.toISOString().slice(0, 10) !== datePart) return null;
  return new Date(value).toISOString();
}

function lifecycle(status: Record<string, unknown>): MatchLifecycle {
  const type = object(status.type);
  const names: Record<string, MatchLifecycle> = {
    STATUS_SCHEDULED: 'scheduled',
    STATUS_IN_PROGRESS: 'live',
    STATUS_HALFTIME: 'live',
    STATUS_END_OF_REGULATION: 'live',
    STATUS_OVERTIME: 'live',
    STATUS_DELAYED: 'delayed',
    STATUS_SUSPENDED: 'suspended',
    STATUS_POSTPONED: 'postponed',
    STATUS_CANCELED: 'canceled',
    STATUS_CANCELLED: 'canceled',
    STATUS_ABANDONED: 'abandoned',
    STATUS_FULL_TIME: 'finished',
    STATUS_FINAL: 'finished',
    STATUS_FINAL_AET: 'finished',
    STATUS_FINAL_PEN: 'finished',
  };
  const known = typeof type.name === 'string' && Object.hasOwn(names, type.name)
    ? names[type.name] : undefined;
  if (known === 'finished' && type.completed !== true) return 'unknown';
  if (known) return known;
  return type.state === 'in' ? 'live' : 'unknown';
}

function statistics(competitor: Record<string, unknown>): SavedTeamStatistics | null {
  if (!Array.isArray(competitor.statistics)) return null;
  const stats = competitor.statistics.map(object);
  const get = (...names: string[]): number | null => {
    const stat = stats.find(item => typeof item.name === 'string' && names.includes(item.name));
    return stat ? number(stat.value ?? stat.displayValue) : null;
  };
  const possession = get('possessionPct', 'possession');
  const count = (...names: string[]): number | null => {
    const value = get(...names);
    return value !== null && Number.isInteger(value) ? value : null;
  };
  return {
    shotAttempts: count('totalShots', 'shotAttempts'),
    shotsOnGoal: count('shotsOnTarget', 'shotsOnGoal'),
    fouls: count('foulsCommitted', 'fouls'),
    yellowCards: count('yellowCards'),
    redCards: count('redCards'),
    cornerKicks: count('wonCorners', 'cornerKicks'),
    possession: possession !== null && possession <= 100 ? possession : null,
  };
}

function goals(
  details: unknown[],
  homeId: string | null,
  awayId: string | null,
  summary = false,
): NormalizedProviderGoal[] {
  const scoringDetails = details.map(object).filter(detail => {
    if (!summary) return detail.scoringPlay === true;
    const isGoal = object(detail.type).type === 'goal';
    const isSpecialScoringPlay = detail.scoringPlay === true
      && (detail.penaltyKick === true || detail.ownGoal === true || detail.shootout === true);
    return isGoal || isSpecialScoringPlay;
  });
  return scoringDetails.map(detail => {
    let participants: NormalizedGoalParticipant[];
    if (summary) {
      participants = array(detail.participants).map(object).map(participant => {
        const athlete = object(participant.athlete);
        const role = participant.role;
        return {
          sourceAthleteId: text(athlete.id, 128),
          athleteName: text(athlete.displayName ?? athlete.shortName),
          role: role === 'scorer' || role === 'assist' || role === 'involved' ? role : 'unknown',
        };
      });
    } else {
      participants = array(detail.athletesInvolved).map(object).map(athlete => ({
        sourceAthleteId: text(athlete.id, 128),
        athleteName: text(athlete.displayName ?? athlete.shortName),
        role: 'unknown',
      }));
    }
    // Participant order never establishes scorer/assist roles. The scoreboard's
    // single involved athlete remains a display attribution with an unknown role.
    const scorers = participants.filter(participant => participant.role === 'scorer');
    let athlete: NormalizedGoalParticipant | null = null;
    if (scorers.length === 1) athlete = scorers[0];
    else if (!summary && participants.length === 1) athlete = participants[0];
    const teamId = text(object(detail.team).id, 128);
    let kind: SavedMatchGoal['kind'] = 'goal';
    if (detail.shootout === true) kind = 'shootout';
    else if (detail.ownGoal === true) kind = 'own_goal';
    else if (detail.penaltyKick === true) kind = 'penalty';
    let side: MatchSide | null = null;
    if (kind !== 'own_goal' && teamId !== null && teamId === homeId) side = 'home';
    else if (kind !== 'own_goal' && teamId !== null && teamId === awayId) side = 'away';
    return {
      sourcePlayId: text(detail.id, 128),
      side,
      sourceAthleteId: athlete?.sourceAthleteId ?? null,
      athleteName: athlete?.athleteName ?? null,
      sourceTeamId: teamId,
      clock: text(object(detail.clock).displayValue, 40),
      period: integer(object(detail.period).number, 20),
      occurredAt: instant(detail.wallclock),
      kind,
      isRetracted: detail.retracted === true,
      participants,
    };
  });
}

const FINAL_METRICS: Record<string, readonly string[]> = {
  shotAttempts: ['totalShots', 'shotAttempts'],
  shotsOnGoal: ['shotsOnTarget', 'shotsOnGoal'],
  fouls: ['foulsCommitted', 'fouls'],
  yellowCards: ['yellowCards'],
  redCards: ['redCards'],
  cornerKicks: ['wonCorners', 'cornerKicks'],
  possession: ['possessionPct', 'possession'],
  offsides: ['offsides'],
  saves: ['saves'],
  blockedShots: ['blockedShots'],
  penaltyKickGoals: ['penaltyKickGoals'],
  penaltyKickShots: ['penaltyKickShots'],
  accuratePasses: ['accuratePasses'],
  totalPasses: ['totalPasses'],
  passPct: ['passPct'],
  accurateCrosses: ['accurateCrosses'],
  totalCrosses: ['totalCrosses'],
  crossPct: ['crossPct'],
  accurateLongBalls: ['accurateLongBalls'],
  totalLongBalls: ['totalLongBalls'],
  longballPct: ['longballPct'],
  effectiveTackles: ['effectiveTackles'],
  totalTackles: ['totalTackles'],
  tacklePct: ['tacklePct'],
  interceptions: ['interceptions'],
  effectiveClearance: ['effectiveClearance'],
  totalClearance: ['totalClearance'],
  shotPct: ['shotPct'],
};

function finalStatistics(entry: Record<string, unknown>): Record<string, number | null> {
  const stats = array(entry.statistics).map(object);
  const values = Object.entries(FINAL_METRICS).map(([name, aliases]) => {
    const percentage = name === 'possession' || name.endsWith('Pct');
    const candidates = stats
      .filter(stat => typeof stat.name === 'string' && aliases.includes(stat.name))
      .map(stat => percentage
        ? number(stat.displayValue ?? stat.value, 100)
        : integer(stat.value ?? stat.displayValue, 100_000));
    const hasConsistentValue = candidates.length > 0
      && candidates.every(candidate => candidate === candidates[0]);
    const value = hasConsistentValue ? candidates[0] : null;
    return [name, value];
  });
  return Object.fromEntries(values);
}

function summaryEvent(summary: Record<string, unknown>): Record<string, unknown> {
  const header = object(summary.header);
  const competition = object(array(header.competitions)[0]);
  const status = object(header.status ?? competition.status);
  const completed = boolean(object(status.type).completed) ?? boolean(competition.isFinal);
  return completed === null
    ? header
    : {
        ...header,
        status: {
          ...status,
          type: { ...object(status.type), completed },
        },
      };
}

function summarySide(entry: Record<string, unknown>, match: NormalizedProviderMatch): MatchSide | null {
  const id = text(object(entry.team).id, 128);
  let side: MatchSide | null = null;
  if (id !== null && id === match.homeTeam.sourceTeamId) side = 'home';
  else if (id !== null && id === match.awayTeam.sourceTeamId) side = 'away';
  return entry.homeAway !== undefined && entry.homeAway !== side ? null : side;
}

function rosterParticipation(player: Record<string, unknown>): { didPlay: boolean | null; contradictory: boolean } {
  const appeared = player.subbedIn === true || player.subbedOut === true;
  const contradictory = player.didNotPlay === true && appeared;
  if (contradictory) return { didPlay: null, contradictory: true };
  let didPlay: boolean | null = null;
  if (player.didNotPlay === true) didPlay = false;
  else if (player.didNotPlay === false || appeared) didPlay = true;
  return { didPlay, contradictory: false };
}

interface SummaryRoster {
  entries: SavedRosterEntry[];
  sides: Set<MatchSide>;
  playerIds: Set<string>;
  hasMore: boolean;
  isPartial: boolean;
}

function appendRosterPlayers(players: unknown[], side: MatchSide, roster: SummaryRoster): void {
  for (const raw of players) {
    if (roster.entries.length >= 256) {
      roster.hasMore = true;
      roster.isPartial = true;
      break;
    }
    const player = object(raw);
    const athlete = object(player.athlete);
    const id = text(athlete.id, 128);
    const name = text(athlete.displayName ?? athlete.shortName);
    if (!name || (id !== null && roster.playerIds.has(id))) {
      roster.isPartial = true;
      continue;
    }
    if (id) roster.playerIds.add(id);
    const participation = rosterParticipation(player);
    roster.isPartial ||= participation.contradictory;
    roster.entries.push({
      sourceAthleteId: id,
      athleteName: name,
      side,
      jersey: text(player.jersey ?? athlete.jersey, 16),
      position: text(object(player.position ?? athlete.position).abbreviation, 40),
      isStarter: boolean(player.starter),
      didPlay: participation.didPlay,
      minutesPlayed: integer(player.minutesPlayed, 300),
    });
  }
}

function summaryRoster(summary: Record<string, unknown>, match: NormalizedProviderMatch): SummaryRoster {
  const roster: SummaryRoster = {
    entries: [], sides: new Set(), playerIds: new Set(), hasMore: false, isPartial: false,
  };
  for (const entry of array(summary.rosters).map(object)) {
    const side = summarySide(entry, match);
    if (!side || roster.sides.has(side) || !Array.isArray(entry.roster)) {
      roster.isPartial = true;
      continue;
    }
    roster.sides.add(side);
    appendRosterPlayers(entry.roster, side, roster);
  }
  roster.isPartial ||= roster.sides.size !== 2 || roster.entries.length === 0;
  return roster;
}

function applySummaryStatistics(summary: Record<string, unknown>, match: NormalizedProviderMatch): {
  teamStats: Record<MatchSide, Record<string, number | null>>;
  hasStats: boolean;
  isPartial: boolean;
} {
  const teams = array(object(summary.boxscore).teams).map(object);
  const teamStats = {
    home: finalStatistics({}),
    away: finalStatistics({}),
  };
  const statSides = new Set<MatchSide>();
  let isPartial = false;
  for (const entry of teams) {
    const side = summarySide(entry, match);
    if (!side || statSides.has(side) || !Array.isArray(entry.statistics)) {
      isPartial = true;
      continue;
    }
    statSides.add(side);
    teamStats[side] = finalStatistics(entry);
    const teamStatistics = statistics(entry);
    if (side === 'home') match.homeTeamStatistics = teamStatistics;
    else match.awayTeamStatistics = teamStatistics;
  }
  const hasStats = Object.values(teamStats).some(
    sideStats => Object.values(sideStats).some(value => value !== null),
  );
  const hasEmptyTeamStatistics = Object.values(teamStats).some(
    sideStats => Object.values(sideStats).every(value => value === null),
  );
  return { teamStats, hasStats, isPartial: isPartial || statSides.size !== 2 || hasEmptyTeamStatistics };
}

function hasCompleteGoalCount(
  savedGoals: NormalizedProviderGoal[], homeScore: number | null, awayScore: number | null,
): boolean {
  if (homeScore === null || awayScore === null) return false;
  const recordedGoalCount = savedGoals.filter(goal => !goal.isRetracted && goal.kind !== 'shootout').length;
  return recordedGoalCount === homeScore + awayScore;
}

function applySummaryGoals(keyEvents: unknown, match: NormalizedProviderMatch): void {
  if (!Array.isArray(keyEvents)) return;
  match.goals = goals(
    keyEvents,
    match.homeTeam.sourceTeamId,
    match.awayTeam.sourceTeamId,
    true,
  );
  const complete = hasCompleteGoalCount(match.goals, match.homeScore, match.awayScore)
    && match.goals.every(goal => goal.isRetracted || goal.side !== null);
  match.goalsAvailability = complete ? 'available' : 'partial';
  match.hasMoreGoals = match.goals.length > 100;
}

/** Extract only reviewed compact facts from the single bounded completion read. */
export function normalizeEspnSummary(
  payload: unknown,
  leagueCode: string,
  sourceEventId: string,
): NormalizedScoreboard {
  const summary = object(payload);
  const normalized = normalizeEspnScoreboard({ events: [summaryEvent(summary)] }, leagueCode);
  if (normalized.matches.length !== 1) throw new Error('invalid_provider_response');
  const match = normalized.matches[0];
  if (match.identity.sourceEventId !== sourceEventId) throw new Error('invalid_provider_response');
  const roster = summaryRoster(summary, match);
  const { teamStats, hasStats, isPartial: partialStatistics } = applySummaryStatistics(summary, match);
  applySummaryGoals(summary.keyEvents, match);
  const incomplete = normalized.isPartial || roster.isPartial || partialStatistics;
  const hasRoster = roster.sides.size > 0;
  let availability: 'unavailable' | 'partial' | 'available' = 'available';
  if (!hasRoster && !hasStats) availability = 'unavailable';
  else if (incomplete) availability = 'partial';
  match.historyDetails = {
    rosterEntries: hasRoster ? roster.entries : null,
    teamStats: hasStats ? teamStats : null,
    availability,
    isFinal: match.isCompleted,
    hasMoreRosterEntries: roster.hasMore || roster.entries.length > 128,
  };
  return { matches: [match], isPartial: incomplete };
}

function scoreboardTeams(competition: Record<string, unknown>): {
  home: Record<string, unknown>;
  away: Record<string, unknown>;
  homeTeam: SavedMatch['homeTeam'];
  awayTeam: SavedMatch['awayTeam'];
} | null {
  const competitors = array(competition.competitors).map(object);
  const home = competitors.filter(c => c.homeAway === 'home');
  const away = competitors.filter(c => c.homeAway === 'away');
  if (home.length !== 1 || away.length !== 1) return null;
  const homeTeam = object(home[0].team);
  const awayTeam = object(away[0].team);
  const homeId = text(homeTeam.id, 128);
  const awayId = text(awayTeam.id, 128);
  const homeName = text(homeTeam.displayName ?? homeTeam.name);
  const awayName = text(awayTeam.displayName ?? awayTeam.name);
  if (!homeName || !awayName || (homeId !== null && homeId === awayId)) return null;
  return {
    home: home[0], away: away[0],
    homeTeam: { sourceTeamId: homeId, name: homeName, shortName: text(homeTeam.abbreviation, 40) },
    awayTeam: { sourceTeamId: awayId, name: awayName, shortName: text(awayTeam.abbreviation, 40) },
  };
}

function scoreboardGoals(
  competition: Record<string, unknown>, homeId: string | null, awayId: string | null,
  homeScore: number | null, awayScore: number | null,
): Pick<NormalizedProviderMatch, 'goals' | 'goalsAvailability' | 'hasMoreGoals'> {
  if (!Array.isArray(competition.details)) {
    return { goals: null, goalsAvailability: 'unavailable', hasMoreGoals: false };
  }
  const savedGoals = goals(competition.details, homeId, awayId);
  return {
    goals: savedGoals,
    goalsAvailability: hasCompleteGoalCount(savedGoals, homeScore, awayScore) ? 'available' : 'partial',
    hasMoreGoals: savedGoals.length > 100,
  };
}

function normalizeScoreboardEvent(raw: unknown, leagueCode: string): NormalizedProviderMatch | null {
  const event = object(raw);
  const id = text(event.id, 128);
  const competitions = array(event.competitions);
  if (!id || competitions.length !== 1) return null;
  const competition = object(competitions[0]);
  const teams = scoreboardTeams(competition);
  if (!teams) return null;
  const { home, away, homeTeam, awayTeam } = teams;
  const status = object(event.status ?? competition.status);
  const type = object(status.type);
  const state = lifecycle(status);
  const kickoffAt = instant(event.date ?? competition.date);
  const season = object(event.season);
  const venue = object(competition.venue);
  const homeScore = integer(home.score);
  const awayScore = integer(away.score);
  let kickoffValidity: 'unknown' | 'tentative' | 'confirmed' = 'unknown';
  if (kickoffAt) {
    kickoffValidity = event.timeValid === false ? 'tentative' : 'confirmed';
  }
  const seasonType = typeof season.type === 'number'
    ? String(season.type)
    : text(season.type, 40);
  const seasonInfo = Object.keys(season).length === 0 ? null : {
    sourceId: text(season.id, 128),
    year: integer(season.year, 9999),
    type: seasonType,
  };
  return {
    identity: {
      provider: FOOTBALL_MATCH_PROVIDER,
      leagueCode,
      sourceEventId: id,
      sourceCompetitionId: text(competition.id, 128),
    },
    homeTeam,
    awayTeam,
    kickoffAt,
    kickoffValidity,
    lifecycle: state,
    rawStatus: text(type.name, 80),
    isCompleted: boolean(type.completed),
    homeScore,
    awayScore,
    shootoutHomeScore: integer(home.shootoutScore),
    shootoutAwayScore: integer(away.shootoutScore),
    aggregateHomeScore: integer(home.aggregateScore),
    aggregateAwayScore: integer(away.aggregateScore),
    period: integer(status.period, 20),
    clockSeconds: number(status.clock),
    displayClock: text(status.displayClock, 40),
    season: seasonInfo,
    venue: Object.keys(venue).length
      ? { sourceId: text(venue.id, 128), name: text(venue.fullName ?? venue.name) }
      : null,
    availability: homeScore === null || awayScore === null || state === 'unknown' ? 'partial' : 'available',
    ...scoreboardGoals(competition, homeTeam.sourceTeamId, awayTeam.sourceTeamId, homeScore, awayScore),
    homeTeamStatistics: statistics(home),
    awayTeamStatistics: statistics(away),
  };
}

export function normalizeEspnScoreboard(payload: unknown, leagueCode: string): NormalizedScoreboard {
  const board = object(payload);
  if (!Array.isArray(board.events) || board.events.length > 512) throw new Error('invalid_provider_response');
  const matches: NormalizedProviderMatch[] = [];
  const identities = new Set<string>();
  let isPartial = false;
  for (const raw of board.events) {
    const match = normalizeScoreboardEvent(raw, leagueCode);
    if (!match || identities.has(match.identity.sourceEventId)) {
      isPartial = true;
      continue;
    }
    identities.add(match.identity.sourceEventId);
    matches.push(match);
  }
  return { matches, isPartial };
}
