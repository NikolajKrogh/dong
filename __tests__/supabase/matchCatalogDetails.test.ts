import { finalSummary } from '../fixtures/matchCatalog/summary';
import { normalizeEspnSummary } from '../../supabase/functions/_shared/football-matches/espnMatchNormalizer';

const summary = () => structuredClone(finalSummary);

describe('compact completion summary', () => {
  it('keeps strict match identity and nullable compact participation without profiles', () => {
    const match = normalizeEspnSummary(summary(), 'eng.1', 'event-100').matches[0];
    expect(match.identity.sourceCompetitionId).toBe('competition-200');
    expect(match.lifecycle).toBe('finished');
    expect(match.historyDetails?.rosterEntries).toEqual([
      expect.objectContaining({ sourceAthleteId: 'player-1', athleteName: 'Starter', isStarter: true, didPlay: null, minutesPlayed: null }),
      expect.objectContaining({ sourceAthleteId: 'player-2', isStarter: false, didPlay: true, minutesPlayed: null }),
      expect.objectContaining({ sourceAthleteId: 'player-3', didPlay: false, minutesPlayed: null }),
      expect.objectContaining({ sourceAthleteId: 'player-4', didPlay: null, minutesPlayed: null }),
      expect.objectContaining({ sourceAthleteId: 'player-5', side: 'away', didPlay: true, minutesPlayed: 90 }),
    ]);
    expect(JSON.stringify(match)).not.toMatch(/private-image|Do not retain|headshot|biography|commentary/);
    expect(match.historyDetails?.isFinal).toBe(true);
    expect(() => normalizeEspnSummary(summary(), 'eng.1', 'another-event')).toThrow('invalid_provider_response');
  });

  it('retains understood scalar team statistics and preserves unknowns', () => {
    const match = normalizeEspnSummary(summary(), 'eng.1', 'event-100').matches[0];
    expect(match.homeTeamStatistics).toMatchObject({ shotAttempts: 8, shotsOnGoal: 3, possession: 54.2, fouls: null });
    expect(match.historyDetails?.teamStats?.home).toMatchObject({ totalPasses: 500, accuratePasses: 405, passPct: 81, offsides: 0, blockedShots: 2 });
    expect(match.historyDetails?.teamStats?.home).not.toHaveProperty('unreviewedMetric');
    expect(match.historyDetails?.teamStats?.away.saves).toBe(1);
  });

  it('uses explicit goal types, preserves corrections/shootouts and never infers participant roles from order', () => {
    const match = normalizeEspnSummary(summary(), 'eng.1', 'event-100').matches[0];
    expect(match.goals).toHaveLength(5);
    expect(match.goals?.[0]).toMatchObject({ sourcePlayId: 'goal-1', sourceAthleteId: null, athleteName: null,
      participants: [expect.objectContaining({ sourceAthleteId: 'scorer-1', role: 'unknown' }), expect.objectContaining({ sourceAthleteId: 'assist-1', role: 'unknown' })] });
    expect(match.goals?.[1]).toMatchObject({ kind: 'penalty', sourceAthleteId: 'scorer-2' });
    expect(match.goals?.[2]).toMatchObject({ kind: 'own_goal', side: null, sourceTeamId: 'team-away' });
    expect(match.goals?.[3].kind).toBe('shootout');
    expect(match.goals?.[4].isRetracted).toBe(true);
  });

  it('does not invent missing rosters or finality and ignores foreign-team enrichment', () => {
    const payload = summary();
    delete (payload as Partial<typeof payload>).rosters;
    payload.header.competitions[0].status.type.completed = false;
    payload.boxscore.teams[0].team.id = 'unrelated-team';
    const match = normalizeEspnSummary(payload, 'eng.1', 'event-100').matches[0];
    expect(match.historyDetails?.rosterEntries).toBeNull();
    expect(match.historyDetails?.isFinal).toBe(false);
    expect(match.historyDetails?.teamStats?.home.totalPasses).toBeNull();
    expect(match.historyDetails?.availability).toBe('partial');
  });

  it('bounds internal roster retention and exposes partial flags instead of silently claiming completeness', () => {
    const payload = summary();
    payload.rosters[0].roster = Array.from({ length: 300 }, (_, n) => ({ athlete: { id: `roster-${n}`, displayName: `Player ${n}` }, starter: false }));
    const details = normalizeEspnSummary(payload, 'eng.1', 'event-100').matches[0].historyDetails;
    expect(details?.rosterEntries?.length).toBeLessThanOrEqual(256);
    expect(details?.hasMoreRosterEntries).toBe(true);
    expect(details?.availability).toBe('partial');
  });

  it('rejects fractional counts, impossible percentages and ambiguous team identities', () => {
    const payload = summary();
    payload.boxscore.teams[0].statistics.push({ name: 'passPct', value: 120 });
    payload.boxscore.teams[0].statistics.find(stat => stat.name === 'accuratePasses')!.value = 4.5;
    payload.rosters[1].team.id = 'team-home';
    const details = normalizeEspnSummary(payload, 'eng.1', 'event-100').matches[0].historyDetails;
    expect(details?.teamStats?.home.accuratePasses).toBeNull();
    expect(details?.teamStats?.home.passPct).toBeNull();
    expect(details?.availability).toBe('partial');
    expect(details?.rosterEntries?.every(entry => entry.side === 'home')).toBe(true);
  });

  it('uses supplied competition finality and reports absent optional sections as unavailable', () => {
    const payload = summary();
    const competition = payload.header.competitions[0] as Record<string, unknown>;
    competition.isFinal = true;
    const statusType: { completed?: boolean } = payload.header.competitions[0].status.type;
    delete statusType.completed;
    const match = normalizeEspnSummary({ header: payload.header }, 'eng.1', 'event-100').matches[0];
    expect(match.lifecycle).toBe('finished');
    expect(match.historyDetails).toMatchObject({ rosterEntries: null, teamStats: null, availability: 'unavailable', isFinal: true });
  });

  it('retains unknown participation when supplied appearance facts contradict one another', () => {
    const payload = summary();
    payload.rosters[0].roster[1].didNotPlay = true;
    const details = normalizeEspnSummary(payload, 'eng.1', 'event-100').matches[0].historyDetails;
    expect(details?.rosterEntries?.[1].didPlay).toBeNull();
    expect(details?.availability).toBe('partial');
  });

  it('rejects duplicate team sections and athlete identities across both roster sides', () => {
    const payload = summary();
    payload.rosters[1].roster[0].athlete.id = payload.rosters[0].roster[0].athlete.id;
    payload.rosters.push(structuredClone(payload.rosters[0]));
    payload.boxscore.teams.push(structuredClone(payload.boxscore.teams[0]));
    const details = normalizeEspnSummary(payload, 'eng.1', 'event-100').matches[0].historyDetails;
    expect(details?.rosterEntries).toHaveLength(4);
    expect(details?.rosterEntries?.map(entry => entry.sourceAthleteId)).toEqual(['player-1', 'player-2', 'player-3', 'player-4']);
    expect(details?.teamStats?.home.totalPasses).toBe(500);
    expect(details?.availability).toBe('partial');
  });
});
