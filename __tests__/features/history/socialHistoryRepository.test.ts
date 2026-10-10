import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database';
import {
  loadCoplayerContext,
  loadPersonalHistoryStats,
  loadSharedGames,
  loadSharedTimeline,
  loadSocialHistory,
  parseSocialHistory,
} from '../../../features/history/socialHistoryRepository';

const a='00000000-0000-4000-8000-000000000001', b='00000000-0000-4000-8000-000000000002';
const session='28000000-0000-4000-8000-000000000001';
const stats=(id:string) => ({account_id:id,username:'Player',games_participated:0,total_drinks:0,average_drinks:null});
const empty = () => ({scope:'all_time_completed_online',viewer:stats(a),target:stats(b),
  shared:{shared_games:0,viewer_total_drinks:0,target_total_drinks:0,viewer_average_drinks:null,target_average_drinks:null,
    viewer_higher_count:0,target_higher_count:0,tied_count:0},games:{items:[],next_cursor:null}});
function client(data:unknown,error:{message:string;code?:string}|null=null) {
  const abortSignal=jest.fn(async () => ({data,error}));
  const rpc=jest.fn(() => ({abortSignal}));
  return {transport:{rpc} as unknown as SupabaseClient<Database>,rpc,abortSignal};
}
it('accepts empty overall and shared stats without inventing averages',() => {
  expect(parseSocialHistory(empty(),a,b).target.average_drinks).toBeNull();
});
it('loads only the authenticated personal aggregate and validates its account',async () => {
  const mock=client(stats(a)),signal=new AbortController().signal;
  await expect(loadPersonalHistoryStats(mock.transport,a,signal)).resolves.toEqual(stats(a));
  expect(mock.rpc).toHaveBeenCalledWith('get_personal_history_stats');
  await expect(loadPersonalHistoryStats(mock.transport,b,signal)).rejects.toThrow('Invalid social history response');
});
it.each([
  (value:ReturnType<typeof empty>) => {value.target.account_id=a;},
  (value:ReturnType<typeof empty>) => {value.scope='local';},
  (value:ReturnType<typeof empty>) => {value.target.total_drinks=Infinity;},
  (value:ReturnType<typeof empty>) => {value.shared.tied_count=1;},
  (value:ReturnType<typeof empty>) => {value.games.next_cursor='bad' as never;},
  (value:ReturnType<typeof empty>) => {Object.assign(value.target,{session_id:session});},
])('rejects malformed or private payloads before display',change => {
  const payload=empty(); change(payload);
  expect(() => parseSocialHistory(payload,a,b)).toThrow('Invalid social history response');
});
it.each(['browser','native'])('sends only a target and passes a %s cancellation signal',async runtime => {
  const mock=client(empty()),signal=new AbortController().signal;
  if (runtime==='native') Object.defineProperty(signal,'throwIfAborted',{value:undefined});
  await expect(loadSocialHistory(mock.transport,a,b,signal)).resolves.toMatchObject({scope:'all_time_completed_online'});
  expect(mock.rpc).toHaveBeenCalledWith('get_social_history',{target_account_id:b,page_size:20});
  expect(mock.abortSignal).toHaveBeenCalledWith(signal);
});
it('never uses stale payload when the read fails',async () => {
  const mock=client(empty(),{message:'comparison_not_allowed'});
  await expect(loadSocialHistory(mock.transport,a,b,new AbortController().signal)).rejects.toThrow('current friends');
});
it('distinguishes unavailable shared statistics from a connection failure',async () => {
  const mock=client(null,{message:'Could not find the function',code:'PGRST202'});
  await expect(loadSocialHistory(mock.transport,a,b,new AbortController().signal)).rejects.toThrow('not available yet');
});
it.each(['browser','native'])('does not send an aborted %s request',async runtime => {
  const mock=client(empty()),controller=new AbortController(); controller.abort();
  if (runtime==='native') {
    Object.defineProperty(controller.signal,'throwIfAborted',{value:undefined});
    Object.defineProperty(controller.signal,'reason',{value:undefined});
  }
  await expect(loadSocialHistory(mock.transport,a,b,controller.signal)).rejects.toMatchObject({name:'AbortError'});
  expect(mock.rpc).not.toHaveBeenCalled();
});
it('validates nested games and subjects on every page',async () => {
  const mock=client({items:[{session_id:session}],next_cursor:null});
  await expect(loadSharedGames(mock.transport,a,b,'cursor',new AbortController().signal)).rejects.toThrow();
});
it('preserves a deleted third participant as an unlinked registered snapshot',async () => {
  const players=[a,b,null].map((accountId,index) => ({id:`28000000-0000-4000-8000-00000000000${index+2}`,
    name:'Recorded name',membershipType:'registered',accountId,drinksTaken:2,leftAt:null}));
  const mock=client({items:[{session_id:session,completed_at:'2026-10-01T12:00Z',players,matches:[],
    common_match_id:null,player_assignments:{},matches_per_player:0}],next_cursor:null});
  const result=await loadSharedGames(mock.transport,a,b,'cursor',new AbortController().signal);
  expect(result.items[0].players[2]).toMatchObject({accountId:null,name:'Recorded name',drinksTaken:2});
});
it('validates departure dates and finite totals on timeline pages',async () => {
  const mock=client({items:[{session_id:session,completed_at:'2026-10-01T12:00Z',viewer_drinks:2,target_drinks:4,
    viewer_left_at:'invalid',target_left_at:null}],next_cursor:null});
  await expect(loadSharedTimeline(mock.transport,b,null,new AbortController().signal)).rejects.toThrow();
});
it('does not accept an unrequested account in proof-bound discovery',async () => {
  const mock=client([{account_id:a,username:'Viewer',relationship:'friends',request_id:null}]);
  await expect(loadCoplayerContext(mock.transport,[b],new AbortController().signal)).rejects.toThrow();
});

it('preserves valid whitespace around usernames and ignores allowed extra payload fields', async () => {
  const payload = empty();
  payload.viewer.username = ' Player ';
  Object.assign(payload, { trace_id: 'ignored' });

  expect(parseSocialHistory(payload, a, b).viewer.username).toBe(' Player ');

  const mock = client([{
    account_id: b,
    username: ' Friend ',
    relationship: 'friends',
    request_id: null,
    server_metadata: 'ignored',
  }]);
  await expect(loadCoplayerContext(mock.transport, [b], new AbortController().signal))
    .resolves.toEqual([{
      account_id: b,
      username: ' Friend ',
      relationship: 'friends',
      request_id: null,
    }]);
});

it('keeps the shared-game boundary permissive for unknown fields and empty labels', async () => {
  const mock = client({
    items: [{
      session_id: session,
      completed_at: '2026-10-01T12:00Z',
      players: [
        {
          id: session,
          name: '',
          membershipType: 'registered',
          accountId: a,
          drinksTaken: 0,
          leftAt: null,
          snapshot_note: 'ignored',
        },
        {
          id: '28000000-0000-4000-8000-000000000003',
          name: 'Friend',
          membershipType: 'registered',
          accountId: b,
          drinksTaken: 0,
          leftAt: null,
        },
      ],
      matches: [{
        id: '28000000-0000-4000-8000-000000000004',
        homeTeam: '',
        awayTeam: '',
        homeGoals: 0,
        awayGoals: 0,
        goals: 0,
        server_note: 'ignored',
      }],
      player_assignments: {},
      common_match_id: null,
      matches_per_player: 1,
      server_metadata: 'ignored',
    }],
    next_cursor: null,
  });

  const result = await loadSharedGames(mock.transport, a, b, 'cursor', new AbortController().signal);
  expect(result.items[0].players[0].name).toBe('');
  expect(result.items[0].matches[0].homeTeam).toBe('');
  expect(result.items[0]).not.toHaveProperty('server_metadata');
  expect(result.items[0].players[0]).not.toHaveProperty('snapshot_note');
  expect(result.items[0].matches[0]).not.toHaveProperty('server_note');
});

it('does not widen discovery to blocked or unavailable relationships', async () => {
  const mock = client([{ account_id: b, username: 'Friend', relationship: 'blocked', request_id: null }]);
  await expect(loadCoplayerContext(mock.transport, [b], new AbortController().signal))
    .rejects.toThrow('Invalid social history response.');
});

it('rejects pages that exceed the requested server limit', async () => {
  const mock = client({ items: Array.from({ length: 21 }, () => null), next_cursor: null });
  await expect(loadSharedGames(mock.transport, a, b, 'cursor', new AbortController().signal))
    .rejects.toThrow('Invalid social history response.');
});

it('rejects an oversized cursor before parsing its JSON', () => {
  const payload = {
    ...empty(),
    games: { items: [], next_cursor: 'x'.repeat(301) },
  };
  const parseJson = jest.spyOn(JSON, 'parse');

  try {
    expect(() => parseSocialHistory(payload, a, b)).toThrow('Invalid social history response.');
    expect(parseJson).not.toHaveBeenCalled();
  } finally {
    parseJson.mockRestore();
  }
});

it('preserves a valid cursor string and accepts its extra JSON fields', () => {
  const cursor = JSON.stringify({
    session_id: session,
    completed_at: '2026-10-01',
    opaque: 'kept in the serialized cursor',
  });
  const payload = {
    ...empty(),
    games: { items: [], next_cursor: cursor },
  };

  expect(parseSocialHistory(payload, a, b).games.next_cursor).toBe(cursor);
});

it('rejects a guest row linked to a registered account', async () => {
  const mock = client({
    items: [{
      session_id: session,
      completed_at: '2026-10-01T12:00Z',
      players: [
        {
          id: session,
          name: 'Player',
          membershipType: 'registered',
          accountId: a,
          drinksTaken: 0,
          leftAt: null,
        },
        {
          id: '28000000-0000-4000-8000-000000000003',
          name: 'Friend',
          membershipType: 'registered',
          accountId: b,
          drinksTaken: 0,
          leftAt: null,
        },
        {
          id: '28000000-0000-4000-8000-000000000004',
          name: 'Guest',
          membershipType: 'guest',
          accountId: a,
          drinksTaken: 0,
          leftAt: null,
        },
      ],
      matches: [],
      player_assignments: {},
      common_match_id: null,
      matches_per_player: 1,
    }],
    next_cursor: null,
  });

  await expect(loadSharedGames(mock.transport, a, b, 'cursor', new AbortController().signal))
    .rejects.toThrow('Invalid social history response.');
});
