// Deterministic projections of the already inspected Site v2 fields; no network fixture generation.
export const liveEvent = {
  id: 'event-100',
  date: '2026-10-25T18:00:00Z',
  season: { year: 2026, type: 1 },
  status: { type: { name: 'STATUS_IN_PROGRESS', state: 'in', completed: false }, period: 2, clock: 3600, displayClock: '60\u2032' },
  competitions: [{
    id: 'competition-200',
    competitors: [
      { homeAway: 'home', score: '2', team: { id: 'team-home', displayName: 'Home FC', abbreviation: 'HOM' }, statistics: [
        { name: 'totalShots', value: 8 }, { name: 'shotsOnTarget', value: 3 },
        { name: 'foulsCommitted', value: 0 }, { name: 'yellowCards', value: 1 },
        { name: 'redCards', value: 0 }, { name: 'wonCorners', value: 4 },
        { name: 'possessionPct', displayValue: '54.2%' },
      ] },
      { homeAway: 'away', score: { value: 1 }, team: { id: 'team-away', displayName: 'Away FC' }, statistics: [] },
    ],
    details: [{
      id: 'play-1', scoringPlay: true, team: { id: 'team-home' },
      athletesInvolved: [{ id: 'athlete-1', displayName: 'A Player' }],
      clock: { displayValue: '12\u2032' }, period: { number: 1 },
      penaltyKick: true,
    }],
    venue: { id: 'venue-1', fullName: 'Home Ground' },
  }],
};

export const liveBoard = { events: [liveEvent] };
export const emptyBoard = { events: [] };
export const futureBoard = { events: [{ ...liveEvent, id: 'event-future', date: '2026-10-28T18:00:00Z', status: { type: { name: 'STATUS_SCHEDULED', state: 'pre', completed: false } } }] };
export const finalBoard = { events: [{ ...liveEvent, status: { type: { name: 'STATUS_FULL_TIME', state: 'post', completed: true } } }] };
export const partialBoard = { events: [{ ...liveEvent, status: {}, competitions: [{ ...liveEvent.competitions[0], competitors: liveEvent.competitions[0].competitors.map(({ score: _score, statistics: _statistics, ...team }) => team), details: undefined }] }] };
