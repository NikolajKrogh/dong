import { liveEvent } from './scoreboards';

// Small synthetic projection of verified Site v2 paths. No provider fixture fetch.
// Maintainer parser: sportsdataverse/soccer/soccer_espn_parsers.py
export const finalSummary = {
  header: {
    ...liveEvent,
    status: undefined,
    competitions: [{ ...liveEvent.competitions[0], date: liveEvent.date, details: undefined,
      status: { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true }, period: 2, displayClock: 'FT' } }],
  },
  rosters: [
    { homeAway: 'home', team: { id: 'team-home' }, roster: [
      { athlete: { id: 'player-1', displayName: 'Starter', headshot: { href: 'private-image' } }, starter: true, jersey: '1', position: { abbreviation: 'GK' } },
      { athlete: { id: 'player-2', displayName: 'Substitute' }, starter: false, subbedIn: true, jersey: '12' },
      { athlete: { id: 'player-3', displayName: 'Unused substitute' }, starter: false, didNotPlay: true },
      { athlete: { id: 'player-4', displayName: 'Unknown participation' }, starter: false },
    ] },
    { homeAway: 'away', team: { id: 'team-away' }, roster: [
      { athlete: { id: 'player-5', displayName: 'Away player' }, starter: true, didNotPlay: false, minutesPlayed: 90 },
    ] },
  ],
  boxscore: { teams: [
    { homeAway: 'home', team: { id: 'team-home' }, statistics: [
      { name: 'totalShots', displayValue: '8' }, { name: 'shotsOnTarget', value: 3 },
      { name: 'possessionPct', displayValue: '54.2%' }, { name: 'accuratePasses', value: 405 },
      { name: 'totalPasses', value: 500 }, { name: 'passPct', displayValue: '81%' },
      { name: 'offsides', value: 0 }, { name: 'blockedShots', value: 2 },
      { name: 'unreviewedMetric', value: 999 },
    ] },
    { homeAway: 'away', team: { id: 'team-away' }, statistics: [{ name: 'saves', value: 1 }] },
  ] },
  keyEvents: [
    { id: 'goal-1', type: { type: 'goal' }, scoringPlay: true, team: { id: 'team-home' }, clock: { displayValue: '12′' },
      participants: [{ athlete: { id: 'scorer-1', displayName: 'First involved' } }, { athlete: { id: 'assist-1', displayName: 'Second involved' } }] },
    { id: 'goal-2', type: { type: 'goal' }, scoringPlay: true, penaltyKick: true, team: { id: 'team-home' },
      participants: [{ role: 'scorer', athlete: { id: 'scorer-2', displayName: 'Explicit scorer' } }] },
    { id: 'goal-3', type: { type: 'goal' }, scoringPlay: true, ownGoal: true, team: { id: 'team-away' } },
    { id: 'shootout-1', type: { type: 'goal' }, scoringPlay: true, shootout: true, team: { id: 'team-home' } },
    { id: 'retracted-1', type: { type: 'goal' }, scoringPlay: false, retracted: true, team: { id: 'team-home' } },
    { id: 'card-1', type: { type: 'yellow-card' }, scoringPlay: false, text: 'Goal word in commentary is not a goal' },
  ],
  commentary: [{ text: 'Do not retain commentary' }],
  news: [{ headline: 'Do not retain news' }],
};
