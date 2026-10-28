import { normalizeEspnScoreboard, normalizeEspnSummary } from '../../supabase/functions/_shared/football-matches/espnMatchNormalizer';
import { liveBoard } from '../fixtures/matchCatalog/scoreboards';
import { finalSummary } from '../fixtures/matchCatalog/summary';

describe('untrusted provider names', () => {
  it('ignores object-valued status and statistic names without invoking string conversion', () => {
    const payload = structuredClone(liveBoard);
    (payload.events[0].status.type as Record<string, unknown>).name = { toString: null };
    const home = payload.events[0].competitions[0].competitors[0];
    (home.statistics![0] as Record<string, unknown>).name = { toString: null };
    const match = normalizeEspnScoreboard(payload, 'eng.1').matches[0];
    expect(match.lifecycle).toBe('live');
    expect(match.rawStatus).toBeNull();
    expect(match.homeTeamStatistics).toMatchObject({ shotAttempts: null, shotsOnGoal: 3 });
  });

  it('ignores object-valued final statistic names while preserving valid metrics', () => {
    const payload = structuredClone(finalSummary);
    (payload.boxscore.teams[0].statistics[0] as Record<string, unknown>).name = { toString: null };
    const match = normalizeEspnSummary(payload, 'eng.1', 'event-100').matches[0];
    expect(match.historyDetails?.teamStats?.home.shotAttempts).toBeNull();
    expect(match.historyDetails?.teamStats?.home.totalPasses).toBe(500);
  });

  it.each(['constructor', 'toString', '__proto__'])('does not recognize inherited object key %s as a lifecycle', name => {
    const payload = structuredClone(liveBoard);
    payload.events[0].status.type = { name, state: 'post', completed: false };
    expect(normalizeEspnScoreboard(payload, 'eng.1').matches[0].lifecycle).toBe('unknown');
  });
});
